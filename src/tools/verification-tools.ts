import type mineflayer from "mineflayer";
import { z } from "zod";
import { compareBlocks, formatReport, type ExpectedBlock } from "../block-compare.js";
import { readStructureFile } from "../structure-file.js";
import type { ToolFactory } from "../tool-factory.js";

const MAX_LISTED = 20;

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
}
