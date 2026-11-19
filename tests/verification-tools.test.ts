import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type mineflayer from "mineflayer";
import sinon from "sinon";
import { Vec3 } from "vec3";
import { registerVerificationTools } from "../src/tools/verification-tools.js";
import { connectTools, textOf } from "./helpers/mcp-client.js";
import { structureNbt } from "../scripts/structure-nbt.js";

function blockWorld(
  blocks: Record<string, { name: string; properties?: Record<string, unknown> }>,
) {
  return (position: Vec3) => {
    const block = blocks[`${position.x},${position.y},${position.z}`];
    return block ? { name: block.name, getProperties: () => block.properties ?? {} } : null;
  };
}

async function toolsFor(bot: object) {
  return connectTools((factory) => registerVerificationTools(factory, () => bot as mineflayer.Bot));
}

test("registers the four verification tools", async () => {
  const tools = await toolsFor({});

  const { tools: listed } = await tools.listTools();

  expect(listed.map((tool) => tool.name).sort()).toStrictEqual([
    "can-reach",
    "check-blocks",
    "run-command",
    "verify-structure",
  ]);
  await tools.close();
});

test("run-command adds the slash and returns the messages, without the action bar", async () => {
  const bot = Object.assign(new EventEmitter(), {
    chat: sinon.stub().callsFake(function (this: EventEmitter) {
      bot.emit("messagestr", "The time is 1000", "system");
      bot.emit("messagestr", "Sleeping", "game_info");
    }),
  });
  const tools = await toolsFor(bot);

  const result = await tools.call("run-command", { command: "time query daytime", waitMs: 0 });

  expect(bot.chat.calledOnceWith("/time query daytime")).toBe(true);
  expect(textOf(result)).toBe(
    "Sent /time query daytime. 1 message arrived within 0 ms.\n- The time is 1000",
  );
  expect(bot.listenerCount("messagestr")).toBe(0);
  await tools.close();
});

test("run-command says when no message arrived", async () => {
  const bot = Object.assign(new EventEmitter(), { chat: sinon.stub() });
  const tools = await toolsFor(bot);

  const result = await tools.call("run-command", { command: "/say hi", waitMs: 0 });

  expect(bot.chat.calledOnceWith("/say hi")).toBe(true);
  expect(textOf(result)).toBe("Sent /say hi. No messages arrived within 0 ms.");
  await tools.close();
});

test("run-command refuses a command with a line break, which would make the server kick the bot", async () => {
  const bot = Object.assign(new EventEmitter(), { chat: sinon.stub() });
  const tools = await toolsFor(bot);

  const result = await tools.call("run-command", { command: "say hi\nop someone" });

  expect(result.isError).toBe(true);
  expect(textOf(result)).toContain("Use one line");
  expect(bot.chat.notCalled).toBe(true);
  await tools.close();
});

test("run-command refuses a wait over 10 seconds", async () => {
  const tools = await toolsFor({});

  const result = await tools.call("run-command", { command: "list", waitMs: 10_001 });

  expect(result.isError).toBe(true);
  expect(textOf(result)).toContain("Invalid arguments for tool run-command");
  await tools.close();
});

test("check-blocks passes when every block matches", async () => {
  const bot = { blockAt: blockWorld({ "1,64,2": { name: "oak_planks" } }) };
  const tools = await toolsFor(bot);

  const result = await tools.call("check-blocks", {
    blocks: [{ x: 1, y: 64, z: 2, block: "minecraft:oak_planks" }],
  });

  expect(textOf(result)).toBe("PASS: the 1 block matches.");
  await tools.close();
});

test("check-blocks fails and lists a block with the wrong state", async () => {
  const bot = {
    blockAt: blockWorld({ "1,64,2": { name: "oak_stairs", properties: { facing: "east" } } }),
  };
  const tools = await toolsFor(bot);

  const result = await tools.call("check-blocks", {
    blocks: [{ x: 1, y: 64, z: 2, block: "oak_stairs", properties: { facing: "west" } }],
  });

  expect(textOf(result)).toContain("FAIL: 0 of 1 block matches, 1 differs.");
  expect(textOf(result)).toContain(
    "expected oak_stairs[facing=west], found oak_stairs[facing=east]",
  );
  await tools.close();
});

test("verify-structure offsets the template by the origin and compares every block", async () => {
  const dir = mkdtempSync(join(tmpdir(), "verify-structure-"));
  const path = join(dir, "house.nbt");
  writeFileSync(
    path,
    structureNbt(
      [2, 1, 1],
      [
        { pos: [0, 0, 0], name: "minecraft:stone" },
        { pos: [1, 0, 0], name: "minecraft:glass" },
      ],
    ),
  );
  const bot = {
    blockAt: blockWorld({ "10,64,20": { name: "stone" }, "11,64,20": { name: "dirt" } }),
  };
  const tools = await toolsFor(bot);

  const result = await tools.call("verify-structure", { path, x: 10, y: 64, z: 20 });

  expect(textOf(result)).toBe(
    [
      "FAIL: 1 of 2 blocks match, 1 differs.",
      "Blocks that differ:",
      "- (11, 64, 20): expected glass, found dirt",
      `Template: ${path}, size 2 x 1 x 1, origin (10, 64, 20).`,
    ].join("\n"),
  );
  await tools.close();
});

test("verify-structure returns the reader's error for a missing file", async () => {
  const tools = await toolsFor({ blockAt: () => null });

  const result = await tools.call("verify-structure", {
    path: "/nonexistent/house.nbt",
    x: 0,
    y: 0,
    z: 0,
  });

  expect(result.isError).toBe(true);
  expect(textOf(result)).toContain("ENOENT");
  await tools.close();
});

// The pathfinder's search yields partial after each slice of work and ends with one final status.
function pathSearch(statuses: string[]) {
  return sinon.stub().callsFake(function* () {
    for (const status of statuses) {
      yield { result: { status, path: [1, 2, 3] } };
    }
  });
}

for (const [status, verdict] of [
  ["success", "PASS"],
  ["timeout", "FAIL"],
  ["noPath", "FAIL"],
] as const) {
  test(`can-reach answers ${verdict} for a ${status} path and does not move the bot`, async () => {
    const getPathFromTo = pathSearch([status]);
    const goto = sinon.stub();
    const movements = { canDig: true, allow1by1towers: true, scafoldingBlocks: [1, 2] };
    const bot = {
      entity: { position: new Vec3(0.5, 64, 0.5) },
      pathfinder: { movements, getPathFromTo, goto },
    };
    const tools = await toolsFor(bot);

    const result = await tools.call("can-reach", { x: 5, y: 64, z: 6, range: 2, timeoutMs: 1000 });

    expect(textOf(result)).toBe(
      `${verdict}: the path from (0, 64, 0) to within 2 blocks of (5, 64, 6) is ${status}, with 3 steps.`,
    );
    const [, , goal, options] = getPathFromTo.firstCall.args;
    expect([goal.x, goal.y, goal.z, goal.rangeSq]).toStrictEqual([5, 64, 6, 4]);
    expect(options).toStrictEqual({ timeout: 1000 });
    expect(goto.notCalled).toBe(true);
    await tools.close();
  });
}

test("can-reach runs every slice of the search until it ends", async () => {
  const getPathFromTo = pathSearch(["partial", "partial", "success"]);
  const bot = {
    entity: { position: new Vec3(0.5, 64, 0.5) },
    pathfinder: { movements: {}, getPathFromTo },
  };
  const tools = await toolsFor(bot);

  const result = await tools.call("can-reach", { x: 5, y: 64, z: 6 });

  expect(textOf(result)).toStartWith("PASS:");
  expect(textOf(result)).toContain("is success");
  await tools.close();
});

test("can-reach only walks: it does not dig or build, and keeps the bot's own movements", async () => {
  const getPathFromTo = pathSearch(["success"]);
  const movements = {
    canDig: true,
    allow1by1towers: true,
    scafoldingBlocks: [1, 2],
    maxDropDown: 4,
  };
  const bot = {
    entity: { position: new Vec3(0.5, 64, 0.5) },
    pathfinder: { movements, getPathFromTo },
  };
  const tools = await toolsFor(bot);

  await tools.call("can-reach", { x: 5, y: 64, z: 6 });

  const used = getPathFromTo.firstCall.args[0];
  expect([
    used.canDig,
    used.allow1by1towers,
    used.scafoldingBlocks,
    used.maxDropDown,
  ]).toStrictEqual([false, false, [], 4]);
  expect(movements.canDig).toBe(true);
  expect(movements.scafoldingBlocks).toStrictEqual([1, 2]);
  await tools.close();
});

test("verify-structure refuses a relative path", async () => {
  const tools = await toolsFor({ blockAt: () => null });

  const result = await tools.call("verify-structure", { path: "house.nbt", x: 0, y: 0, z: 0 });

  expect(result.isError).toBe(true);
  expect(textOf(result)).toContain("Give an absolute path");
  await tools.close();
});

test("check-blocks reports a block above the world height, not an unloaded chunk", async () => {
  const bot = { blockAt: () => null, game: { minY: -64, height: 384 } };
  const tools = await toolsFor(bot);

  const result = await tools.call("check-blocks", {
    blocks: [{ x: 0, y: 400, z: 0, block: "stone" }],
  });

  expect(textOf(result)).toContain(
    "FAIL: 0 of 1 block matches, 0 differ, 1 is outside the world height.",
  );
  await tools.close();
});
