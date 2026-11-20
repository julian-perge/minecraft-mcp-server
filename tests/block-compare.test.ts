import { expect, test } from "bun:test";
import type { Vec3 } from "vec3";
import { compareBlocks, formatReport, type WorldBlock } from "../src/block-compare.ts";

function world(blocks: Record<string, WorldBlock>) {
  return (position: Vec3) => blocks[`${position.x},${position.y},${position.z}`] ?? null;
}

const stone: WorldBlock = { name: "stone", getProperties: () => ({}) };
const stairs: WorldBlock = {
  name: "oak_stairs",
  getProperties: () => ({ facing: "north", half: "bottom", waterlogged: false }),
};

test("matches names with or without the minecraft: prefix", () => {
  const report = compareBlocks(
    [
      { x: 0, y: 0, z: 0, name: "minecraft:stone" },
      { x: 1, y: 0, z: 0, name: "oak_stairs" },
    ],
    world({ "0,0,0": stone, "1,0,0": stairs }),
  );

  expect(report).toStrictEqual({
    total: 2,
    matched: 2,
    mismatches: [],
    unloaded: [],
    outside: [],
  });
  expect(formatReport(report, 20)).toBe("PASS: all 2 blocks match.");
});

test("compares only the properties that the expected block names, as strings", () => {
  const report = compareBlocks(
    [
      {
        x: 1,
        y: 0,
        z: 0,
        name: "oak_stairs",
        properties: { facing: "north", waterlogged: "false" },
      },
    ],
    world({ "1,0,0": stairs }),
  );

  expect(report.matched).toBe(1);
});

test("reports a block with the wrong name", () => {
  const report = compareBlocks(
    [{ x: 0, y: 0, z: 0, name: "minecraft:dirt" }],
    world({ "0,0,0": stone }),
  );

  expect(report.matched).toBe(0);
  expect(formatReport(report, 20)).toBe(
    [
      "FAIL: 0 of 1 block matches, 1 differs.",
      "Blocks that differ:",
      "- (0, 0, 0): expected dirt, found stone",
    ].join("\n"),
  );
});

test("reports a block with a wrong property and shows the found value", () => {
  const report = compareBlocks(
    [{ x: 1, y: 0, z: 0, name: "oak_stairs", properties: { facing: "south" } }],
    world({ "1,0,0": stairs }),
  );

  expect(formatReport(report, 20)).toContain(
    "- (1, 0, 0): expected oak_stairs[facing=south], found oak_stairs[facing=north]",
  );
});

test("reports a block in an unloaded chunk as not proven", () => {
  const report = compareBlocks([{ x: 900, y: 64, z: 900, name: "stone" }], world({}));

  expect(report.unloaded).toHaveLength(1);
  expect(formatReport(report, 20)).toBe(
    [
      "FAIL: 0 of 1 block matches, 0 differ, 1 is in chunks the bot has not loaded.",
      "Blocks in chunks the bot has not loaded (move the bot closer):",
      "- (900, 64, 900): expected stone",
    ].join("\n"),
  );
});

test("caps each list and says how many more there are", () => {
  const expected = Array.from({ length: 5 }, (_, x) => ({ x, y: 0, z: 0, name: "dirt" }));
  const report = compareBlocks(
    expected,
    world({ "0,0,0": stone, "1,0,0": stone, "2,0,0": stone, "3,0,0": stone, "4,0,0": stone }),
  );

  const text = formatReport(report, 2);

  expect(text.split("\n").filter((line) => line.startsWith("- ("))).toHaveLength(2);
  expect(text).toContain("- and 3 more");
});

test("reports a position outside the world height instead of an unloaded chunk", () => {
  const report = compareBlocks(
    [
      { x: 0, y: 320, z: 0, name: "stone" },
      { x: 0, y: -65, z: 0, name: "stone" },
      { x: 0, y: 0, z: 0, name: "stone" },
    ],
    world({ "0,0,0": stone }),
    { minY: -64, height: 384 },
  );

  expect(formatReport(report, 20)).toBe(
    [
      "FAIL: 1 of 3 blocks match, 0 differ, 2 are outside the world height.",
      "Blocks outside the world height, which can never match:",
      "- (0, 320, 0): expected stone",
      "- (0, -65, 0): expected stone",
    ].join("\n"),
  );
});

test("says the 1 block matches in the singular", () => {
  const report = compareBlocks([{ x: 0, y: 0, z: 0, name: "stone" }], world({ "0,0,0": stone }));

  expect(formatReport(report, 20)).toBe("PASS: the 1 block matches.");
});
