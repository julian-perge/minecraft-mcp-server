import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import nbt from "prismarine-nbt";
import { parseStructure, readStructureFile } from "../src/structure-file.ts";
import { structureNbt } from "../scripts/structure-nbt.ts";

const blocks = [
  { pos: [0, 0, 0] as [number, number, number], name: "minecraft:stone" },
  {
    pos: [1, 0, 0] as [number, number, number],
    name: "minecraft:oak_stairs",
    properties: { facing: "north", half: "bottom" },
  },
  { pos: [0, 1, 0] as [number, number, number], name: "minecraft:structure_void" },
];

const expected = [
  { x: 0, y: 0, z: 0, name: "minecraft:stone" },
  {
    x: 1,
    y: 0,
    z: 0,
    name: "minecraft:oak_stairs",
    properties: { facing: "north", half: "bottom" },
  },
];

test("reads a gzip template with Name and Properties", async () => {
  const template = await parseStructure(structureNbt([2, 2, 1], blocks));

  expect(template.size).toStrictEqual([2, 2, 1]);
  expect(template.blocks).toStrictEqual(expected);
});

test("reads a plain template with the 26.3 spelling id and properties", async () => {
  const template = await parseStructure(
    structureNbt([2, 2, 1], blocks, { spelling: "26.3", gzip: false }),
  );

  expect(template.blocks).toStrictEqual(expected);
});

test("skips structure_void cells", async () => {
  const template = await parseStructure(structureNbt([2, 2, 1], blocks));

  expect(template.blocks.some((block) => block.name === "minecraft:structure_void")).toBe(false);
});

test("reads a template from a file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "structure-file-"));
  const path = join(dir, "house.nbt");
  writeFileSync(path, structureNbt([2, 2, 1], blocks));

  const template = await readStructureFile(path);

  expect(template.blocks).toHaveLength(2);
});

test("refuses a file that is not NBT", async () => {
  await expect(parseStructure(Buffer.from("not nbt at all"))).rejects.toThrow(
    "The file is not a structure template in NBT",
  );
});

test("reads a template with no blocks", async () => {
  const template = await parseStructure(structureNbt([1, 1, 1], []));

  expect(template.blocks).toStrictEqual([]);
});

test("refuses NBT that has no palette or blocks", async () => {
  const root = nbt.comp({ size: nbt.list(nbt.int([1, 1, 1])) }, "");
  const data = nbt.writeUncompressed(root as unknown as nbt.NBT, "big");

  await expect(parseStructure(data)).rejects.toThrow("it needs size, palette and blocks");
});

test("refuses a gzip file that unpacks to more than the limit", async () => {
  await expect(parseStructure(structureNbt([1, 1, 1], blocks), 16)).rejects.toThrow(
    "The file does not unpack to at most 16 bytes of NBT",
  );
});

test("refuses a path that is not a regular file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "structure-file-"));

  await expect(readStructureFile(dir)).rejects.toThrow("is not a regular file");
});

test("refuses a missing file with the system error", async () => {
  await expect(readStructureFile("/nonexistent/house.nbt")).rejects.toThrow("ENOENT");
});

test("refuses a template with several palettes, since /place template picks one at random", async () => {
  const stonePalette = { type: "compound", value: [{ Name: nbt.string("minecraft:stone") }] };
  const root = nbt.comp(
    {
      size: nbt.list(nbt.int([1, 1, 1])),
      palettes: { type: "list", value: { type: "list", value: [stonePalette, stonePalette] } },
      blocks: nbt.list(nbt.comp([{ pos: nbt.list(nbt.int([0, 0, 0])), state: nbt.int(0) }])),
    },
    "",
  );
  const data = nbt.writeUncompressed(root as unknown as nbt.NBT, "big");

  await expect(parseStructure(data)).rejects.toThrow("The structure has 2 palettes");
});
