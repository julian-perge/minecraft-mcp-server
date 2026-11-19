import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type mineflayer from "mineflayer";
import { Vec3 } from "vec3";
import { registerVerificationTools } from "../src/tools/verification-tools.js";
import { connectTools, textOf } from "./helpers/mcp-client.js";
import { structureNbt } from "./helpers/structure-nbt.js";

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

test("registers the verification tools", async () => {
  const tools = await toolsFor({});

  const { tools: listed } = await tools.listTools();

  expect(listed.map((tool) => tool.name).sort()).toStrictEqual([
    "check-blocks",
    "verify-structure",
  ]);
  await tools.close();
});

test("check-blocks passes when every block matches", async () => {
  const bot = { blockAt: blockWorld({ "1,64,2": { name: "oak_planks" } }) };
  const tools = await toolsFor(bot);

  const result = await tools.call("check-blocks", {
    blocks: [{ x: 1, y: 64, z: 2, block: "minecraft:oak_planks" }],
  });

  expect(textOf(result)).toBe("PASS: all 1 blocks match.");
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

  expect(textOf(result)).toContain("FAIL: 0 of 1 blocks match");
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
      "FAIL: 1 of 2 blocks match, 1 differ, 0 are in chunks the bot has not loaded.",
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
