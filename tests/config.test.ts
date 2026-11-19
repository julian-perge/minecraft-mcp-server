import { test, expect } from "bun:test";
import { parseConfig } from "../src/config.js";

test("parseConfig returns default values", () => {
  const originalArgv = process.argv;
  process.argv = ["node", "script.js"];

  const config = parseConfig();

  expect(config.host).toBe("localhost");
  expect(config.port).toBe(25565);
  expect(config.username).toBe("LLMBot");

  process.argv = originalArgv;
});

test("parseConfig parses custom host", () => {
  const originalArgv = process.argv;
  process.argv = ["node", "script.js", "--host", "example.com"];

  const config = parseConfig();

  expect(config.host).toBe("example.com");
  expect(config.port).toBe(25565);
  expect(config.username).toBe("LLMBot");

  process.argv = originalArgv;
});

test("parseConfig parses custom port", () => {
  const originalArgv = process.argv;
  process.argv = ["node", "script.js", "--port", "12345"];

  const config = parseConfig();

  expect(config.host).toBe("localhost");
  expect(config.port).toBe(12345);
  expect(config.username).toBe("LLMBot");

  process.argv = originalArgv;
});

test("parseConfig parses custom username", () => {
  const originalArgv = process.argv;
  process.argv = ["node", "script.js", "--username", "CustomBot"];

  const config = parseConfig();

  expect(config.host).toBe("localhost");
  expect(config.port).toBe(25565);
  expect(config.username).toBe("CustomBot");

  process.argv = originalArgv;
});

test("parseConfig parses all custom options", () => {
  const originalArgv = process.argv;
  process.argv = [
    "node",
    "script.js",
    "--host",
    "server.net",
    "--port",
    "9999",
    "--username",
    "TestBot",
  ];

  const config = parseConfig();

  expect(config.host).toBe("server.net");
  expect(config.port).toBe(9999);
  expect(config.username).toBe("TestBot");

  process.argv = originalArgv;
});

test("parseConfig handles numeric port as number type", () => {
  const originalArgv = process.argv;
  process.argv = ["node", "script.js", "--port", "30000"];

  const config = parseConfig();

  expect(typeof config.port).toBe("number");
  expect(config.port).toBe(30000);

  process.argv = originalArgv;
});
