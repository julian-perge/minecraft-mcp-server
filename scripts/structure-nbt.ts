import { gzipSync } from "node:zlib";
import nbt from "prismarine-nbt";

export interface FixtureBlock {
  pos: [number, number, number];
  name: string;
  properties?: Record<string, string>;
}

// Writes a structure template the way the game saves one. spelling "26.3" uses id and properties, the keys that Structure Lab's 26.3 branch writes.
export function structureNbt(
  size: [number, number, number],
  blocks: FixtureBlock[],
  options: { spelling?: "1.21" | "26.3"; gzip?: boolean } = {},
): Buffer {
  const nameKey = options.spelling === "26.3" ? "id" : "Name";
  const propertiesKey = options.spelling === "26.3" ? "properties" : "Properties";
  const states: string[] = [];
  const palette: Record<string, unknown>[] = [];
  const stateOf = (block: FixtureBlock) => {
    const key = JSON.stringify([block.name, block.properties ?? {}]);
    let index = states.indexOf(key);
    if (index === -1) {
      index = states.push(key) - 1;
      const entry: Record<string, unknown> = { [nameKey]: nbt.string(block.name) };
      if (block.properties) {
        entry[propertiesKey] = nbt.comp(
          Object.fromEntries(Object.entries(block.properties).map(([k, v]) => [k, nbt.string(v)])),
        );
      }
      palette.push(entry);
    }
    return index;
  };
  const blockTags = blocks.map((block) => ({
    pos: nbt.list(nbt.int(block.pos)),
    state: nbt.int(stateOf(block)),
  }));

  const root = nbt.comp(
    {
      DataVersion: nbt.int(4671),
      size: nbt.list(nbt.int(size)),
      palette: nbt.list(nbt.comp(palette)),
      blocks: nbt.list(nbt.comp(blockTags)),
      entities: nbt.list(nbt.comp([])),
    },
    "",
  );
  const raw = nbt.writeUncompressed(root as unknown as nbt.NBT, "big");
  return options.gzip === false ? raw : gzipSync(raw);
}
