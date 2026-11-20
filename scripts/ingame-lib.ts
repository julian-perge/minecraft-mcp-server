import { createHash } from "node:crypto";

// Pure helpers for scripts/server-jar.ts and scripts/ingame-check.ts. tests/ingame-lib.test.ts covers them without a server or the network.

export function serverProperties(port: number): string {
  const properties: Record<string, string | number | boolean> = {
    "online-mode": false,
    "enforce-secure-profile": false,
    "server-ip": "127.0.0.1",
    "server-port": port,
    "level-type": "minecraft\\:flat",
    "generate-structures": false,
    "spawn-protection": 0,
    difficulty: "peaceful",
    "spawn-monsters": false,
    "view-distance": 4,
    "simulation-distance": 4,
    "max-players": 2,
    motd: "minecraft-mcp-server in-game check",
  };
  return Object.entries(properties)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
    .concat("\n");
}

// Java 8 and older print "1.8.0_292", and Java 9 and newer print "21.0.12" or "25", so the major version is the second number only for a leading "1.".
export function parseJavaMajor(versionOutput: string): number | null {
  const match = /version "(\d+)(?:\.(\d+))?[^"]*"/.exec(versionOutput);
  if (!match) return null;
  const first = Number(match[1]);
  return first === 1 && match[2] !== undefined ? Number(match[2]) : first;
}

export function javaEnvName(major: number): string {
  return `JAVA_HOME_${major}`;
}

export function sha1Hex(data: Uint8Array): string {
  return createHash("sha1").update(data).digest("hex");
}

export function sha1Mismatch(path: string, actual: string, expected: string): string | null {
  if (actual.toLowerCase() === expected.toLowerCase()) return null;
  return `SHA-1 mismatch for ${path}: expected ${expected}, got ${actual}. Delete the file and run again to download it again.`;
}

// A server log line looks like "[16:27:00] [Server thread/INFO]: Done (3.456s)! For help, type \"help\"", and the matchers read only the text after the first ": ". An offline server logs chat that has no signature, such as "<CheckBot> hello" or the "[Server] hello" of /say, with a "[Not Secure] " prefix, which this also removes.
export function logMessage(line: string): string {
  const match = /^\[[^\]]*\] \[[^\]]*\]: (.*)$/.exec(line);
  return (match?.[1] ?? line).replace(/^\[Not Secure\] /, "");
}

export function isDoneLine(line: string): boolean {
  return /^Done \(\d+(\.\d+)?s\)!/.test(logMessage(line));
}

export function isJoinedLine(line: string, username: string): boolean {
  return logMessage(line) === `${username} joined the game`;
}

export function isChatLine(line: string, username: string, text: string): boolean {
  return logMessage(line) === `<${username}> ${text}`;
}

export function isTestPassedLine(line: string): boolean {
  return /^Test passed\b/.test(logMessage(line));
}

export function isTestFailedLine(line: string): boolean {
  return /^Test failed\b/.test(logMessage(line));
}

export function isCommandErrorLine(line: string): boolean {
  return /^(Unknown or incomplete command|Incorrect argument for command|No player was found|No entity was found|Unknown item|Unknown block|.*<--\[HERE\])/.test(
    logMessage(line),
  );
}

export function isVersionName(version: string): boolean {
  return /^\d+(\.\d+)+(-[a-z]+(-\d+)?)?$/.test(version);
}
