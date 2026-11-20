import { readFile, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";
import nbt from "prismarine-nbt";

export const MAX_STRUCTURE_FILE_BYTES = 64 * 1024 * 1024;
export const MAX_STRUCTURE_BLOCKS = 1_000_000;
// A million blocks take about 40 MB of NBT, so this limit leaves room for block entity data and still stops a small gzip file that unpacks to gigabytes.
export const MAX_STRUCTURE_NBT_BYTES = 256 * 1024 * 1024;

const gunzipAsync = promisify(gunzip);

export interface StructureBlock {
  x: number;
  y: number;
  z: number;
  name: string;
  properties?: Record<string, string>;
}

export interface StructureTemplate {
  size: [number, number, number];
  blocks: StructureBlock[];
}

interface PaletteEntry {
  Name?: string;
  Properties?: Record<string, string>;
  id?: string;
  properties?: Record<string, string>;
}

interface TemplateBlock {
  pos: [number, number, number];
  state: number;
}

interface SimplifiedTemplate {
  size?: [number, number, number];
  palette?: PaletteEntry[];
  palettes?: PaletteEntry[][];
  blocks?: TemplateBlock[];
}

export async function readStructureFile(path: string): Promise<StructureTemplate> {
  const info = await stat(path);
  // A device or a pipe reports size 0 and can stream without end, so only a regular file passes.
  if (!info.isFile()) {
    throw new Error(`${path} is not a regular file.`);
  }
  if (info.size > MAX_STRUCTURE_FILE_BYTES) {
    throw new Error(
      `${path} is ${info.size} bytes, more than the limit of ${MAX_STRUCTURE_FILE_BYTES} bytes.`,
    );
  }
  return parseStructure(await readFile(path));
}

function isGzip(data: Buffer): boolean {
  return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
}

// Up to 26.1.2 a palette entry says Name and Properties. Structure Lab's main branch, which targets 26.3, writes id and properties, because 26.3 renamed them, so the reader takes either spelling.
export async function parseStructure(
  data: Buffer,
  maxNbtBytes = MAX_STRUCTURE_NBT_BYTES,
): Promise<StructureTemplate> {
  let raw = data;
  if (isGzip(data)) {
    try {
      raw = await gunzipAsync(data, { maxOutputLength: maxNbtBytes });
    } catch (error) {
      throw new Error(
        `The file does not unpack to at most ${maxNbtBytes} bytes of NBT: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  let template: SimplifiedTemplate;
  try {
    const { parsed } = await nbt.parse(raw, "big");
    template = nbt.simplify(parsed) as SimplifiedTemplate;
  } catch (error) {
    throw new Error(
      `The file is not a structure template in NBT: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // /place template picks one of several palettes at random, so the file cannot say which blocks the world should have.
  if (!template.palette && template.palettes && template.palettes.length > 1) {
    throw new Error(
      `The structure has ${template.palettes.length} palettes, and /place template picks one at random, so it cannot be compared block by block.`,
    );
  }
  const palette = template.palette ?? template.palettes?.[0];
  if (!template.size || !palette || !template.blocks) {
    throw new Error("The file is not a structure template: it needs size, palette and blocks.");
  }
  if (template.blocks.length > MAX_STRUCTURE_BLOCKS) {
    throw new Error(
      `The structure has ${template.blocks.length} blocks, more than the limit of ${MAX_STRUCTURE_BLOCKS}.`,
    );
  }

  const blocks: StructureBlock[] = [];
  for (const block of template.blocks) {
    const entry = palette[block.state];
    const name = entry?.Name ?? entry?.id;
    if (!name) {
      throw new Error(
        `Block at ${block.pos.join(", ")} points to palette entry ${block.state}, which has no name.`,
      );
    }
    // A structure void cell tells the game to keep the world's block, so it has nothing to compare.
    if (name === "minecraft:structure_void") {
      continue;
    }
    const properties = entry?.Properties ?? entry?.properties;
    const [x, y, z] = block.pos;
    blocks.push(properties ? { x, y, z, name, properties } : { x, y, z, name });
  }

  return { size: template.size, blocks };
}
