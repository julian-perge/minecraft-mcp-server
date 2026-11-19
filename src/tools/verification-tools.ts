import { isAbsolute } from "node:path";
import type mineflayer from "mineflayer";
import pathfinderPkg, { type Movements } from "mineflayer-pathfinder";
import { setImmediate as nextTurn } from "node:timers/promises";
import { z } from "zod";
import {
  compareBlocks,
  formatReport,
  type ExpectedBlock,
  type WorldHeight,
} from "../block-compare.js";
import { readStructureFile } from "../structure-file.js";
import type { ToolFactory } from "../tool-factory.js";

const { goals } = pathfinderPkg;

const MAX_LISTED = 20;
const MAX_MESSAGES = 50;

const coordinate = z.coerce.number().int();

// A copy of the bot's movements that only walks, jumps and climbs. The default movements also dig through blocks and build pillars, so a path through a wall would count as reachable.
function walkingMovements(movements: Movements): Movements {
  return Object.assign(Object.create(Object.getPrototypeOf(movements)) as Movements, movements, {
    canDig: false,
    allow1by1towers: false,
    scafoldingBlocks: [],
  });
}

const maxListed = z.coerce
  .number()
  .int()
  .min(1)
  .max(200)
  .default(MAX_LISTED)
  .describe("How many differing blocks to list at most");

// mineflayer's game plugin sets minY and height from the dimension (lib/plugins/game.js), but its GameState type leaves them out.
function worldHeight(bot: mineflayer.Bot): WorldHeight | undefined {
  const game = bot.game as (mineflayer.GameState & Partial<WorldHeight>) | undefined;
  return game?.minY !== undefined && game.height !== undefined
    ? { minY: game.minY, height: game.height }
    : undefined;
}

export function registerVerificationTools(
  factory: ToolFactory,
  getBot: () => mineflayer.Bot,
): void {
  factory.registerTool(
    "run-command",
    "Run one server command as the bot and return the messages that arrive within the wait time: the command's replies, and any chat that arrives meanwhile. The server's permissions decide which commands the bot may run, and most need the bot to be an operator.",
    {
      command: z
        .string()
        .min(1)
        .max(256)
        // The server disconnects a player that sends a control character or a section sign, so the tool refuses them before it sends anything.
        .refine(
          (command) =>
            ![...command].some((character) => {
              const code = character.charCodeAt(0);
              return code < 0x20 || code === 0x7f || code === 0xa7;
            }),
          "Use one line, without control characters or the section sign",
        )
        .describe(
          "The command, with or without the leading slash, for example: time query daytime",
        ),
      waitMs: z.coerce
        .number()
        .int()
        .min(0)
        .max(10_000)
        .default(1000)
        .describe("How long to collect replies, in milliseconds"),
    },
    async ({ command, waitMs }) => {
      const bot = getBot();
      const text = command.startsWith("/") ? command : `/${command}`;
      const messages: string[] = [];
      // Command replies arrive as system messages, and chat during the wait comes along, because a /say echo is a chat message too. The action bar (game_info) also uses this event but is never a reply, so it is left out.
      const collect = (message: string, position: string) => {
        if (position !== "game_info") {
          messages.push(message);
        }
      };

      bot.on("messagestr", collect);
      try {
        bot.chat(text);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      } finally {
        bot.removeListener("messagestr", collect);
      }

      const shown = messages.slice(0, MAX_MESSAGES);
      const lines = [
        `Sent ${text}. ${messages.length === 0 ? "No messages" : messages.length === 1 ? "1 message" : `${messages.length} messages`} arrived within ${waitMs} ms.`,
        ...shown.map((message) => `- ${message}`),
      ];
      if (messages.length > shown.length) {
        lines.push(`- and ${messages.length - shown.length} more`);
      }
      return factory.createResponse(lines.join("\n"));
    },
  );

  factory.registerTool(
    "check-blocks",
    "Check that the world has the expected blocks at the given positions. Answers PASS or FAIL first, then lists the blocks that differ and the blocks in chunks the bot has not loaded.",
    {
      blocks: z
        .array(
          z.object({
            x: coordinate,
            y: coordinate,
            z: coordinate,
            block: z
              .string()
              .min(1)
              .describe("Block name, for example minecraft:oak_stairs or oak_stairs"),
            properties: z
              .record(z.string(), z.string())
              .optional()
              .describe('Block state properties to compare, for example {"facing": "north"}'),
          }),
        )
        .min(1)
        .max(1000)
        .describe("The expected blocks"),
      maxListed,
    },
    async ({ blocks, maxListed }) => {
      const bot = getBot();
      const expected: ExpectedBlock[] = blocks.map(({ block, ...rest }) => ({
        ...rest,
        name: block,
      }));
      const report = compareBlocks(expected, (position) => bot.blockAt(position), worldHeight(bot));
      return factory.createResponse(formatReport(report, maxListed));
    },
  );

  factory.registerTool(
    "verify-structure",
    "Compare a structure template .nbt file, such as a Structure Lab export, with the blocks in the world where it was placed. The origin is the position that /place template used. Answers PASS or FAIL first, then lists the blocks that differ.",
    {
      path: z
        .string()
        .min(1)
        .refine((value) => isAbsolute(value), "Give an absolute path")
        .describe("Absolute path of the .nbt structure template file"),
      x: coordinate.describe("X of the origin where the template was placed"),
      y: coordinate.describe("Y of the origin where the template was placed"),
      z: coordinate.describe("Z of the origin where the template was placed"),
      maxListed,
    },
    async ({ path, x, y, z: originZ, maxListed }) => {
      const bot = getBot();
      const template = await readStructureFile(path);
      const expected: ExpectedBlock[] = template.blocks.map((block) => ({
        ...block,
        x: x + block.x,
        y: y + block.y,
        z: originZ + block.z,
      }));
      const report = compareBlocks(expected, (position) => bot.blockAt(position), worldHeight(bot));
      const [sizeX, sizeY, sizeZ] = template.size;
      return factory.createResponse(
        `${formatReport(report, maxListed)}\nTemplate: ${path}, size ${sizeX} x ${sizeY} x ${sizeZ}, origin (${x}, ${y}, ${originZ}).`,
      );
    },
  );

  factory.registerTool(
    "can-reach",
    "Check whether the bot can walk to a position, without moving it. Only walking, jumping and climbing count, not digging or building. Returns the pathfinder's result (success, timeout or noPath) and the length of the path.",
    {
      x: coordinate,
      y: coordinate,
      z: coordinate,
      range: z.coerce
        .number()
        .int()
        .min(0)
        .max(16)
        .default(1)
        .describe("How close to the position counts as reached, in blocks"),
      timeoutMs: z.coerce
        .number()
        .int()
        .min(100)
        .max(30_000)
        .default(5000)
        .describe("How long the pathfinder may search, in milliseconds"),
    },
    async ({ x, y, z: targetZ, range, timeoutMs }) => {
      const bot = getBot();
      // getPathTo stops after one slice of about 40 ms and then answers partial, so the tool runs every slice until the search ends. It waits for the event loop between slices to keep the connection alive.
      const search = bot.pathfinder.getPathFromTo(
        walkingMovements(bot.pathfinder.movements),
        bot.entity.position,
        new goals.GoalNear(x, y, targetZ, range),
        { timeout: timeoutMs },
      );
      let result: { status: string; path: unknown[] } = { status: "noPath", path: [] };
      for (const step of search) {
        result = step.result;
        if (result.status === "partial") {
          await nextTurn();
        }
      }
      const target = `(${x}, ${y}, ${targetZ})`;
      const start = bot.entity.position.floored();
      const from = `(${start.x}, ${start.y}, ${start.z})`;
      const verdict = result.status === "success" ? "PASS" : "FAIL";
      return factory.createResponse(
        `${verdict}: the path from ${from} to within ${range} ${range === 1 ? "block" : "blocks"} of ${target} is ${result.status}, with ${result.path.length} steps.`,
      );
    },
  );
}
