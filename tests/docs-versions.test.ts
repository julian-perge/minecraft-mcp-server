import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { SUPPORTED_VERSIONS, UNSUPPORTED_VERSIONS } from "../src/minecraft-versions.js";

const supported = SUPPORTED_VERSIONS.map((entry) => entry.version);
const unsupported = UNSUPPORTED_VERSIONS.map((entry) => entry.version);

function section(path: string, heading: string): string {
  const text = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  return text.split(`## ${heading}`)[1]?.split("\n## ")[0] ?? "";
}

function tableRows(path: string, heading: string): string[][] {
  return section(path, heading)
    .split("\n")
    .filter(
      (line) => line.startsWith("| ") && !line.startsWith("| ---") && !line.startsWith("| Version"),
    )
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
}

// The docs claim support in prose, so these tests tie each claim to the list in src/minecraft-versions.ts.
test("README.md marks exactly the versions in the supported list as supported", () => {
  const rows = tableRows("README.md", "Minecraft versions");

  expect(
    rows.filter(([, status]) => status.startsWith("Supported.")).map(([version]) => version),
  ).toStrictEqual(supported);
  expect(
    rows
      .filter(([, status]) => !status.startsWith("Supported."))
      .map(([version]) => version)
      .sort(),
  ).toStrictEqual([...unsupported].sort());
});

test("docs/verification.md has a passed game check for each supported version and a refusal check for 26.3", () => {
  const rows = tableRows("docs/verification.md", "Results");
  const byVersion = new Map(rows.map(([version, check, result]) => [version, { check, result }]));

  for (const version of supported) {
    expect(byVersion.get(version)?.check).toBe("every tool");
    expect(byVersion.get(version)?.result).toMatch(/^(\d+) of \1 passed$/);
  }
  expect(byVersion.get("26.3")?.check).toBe("refusal");
  expect(byVersion.get("26.3")?.result).toMatch(/^(\d+) of \1 passed$/);
});

test("AGENTS.md claims the versions in the supported list", () => {
  const text = section("AGENTS.md", "Minecraft versions").replace(/\s+/g, " ");
  const names =
    supported.length === 1
      ? supported[0]
      : `${supported.slice(0, -1).join(", ")} and ${supported.at(-1)}`;

  expect(text).toContain(`The bot supports Minecraft ${names}.`);
});
