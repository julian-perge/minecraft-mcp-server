import type mineflayer from "mineflayer";
import pathfinderPkg from "mineflayer-pathfinder";
import { z } from "zod";
import { compareBlocks, formatReport, type ExpectedBlock } from "../block-compare.js";
import { readStructureFile } from "../structure-file.js";
import type { ToolFactory } from "../tool-factory.js";

const { goals } = pathfinderPkg;

const MAX_LISTED = 20;
const MAX_MESSAGES = 50;

const coordinate = z.coerce.number().int();
const maxListed = z.coerce
  .number()
  .int()
  .min(1)
  .max(200)
  .default(MAX_LISTED)
  .describe("How many differing blocks to list at most");

export function registerVerificationTools(
  factory: ToolFactory,
  getBot: () => mineflayer.Bot,
): void {
  factory.registerTool(
    "run-command",
    "Run one server command as the bot and return the system messages that arrive within the wait time. The server's permissions decide which commands the bot may run, and most need the bot to be an operator.",
    {
      command: z
        .string()
        .min(1)
        .max(256)
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
      // Command replies arrive as system messages. The action bar (game_info) also uses that path but is never a reply, so it is left out.
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
        `Sent ${text}. ${messages.length === 0 ? "No messages" : `${messages.length} messages`} arrived within ${waitMs} ms.`,
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
      const report = compareBlocks(expected, (position) => bot.blockAt(position));
      return factory.createResponse(formatReport(report, maxListed));
    },
  );

  factory.registerTool(
    "verify-structure",
    "Compare a structure template .nbt file, such as a Structure Lab export, with the blocks in the world where it was placed. The origin is the position that /place template used. Answers PASS or FAIL first, then lists the blocks that differ.",
    {
      path: z.string().min(1).describe("Absolute path of the .nbt structure template file"),
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
      const report = compareBlocks(expected, (position) => bot.blockAt(position));
      const [sizeX, sizeY, sizeZ] = template.size;
      return factory.createResponse(
        `${formatReport(report, maxListed)}\nTemplate: ${path}, size ${sizeX} x ${sizeY} x ${sizeZ}, origin (${x}, ${y}, ${originZ}).`,
      );
    },
  );

  factory.registerTool(
    "can-reach",
    "Check whether the bot can walk to a position, without moving it. Returns the pathfinder's result (success, partial, timeout or noPath) and the length of the path.",
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
      const result = bot.pathfinder.getPathTo(
        bot.pathfinder.movements,
        new goals.GoalNear(x, y, targetZ, range),
        timeoutMs,
      );
      const target = `(${x}, ${y}, ${targetZ})`;
      const start = bot.entity.position.floored();
      const from = `(${start.x}, ${start.y}, ${start.z})`;
      const verdict = result.status === "success" ? "PASS" : "FAIL";
      return factory.createResponse(
        `${verdict}: the path from ${from} to within ${range} blocks of ${target} is ${result.status}, with ${result.path.length} steps.`,
      );
    },
  );
}
