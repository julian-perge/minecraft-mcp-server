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
}

// prismarine-block names have no namespace, so an expected name loses its minecraft: prefix before the compare.
export function bareName(name: string): string {
  return name.startsWith("minecraft:") ? name.slice("minecraft:".length) : name;
}

// Only the properties that the expected block names are compared, so an expected block without properties matches any state of that block.
export function compareBlocks(
  expected: readonly ExpectedBlock[],
  lookup: (position: Vec3) => WorldBlock | null,
): ComparisonReport {
  const report: ComparisonReport = {
    total: expected.length,
    matched: 0,
    mismatches: [],
    unloaded: [],
  };

  for (const block of expected) {
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
  const lines = [
    passed
      ? `PASS: all ${report.total} blocks match.`
      : `FAIL: ${report.matched} of ${report.total} blocks match, ${report.mismatches.length} differ, ${report.unloaded.length} are in chunks the bot has not loaded.`,
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

  return lines.join("\n");
}
