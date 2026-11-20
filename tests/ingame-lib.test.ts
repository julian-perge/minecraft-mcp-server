import { describe, expect, test } from "bun:test";
import {
  isChatLine,
  isCommandErrorLine,
  isDoneLine,
  isJoinedLine,
  isTestFailedLine,
  isTestPassedLine,
  isVersionName,
  javaEnvName,
  logMessage,
  parseJavaMajor,
  serverProperties,
  sha1Hex,
  sha1Mismatch,
} from "../scripts/ingame-lib.ts";

describe("serverProperties", () => {
  const lines = serverProperties(25599).trimEnd().split("\n");

  test("sets offline mode, the port and a flat, peaceful world", () => {
    expect(lines).toContain("online-mode=false");
    expect(lines).toContain("server-port=25599");
    expect(lines).toContain("level-type=minecraft\\:flat");
    expect(lines).toContain("difficulty=peaceful");
    expect(lines).toContain("spawn-monsters=false");
    expect(lines).toContain("spawn-protection=0");
    expect(lines).toContain("generate-structures=false");
  });

  test("writes one key=value pair per line and ends with a newline", () => {
    expect(serverProperties(1).endsWith("\n")).toBe(true);
    for (const line of lines) expect(line).toMatch(/^[a-z-]+=.+$/);
  });
});

describe("parseJavaMajor", () => {
  test("reads Java 9 and newer", () => {
    expect(parseJavaMajor('openjdk version "25.0.4" 2026-07-21 LTS')).toBe(25);
    expect(parseJavaMajor('openjdk version "21.0.12" 2026-07-21 LTS')).toBe(21);
    expect(parseJavaMajor('openjdk version "21" 2023-09-19')).toBe(21);
  });

  test("reads the 1.x scheme of Java 8 and older", () => {
    expect(parseJavaMajor('java version "1.8.0_292"')).toBe(8);
  });

  test("returns null for output with no version", () => {
    expect(parseJavaMajor("command not found")).toBeNull();
  });
});

test("javaEnvName names the JAVA_HOME variable of a major version", () => {
  expect(javaEnvName(21)).toBe("JAVA_HOME_21");
});

describe("SHA-1", () => {
  test("sha1Hex hashes bytes", () => {
    expect(sha1Hex(new TextEncoder().encode("abc"))).toBe(
      "a9993e364706816aba3e25717850c26c9cd0d89d",
    );
  });

  test("sha1Mismatch is null when the hashes match in any case", () => {
    expect(sha1Mismatch("server.jar", "ABC123", "abc123")).toBeNull();
  });

  test("sha1Mismatch names the file and both hashes when they differ", () => {
    const message = sha1Mismatch("server.jar", "aaa", "bbb");
    expect(message).toContain("server.jar");
    expect(message).toContain("expected bbb, got aaa");
  });
});

describe("log line matchers", () => {
  const line = (message: string) => `[16:27:00] [Server thread/INFO]: ${message}`;

  test("logMessage removes the time, the thread and the Not Secure prefix", () => {
    expect(logMessage(line("Test passed"))).toBe("Test passed");
    expect(logMessage(line("[Not Secure] [Server] hello"))).toBe("[Server] hello");
    expect(logMessage("no prefix")).toBe("no prefix");
  });

  test("isDoneLine matches the line that ends the server start", () => {
    expect(isDoneLine(line('Done (0.239s)! For help, type "help"'))).toBe(true);
    expect(isDoneLine(line("Preparing spawn area: 100%"))).toBe(false);
  });

  test("isJoinedLine matches only the named player", () => {
    expect(isJoinedLine(line("CheckBot joined the game"), "CheckBot")).toBe(true);
    expect(isJoinedLine(line("Other joined the game"), "CheckBot")).toBe(false);
  });

  test("isChatLine matches signed and unsigned chat from the named player", () => {
    expect(isChatLine(line("<CheckBot> hi"), "CheckBot", "hi")).toBe(true);
    expect(isChatLine(line("[Not Secure] <CheckBot> hi"), "CheckBot", "hi")).toBe(true);
    expect(isChatLine(line("<Other> hi"), "CheckBot", "hi")).toBe(false);
  });

  test("the test matchers read the replies of execute if", () => {
    expect(isTestPassedLine(line("Test passed"))).toBe(true);
    expect(isTestPassedLine(line("Test passed. Count: 9"))).toBe(true);
    expect(isTestFailedLine(line("Test failed"))).toBe(true);
    expect(isTestPassedLine(line("Test failed"))).toBe(false);
  });

  test("isCommandErrorLine matches the replies of a bad command", () => {
    expect(isCommandErrorLine(line("Unknown or incomplete command, see below for error"))).toBe(
      true,
    );
    expect(isCommandErrorLine(line("No player was found"))).toBe(true);
    expect(isCommandErrorLine(line("...ock 1 2 3 minecraft:nope<--[HERE]"))).toBe(true);
    expect(isCommandErrorLine(line("Gave 9 [Oak Planks] to CheckBot"))).toBe(false);
  });
});

describe("isVersionName", () => {
  test("accepts release, release candidate and snapshot names", () => {
    for (const name of ["1.21.11", "26.1.2", "26.3", "26.3-rc-3", "26.4-snapshot-6"]) {
      expect(isVersionName(name)).toBe(true);
    }
  });

  test("refuses a name that could leave the cache folder", () => {
    for (const name of ["../x", "26.1/../../etc", "", "latest", "/tmp"]) {
      expect(isVersionName(name)).toBe(false);
    }
  });
});
