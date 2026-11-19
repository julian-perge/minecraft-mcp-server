import { Vec3 } from "vec3";

export interface ExpectedBlock {
  x: number;
  y: number;
  z: number;
  name: string;
  properties?: Record<string, string>;
}

export interface WorldBlock {
  name: string;
  getProperties(): Record<string, unknown>;
}

export interface Mismatch {
  expected: ExpectedBlock;
  actual: { name: string; properties: Record<string, string> };
}

export interface ComparisonReport {
  total: number;
  matched: number;
  mismatches: Mismatch[];
  unloaded: ExpectedBlock[];
  outside: ExpectedBlock[];
}

export interface WorldHeight {
  minY: number;
  height: number;
}

// prismarine-block names have no namespace, so an expected name loses its minecraft: prefix before the compare.
export function bareName(name: string): string {
  return name.startsWith("minecraft:") ? name.slice("minecraft:".length) : name;
}

// Only the properties that the expected block names are compared, so an expected block without properties matches any state of that block.
// mineflayer has no block above or below the world height, the same answer as for an unloaded chunk, so the world height sorts those positions out first.
export function compareBlocks(
  expected: readonly ExpectedBlock[],
  lookup: (position: Vec3) => WorldBlock | null,
  worldHeight?: WorldHeight,
): ComparisonReport {
  const report: ComparisonReport = {
    total: expected.length,
    matched: 0,
    mismatches: [],
    unloaded: [],
    outside: [],
  };

  for (const block of expected) {
    if (
      worldHeight &&
      (block.y < worldHeight.minY || block.y >= worldHeight.minY + worldHeight.height)
    ) {
      report.outside.push(block);
      continue;
    }
    const actual = lookup(new Vec3(block.x, block.y, block.z));
    if (!actual) {
      report.unloaded.push(block);
      continue;
    }

    const actualProperties = Object.fromEntries(
      Object.entries(actual.getProperties()).map(([key, value]) => [key, String(value)]),
    );
    const sameName = bareName(block.name) === actual.name;
    const sameProperties = Object.entries(block.properties ?? {}).every(
      ([key, value]) => actualProperties[key] === value,
    );

    if (sameName && sameProperties) {
      report.matched += 1;
    } else {
      report.mismatches.push({
        expected: block,
        actual: { name: actual.name, properties: actualProperties },
      });
    }
  }

  return report;
}

function describeState(name: string, properties: Record<string, string> | undefined): string {
  const entries = Object.entries(properties ?? {});
  if (entries.length === 0) {
    return bareName(name);
  }
  return `${bareName(name)}[${entries.map(([key, value]) => `${key}=${value}`).join(",")}]`;
}

function describePosition(block: ExpectedBlock): string {
  return `(${block.x}, ${block.y}, ${block.z})`;
}

// The first line says PASS or FAIL, so an agent can read the result without the lists. A block in an unloaded chunk counts as a failure, because nothing proved it.
export function formatReport(report: ComparisonReport, maxListed: number): string {
  const passed = report.matched === report.total;
  const failParts = [
    `${report.mismatches.length} ${report.mismatches.length === 1 ? "differs" : "differ"}`,
  ];
  if (report.unloaded.length > 0) {
    failParts.push(
      `${report.unloaded.length} ${report.unloaded.length === 1 ? "is" : "are"} in chunks the bot has not loaded`,
    );
  }
  if (report.outside.length > 0) {
    failParts.push(
      `${report.outside.length} ${report.outside.length === 1 ? "is" : "are"} outside the world height`,
    );
  }
  const lines = [
    passed
      ? report.total === 1
        ? "PASS: the 1 block matches."
        : `PASS: all ${report.total} blocks match.`
      : `FAIL: ${report.matched} of ${report.total} ${report.total === 1 ? "block matches" : "blocks match"}, ${failParts.join(", ")}.`,
  ];

  if (report.mismatches.length > 0) {
    lines.push("Blocks that differ:");
    for (const mismatch of report.mismatches.slice(0, maxListed)) {
      const wanted = mismatch.expected;
      const relevant = Object.fromEntries(
        Object.keys(wanted.properties ?? {}).map((key) => [
          key,
          mismatch.actual.properties[key] ?? "(none)",
        ]),
      );
      lines.push(
        `- ${describePosition(wanted)}: expected ${describeState(wanted.name, wanted.properties)}, found ${describeState(mismatch.actual.name, relevant)}`,
      );
    }
    if (report.mismatches.length > maxListed) {
      lines.push(`- and ${report.mismatches.length - maxListed} more`);
    }
  }

  if (report.unloaded.length > 0) {
    lines.push("Blocks in chunks the bot has not loaded (move the bot closer):");
    for (const block of report.unloaded.slice(0, maxListed)) {
      lines.push(
        `- ${describePosition(block)}: expected ${describeState(block.name, block.properties)}`,
      );
    }
    if (report.unloaded.length > maxListed) {
      lines.push(`- and ${report.unloaded.length - maxListed} more`);
    }
  }

  if (report.outside.length > 0) {
    lines.push("Blocks outside the world height, which can never match:");
    for (const block of report.outside.slice(0, maxListed)) {
      lines.push(
        `- ${describePosition(block)}: expected ${describeState(block.name, block.properties)}`,
      );
    }
    if (report.outside.length > maxListed) {
      lines.push(`- and ${report.outside.length - maxListed} more`);
    }
  }

  return lines.join("\n");
}
