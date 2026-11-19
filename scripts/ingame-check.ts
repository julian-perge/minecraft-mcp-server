import { type ChildProcessWithoutNullStreams, spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  isChatLine,
  isCommandErrorLine,
  isDoneLine,
  isJoinedLine,
  isTestFailedLine,
  isTestPassedLine,
  javaEnvName,
  logMessage,
  parseJavaMajor,
  serverProperties,
} from "./ingame-lib.js";
import { structureNbt } from "./structure-nbt.js";
import { supportedVersionNames, UNSUPPORTED_VERSIONS } from "../src/minecraft-versions.js";
import { resolveServerJar } from "./server-jar.js";

const USERNAME = "CheckBot";
const REPO_ROOT = join(import.meta.dir, "..");

interface CheckResult {
  tool: string;
  ok: boolean;
  detail: string;
}

interface Check {
  tool: string;
  run: () => Promise<string>;
}

const usage =
  "usage: bun scripts/ingame-check.ts <version> [--expect-refusal] [--keep] [--report <file.json>]";
let args: ReturnType<typeof parseCli>;
function parseCli() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      "expect-refusal": { type: "boolean", default: false },
      keep: { type: "boolean", default: false },
      report: { type: "string" },
    },
  });
  if (positionals.length !== 1) throw new Error(usage);
  const version = positionals[0];
  // A version on the unsupported list can only pass the refusal check, so `just ingame 26.3` runs that check without the flag.
  const expectRefusal =
    values["expect-refusal"] || UNSUPPORTED_VERSIONS.some((entry) => entry.version === version);
  return { ...values, version, "expect-refusal": expectRefusal };
}
try {
  args = parseCli();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

const results: CheckResult[] = [];
let tempDir = null as string | null;
let server = null as MinecraftServer | null;
let client = null as Client | null;
let javaVersionText = "";
const mcpLog: string[] = [];

class CheckFailure extends Error {}

function fail(message: string): never {
  throw new CheckFailure(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class MinecraftServer {
  readonly log: string[] = [];
  private ready = false;
  private listeners = new Set<(line: string) => void>();
  private exited: Promise<number | null>;

  constructor(private child: ChildProcessWithoutNullStreams) {
    for (const stream of [child.stdout, child.stderr]) {
      createInterface({ input: stream }).on("line", (line) => {
        this.log.push(line);
        if (isDoneLine(line)) this.ready = true;
        for (const listener of this.listeners) listener(line);
      });
    }
    child.stdin.on("error", () => {});
    this.exited = new Promise((resolve) => child.once("exit", (code) => resolve(code)));
  }

  get running(): boolean {
    return this.child.exitCode === null && this.child.signalCode === null;
  }

  // Only lines that arrive after the call count, so a caller registers the wait before it writes the command that causes the line. The empty catch keeps a wait that the caller abandons after another error from being an unhandled rejection, and a caller that awaits the wait still gets its error.
  waitFor(match: (line: string) => boolean, timeoutMs: number, what: string): Promise<string> {
    const wait = new Promise<string>((resolve, reject) => {
      const done = (error: Error | null, line = "") => {
        clearTimeout(timer);
        this.listeners.delete(listener);
        if (error) reject(error);
        else resolve(line);
      };
      const listener = (line: string) => {
        if (match(line)) done(null, line);
      };
      const timer = setTimeout(
        () => done(new Error(`timed out after ${timeoutMs} ms waiting for ${what}`)),
        timeoutMs,
      );
      this.listeners.add(listener);
      this.exited.then(() => done(new Error(`the server exited while waiting for ${what}`)));
    });
    wait.catch(() => {});
    return wait;
  }

  async command(command: string, reply: (message: string) => boolean): Promise<string> {
    const line = this.waitFor(
      (l) => reply(logMessage(l)) || isCommandErrorLine(l),
      15_000,
      `the reply to "${command}"`,
    );
    this.child.stdin.write(`${command}\n`);
    const message = logMessage(await line);
    if (!reply(message)) throw new Error(`"${command}" failed: ${message}`);
    return message;
  }

  async test(condition: string): Promise<boolean> {
    const message = await this.command(
      `execute ${condition}`,
      (m) => isTestPassedLine(m) || isTestFailedLine(m),
    );
    return isTestPassedLine(message);
  }

  // A server that has not printed its Done line yet can fail to run "stop", so it gets SIGTERM instead, which makes Java run the server's own shutdown.
  async stop(): Promise<void> {
    if (!this.running) return;
    if (this.ready) this.child.stdin.write("stop\n");
    else this.child.kill("SIGTERM");
    const stopped = await Promise.race([
      this.exited.then(() => true),
      sleep(60_000).then(() => false),
    ]);
    if (!stopped) {
      this.child.kill("SIGKILL");
      await this.exited;
    }
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

function pickJava(version: string, needed: number): string {
  const envName = javaEnvName(needed);
  const home = process.env[envName];
  const java = home ? join(home, "bin", "java") : "java";
  const probe = spawnSync(java, ["-version"], { encoding: "utf8" });
  if (probe.error) {
    throw new Error(
      `cannot run ${java}: ${probe.error.message}. Set ${envName} to a Java ${needed} home.`,
    );
  }
  const output = `${probe.stderr}${probe.stdout}`;
  const major = parseJavaMajor(output);
  if (major === null) throw new Error(`cannot read the Java version from "${java} -version"`);
  if (major < needed) {
    throw new Error(
      `Minecraft ${version} needs Java ${needed} or newer, but ${java} is Java ${major}. Set ${envName} to a Java ${needed} home.`,
    );
  }
  javaVersionText = output.split("\n")[0].trim();
  return java;
}

// verify-structure reads the same file that the datapack hands to /place template, as in the Structure Lab flow in docs/verify-in-game.md.
const STRUCTURE_ID = "checks:hut";
let structurePath = "";

// A pack in the world's datapacks folder is enabled when the server creates the world. The format range covers data pack 94.1 (1.21.11) and 101.1 (26.1.2), from each server jar's version.json.
async function writeCheckDatapack(serverDir: string): Promise<string> {
  const packDir = join(serverDir, "world", "datapacks", "checks");
  const structureDir = join(packDir, "data", "checks", "structure");
  await mkdir(structureDir, { recursive: true });
  await writeFile(
    join(packDir, "pack.mcmeta"),
    JSON.stringify({
      pack: { description: "in-game check", min_format: [94, 1], max_format: [101, 1] },
    }),
  );
  const nbtPath = join(structureDir, "hut.nbt");
  await writeFile(
    nbtPath,
    structureNbt(
      [2, 2, 1],
      [
        { pos: [0, 0, 0], name: "minecraft:cobblestone" },
        { pos: [1, 0, 0], name: "minecraft:oak_planks" },
        { pos: [0, 1, 0], name: "minecraft:glass" },
        {
          pos: [1, 1, 0],
          name: "minecraft:oak_stairs",
          properties: { facing: "north", half: "bottom", shape: "straight", waterlogged: "false" },
        },
      ],
    ),
  );
  return nbtPath;
}

function textOf(result: CallToolResult): string {
  return result.content.map((part) => (part.type === "text" ? part.text : "")).join("\n");
}

function firstLine(text: string): string {
  const line = text.trim().split("\n")[0];
  return line.length > 100 ? `${line.slice(0, 97)}...` : line;
}

async function call(tool: string, toolArgs: Record<string, unknown> = {}) {
  const result = (await client!.callTool({ name: tool, arguments: toolArgs }, undefined, {
    timeout: 120_000,
  })) as CallToolResult;
  return { text: textOf(result), isError: result.isError === true };
}

async function expectTool(
  tool: string,
  toolArgs: Record<string, unknown>,
  patterns: RegExp | RegExp[],
): Promise<string> {
  const { text, isError } = await call(tool, toolArgs);
  if (isError) fail(`returned an error: ${firstLine(text)}`);
  const matched = [patterns].flat().map((pattern) => {
    const match = pattern.exec(text);
    if (!match) fail(`expected ${pattern}, got: ${firstLine(text)}`);
    return match[0].trim();
  });
  return matched.join(", ");
}

async function expectWorld(condition: string): Promise<string> {
  if (!(await server!.test(condition))) fail(`server check failed: execute ${condition}`);
  return `server: execute ${condition}`;
}

async function retry<T>(attempts: number, delayMs: number, run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= attempts) throw error;
      await sleep(delayMs);
    }
  }
}

function parsePosition(text: string): { x: number; y: number; z: number } {
  const match = /\((-?\d+), (-?\d+), (-?\d+)\)/.exec(text);
  if (!match) fail(`no position in: ${firstLine(text)}`);
  return { x: Number(match[1]), y: Number(match[2]), z: Number(match[3]) };
}

// The bot stands on a flat world, where grass is at y -61, so it starts at (0, -60, 0) and every other position is near it.
function gameChecks(): Check[] {
  const chatText = "in-game check says hello";
  const sayText = "in-game check ping";
  return [
    {
      tool: "detect-gamemode",
      run: () => expectTool("detect-gamemode", {}, /^Bot gamemode: "survival"$/),
    },
    {
      tool: "get-position",
      run: () => expectTool("get-position", {}, /^Current position: \(0, -60, 0\)$/),
    },
    {
      tool: "look-at",
      run: () =>
        expectTool("look-at", { x: 10, y: -59, z: 0 }, /^Looking at position \(10, -59, 0\)$/),
    },
    {
      tool: "jump",
      run: async () => {
        const detail = await expectTool("jump", {}, /^Successfully jumped$/);
        await sleep(1000);
        return detail;
      },
    },
    {
      tool: "move-in-direction",
      run: async () => {
        const detail = await expectTool(
          "move-in-direction",
          { direction: "forward", duration: 500 },
          /^Moved forward for 500ms$/,
        );
        await sleep(500);
        const { text } = await call("get-position");
        const position = parsePosition(text);
        if (position.x <= 0) fail(`the bot looked toward +x but did not move that way: ${text}`);
        return `${detail}, now at (${position.x}, ${position.y}, ${position.z})`;
      },
    },
    {
      tool: "move-to-position",
      run: async () => {
        await expectTool(
          "move-to-position",
          { x: 4, y: -60, z: 4, range: 1, timeoutMs: 30_000 },
          /^Successfully moved to position near \(4, -60, 4\)$/,
        );
        return expectWorld(`positioned 4.5 -60 4.5 if entity @a[name=${USERNAME},distance=..2.5]`);
      },
    },
    {
      tool: "list-inventory",
      run: async () => {
        for (const give of ["oak_planks 9", "raw_iron 1", "coal 1"]) {
          await server!.command(`give ${USERNAME} minecraft:${give}`, (m) => /^Gave \d+ /.test(m));
        }
        return retry(10, 500, () =>
          expectTool("list-inventory", {}, [
            /- oak_planks \(x9\)/,
            /- raw_iron \(x1\)/,
            /- coal \(x1\)/,
          ]),
        );
      },
    },
    {
      tool: "find-item",
      run: () =>
        expectTool("find-item", { nameOrType: "planks" }, /^Found 9 oak_planks in inventory/),
    },
    {
      tool: "equip-item",
      run: async () => {
        await expectTool("equip-item", { itemName: "oak_planks" }, /^Equipped oak_planks to hand$/);
        await sleep(500);
        return expectWorld(`if items entity ${USERNAME} weapon.mainhand minecraft:oak_planks`);
      },
    },
    {
      tool: "place-block",
      run: async () => {
        await expectTool("place-block", { x: 6, y: -60, z: 4 }, /^Placed block at \(6, -60, 4\)/);
        await sleep(500);
        return expectWorld("if block 6 -60 4 minecraft:oak_planks");
      },
    },
    {
      tool: "get-block-info",
      run: () => expectTool("get-block-info", { x: 6, y: -60, z: 4 }, /^Found oak_planks /),
    },
    {
      tool: "find-blocks",
      run: () =>
        expectTool(
          "find-blocks",
          { blockType: "oak_planks" },
          /^Found oak_planks at position \(6, -60, 4\)$/,
        ),
    },
    {
      tool: "find-blocks",
      run: () =>
        expectTool(
          "find-blocks",
          { blockType: "grass_block", count: 3 },
          /^Found 3 grass_block block\(s\) within 16 blocks/,
        ),
    },
    {
      tool: "dig-block",
      run: async () => {
        await expectTool("dig-block", { x: 6, y: -60, z: 4 }, /^Dug oak_planks at \(6, -60, 4\)$/);
        await sleep(500);
        return expectWorld("if block 6 -60 4 minecraft:air");
      },
    },
    {
      tool: "list-recipes",
      run: () => expectTool("list-recipes", { outputItem: "stick" }, /\bstick \(x4\)/),
    },
    {
      tool: "get-recipe",
      run: () =>
        expectTool("get-recipe", { itemName: "stick" }, /Output: stick \(x4\) \[craftable\]/),
    },
    {
      tool: "can-craft",
      run: () => expectTool("can-craft", { itemName: "stick" }, /^Yes, can craft stick\./),
    },
    {
      tool: "craft-item",
      run: async () => {
        await expectTool(
          "craft-item",
          { outputItem: "stick" },
          /^Successfully crafted stick 1 time\(s\)$/,
        );
        await sleep(500);
        return expectWorld(`if items entity ${USERNAME} container.* minecraft:stick`);
      },
    },
    {
      tool: "smelt-item",
      run: async () => {
        await server!.command("setblock 4 -60 6 minecraft:furnace", (m) =>
          m.startsWith("Changed the block"),
        );
        await sleep(500);
        await expectTool(
          "smelt-item",
          { x: 4, y: -60, z: 6, inputItem: "raw_iron", fuelItem: "coal", timeoutMs: 30_000 },
          /^Smelted 1 iron_ingot$/,
        );
        await sleep(500);
        return expectWorld(`if items entity ${USERNAME} container.* minecraft:iron_ingot`);
      },
    },
    {
      tool: "find-entity",
      run: async () => {
        await server!.command("summon minecraft:pig 2 -60 2 {NoAI:1b}", (m) =>
          m.startsWith("Summoned new "),
        );
        return retry(10, 500, () =>
          expectTool("find-entity", { type: "pig" }, /^Found pig at position \(2, -60, 2\)$/),
        );
      },
    },
    {
      tool: "run-command",
      run: async () => {
        await server!.command(`op ${USERNAME}`, (m) =>
          m.startsWith(`Made ${USERNAME} a server operator`),
        );
        return retry(5, 1000, () =>
          expectTool("run-command", { command: "seed", waitMs: 2000 }, /^- Seed: \[-?\d+\]$/m),
        );
      },
    },
    {
      tool: "check-blocks",
      run: async () => {
        await server!.command("setblock 8 -60 8 minecraft:oak_stairs[facing=east]", (m) =>
          m.startsWith("Changed the block at 8, -60, 8"),
        );
        const pass = await retry(10, 500, () =>
          expectTool(
            "check-blocks",
            {
              blocks: [
                {
                  x: 8,
                  y: -60,
                  z: 8,
                  block: "minecraft:oak_stairs",
                  properties: { facing: "east" },
                },
                { x: 8, y: -61, z: 8, block: "grass_block" },
              ],
            },
            /^PASS: all 2 blocks match\.$/,
          ),
        );
        const fail = await expectTool(
          "check-blocks",
          { blocks: [{ x: 8, y: -60, z: 8, block: "oak_stairs", properties: { facing: "west" } }] },
          /^FAIL: 0 of 1 block matches, 1 differs\./,
        );
        return `${pass} ${fail}`;
      },
    },
    {
      tool: "verify-structure",
      run: async () => {
        await server!.command(`place template ${STRUCTURE_ID} 10 -60 10`, (m) =>
          m.includes(STRUCTURE_ID),
        );
        const origin = { x: 10, y: -60, z: 10 };
        const pass = await retry(10, 500, () =>
          expectTool(
            "verify-structure",
            { path: structurePath, ...origin },
            /^PASS: all 4 blocks match\.$/m,
          ),
        );
        await server!.command("setblock 11 -60 10 minecraft:dirt", (m) =>
          m.startsWith("Changed the block at 11, -60, 10"),
        );
        const fail = await retry(10, 500, () =>
          expectTool(
            "verify-structure",
            { path: structurePath, ...origin },
            /- \(11, -60, 10\): expected oak_planks, found dirt/,
          ),
        );
        return `${pass} After a setblock: ${fail}`;
      },
    },
    {
      tool: "can-reach",
      run: async () => {
        const open = await expectTool(
          "can-reach",
          { x: 8, y: -60, z: 2, range: 1 },
          /^PASS: .* is success, with \d+ steps\.$/,
        );
        await server!.command("fill 20 -61 20 24 -57 24 minecraft:bedrock hollow", (m) =>
          /^Successfully filled \d+ block/.test(m),
        );
        const sealed = await retry(10, 500, () =>
          expectTool(
            "can-reach",
            { x: 22, y: -60, z: 22, range: 0, timeoutMs: 3000 },
            /^FAIL: .* is (noPath|timeout), with \d+ steps\.$/,
          ),
        );
        return `${open} A bedrock box: ${sealed}`;
      },
    },
    {
      tool: "send-chat",
      run: async () => {
        const seen = server!.waitFor(
          (line) => isChatLine(line, USERNAME, chatText),
          10_000,
          `<${USERNAME}> ${chatText}`,
        );
        await expectTool("send-chat", { message: chatText }, /^Sent message: /);
        return `server log: ${logMessage(await seen)}`;
      },
    },
    {
      tool: "read-chat",
      run: async () => {
        await server!.command(`say ${sayText}`, (m) => m === `[Server] ${sayText}`);
        return retry(10, 500, () =>
          expectTool("read-chat", { count: 10 }, new RegExp(`- Server: ${sayText}$`, "m")),
        );
      },
    },
    {
      tool: "detect-gamemode",
      run: async () => {
        await server!.command(`gamemode creative ${USERNAME}`, (m) =>
          m.startsWith(`Set ${USERNAME}'s game mode`),
        );
        return retry(10, 500, () =>
          expectTool("detect-gamemode", {}, /^Bot gamemode: "creative"$/),
        );
      },
    },
    {
      tool: "fly-to",
      run: async () => {
        await expectTool(
          "fly-to",
          { x: 4, y: -55, z: 4 },
          /^Successfully flew to position \(4, -55, 4\)/,
        );
        return expectWorld(`positioned 4 -55 4 if entity @a[name=${USERNAME},distance=..2]`);
      },
    },
  ];
}

function refusalChecks(): Check[] {
  const supported = supportedVersionNames();
  const expectRefusal = async (tool: string, toolArgs: Record<string, unknown>) => {
    const { text, isError } = await call(tool, toolArgs);
    if (!isError) fail(`expected a refusal, got: ${firstLine(text)}`);
    if (!text.includes("is not supported") || !text.includes(supported)) {
      fail(`expected "is not supported" and "${supported}", got: ${firstLine(text)}`);
    }
    return text.trim();
  };
  return [
    { tool: "get-position", run: () => expectRefusal("get-position", {}) },
    { tool: "list-inventory", run: () => expectRefusal("list-inventory", {}) },
    { tool: "detect-gamemode", run: () => expectRefusal("detect-gamemode", {}) },
    { tool: "send-chat", run: () => expectRefusal("send-chat", { message: "hello" }) },
    {
      tool: "(no join)",
      run: async () => {
        const joined = server!.log.find((line) => isJoinedLine(line, USERNAME));
        if (joined) fail(`the bot joined a server it does not support: ${logMessage(joined)}`);
        return `${USERNAME} never joined the server`;
      },
    },
  ];
}

// After SIGINT or SIGTERM the cleanup stops both servers, so every check still running fails, and those failures say nothing about the bot.
let interrupted = false;
// The signal handler and the end of the script both exit, so both use the signal's code once a signal came.
let signalExitCode: number | null = null;

function record(tool: string, ok: boolean, detail: string): void {
  if (interrupted) return;
  results.push({ tool, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${tool.padEnd(18)} ${detail}`);
}

async function runChecks(checks: Check[]): Promise<void> {
  for (const check of checks) {
    if (interrupted) return;
    try {
      record(check.tool, true, await check.run());
    } catch (error) {
      record(check.tool, false, error instanceof Error ? error.message : String(error));
    }
  }
}

async function main(): Promise<void> {
  const distMain = join(REPO_ROOT, "dist", "main.js");
  if (!existsSync(distMain)) throw new Error(`${distMain} is missing. Run just build first.`);

  const jar = await resolveServerJar(args.version);
  const java = pickJava(args.version, jar.javaMajor);
  const port = await freePort();

  tempDir = await mkdtemp(join(tmpdir(), `mc-ingame-${args.version}-`));
  await writeFile(join(tempDir, "eula.txt"), "eula=true\n");
  await writeFile(join(tempDir, "server.properties"), serverProperties(port));
  structurePath = await writeCheckDatapack(tempDir);
  console.log(`Minecraft ${args.version} on port ${port} in ${tempDir}, ${javaVersionText}`);

  server = new MinecraftServer(
    spawn(java, ["-Xmx1G", "-jar", jar.jarPath, "nogui"], { cwd: tempDir, stdio: "pipe" }),
  );
  await server.waitFor(isDoneLine, 300_000, "the server's Done line");
  if (interrupted) return;

  const mcpLogFile = createWriteStream(join(tempDir, "mcp-server.log"));
  const transport = new StdioClientTransport({
    command: "node",
    args: [distMain, "--host", "127.0.0.1", "--port", String(port), "--username", USERNAME],
    cwd: REPO_ROOT,
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk: Buffer) => {
    mcpLogFile.write(chunk);
    mcpLog.push(...chunk.toString().split("\n").filter(Boolean));
  });
  client = new Client({ name: "ingame-check", version: "0.0.0" });

  if (args["expect-refusal"]) {
    await client.connect(transport);
    // The gate answers "connecting" until its ping returns, so the check waits for any other answer.
    await retry(60, 1000, async () => {
      const { text } = await call("get-position");
      if (/connecting/i.test(text)) throw new Error(text);
    });
    await runChecks(refusalChecks());
    return;
  }

  const joined = server.waitFor(
    (line) => isJoinedLine(line, USERNAME),
    60_000,
    `${USERNAME} to join`,
  );
  await client.connect(transport);
  await joined;
  await retry(60, 500, async () => {
    const { isError, text } = await call("detect-gamemode");
    if (isError) throw new Error(text);
  });

  // 1.21.11 answers "Set the time to 1000", and 26.1 answers "Set minecraft:overworld to time marker minecraft:day".
  await server.command("time set day", (m) => /^Set (the time|\S+ to time)/.test(m));
  await server.command(`tp ${USERNAME} 0.5 -60 0.5 0 0`, (m) =>
    m.startsWith(`Teleported ${USERNAME}`),
  );
  await retry(20, 500, () =>
    expectTool("get-block-info", { x: 6, y: -61, z: 4 }, /^Found grass_block /),
  );

  const listed = (await client.listTools()).tools.map((tool) => tool.name);
  const checks = gameChecks();
  await runChecks(checks);
  for (const name of listed) {
    if (!checks.some((check) => check.tool === name))
      record(name, false, "no check covers this tool");
  }
  for (const name of new Set(checks.map((check) => check.tool))) {
    if (!listed.includes(name)) record(name, false, "the MCP server does not list this tool");
  }
}

let cleaning: Promise<void> | null = null;
function cleanup(): Promise<void> {
  cleaning ??= (async () => {
    await client?.close().catch(() => {});
    await server?.stop().catch(() => {});
    if (tempDir && !args.keep) await rm(tempDir, { recursive: true, force: true });
    else if (tempDir) console.log(`kept ${tempDir}`);
  })();
  return cleaning;
}

for (const [signal, code] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
] as const) {
  process.on(signal, () => {
    interrupted = true;
    signalExitCode = code;
    console.error(`${signal}: stopping the servers`);
    void cleanup().finally(() => process.exit(code));
  });
}

function tail(title: string, lines: string[]): void {
  console.log(`--- last lines of ${title}`);
  for (const line of lines.slice(-15)) console.log(line);
}

try {
  await main();
} catch (error) {
  record("(setup)", false, error instanceof Error ? error.message : String(error));
}
const passed = results.length > 0 && results.every((result) => result.ok);
if (!passed && !interrupted) {
  if (server) tail("the Minecraft server log", server.log);
  tail("the MCP server log", mcpLog);
}
await cleanup();

const failures = results.filter((result) => !result.ok).length;
console.log(
  `${passed ? "PASSED" : "FAILED"}: ${results.length - failures} of ${results.length} checks passed on Minecraft ${args.version}`,
);

if (args.report) {
  const mineflayer = JSON.parse(
    readFileSync(join(REPO_ROOT, "node_modules", "mineflayer", "package.json"), "utf8"),
  ) as { version: string };
  const node = spawnSync("node", ["--version"], { encoding: "utf8" }).stdout.trim();
  const report = {
    version: args.version,
    date: new Date().toISOString(),
    mode: args["expect-refusal"] ? "refusal" : "game",
    mineflayer: mineflayer.version,
    node,
    java: javaVersionText,
    passed,
    checks: results,
  };
  await writeFile(args.report, `${JSON.stringify(report, null, 2)}\n`);
}

process.exit(signalExitCode ?? (passed ? 0 : 1));
