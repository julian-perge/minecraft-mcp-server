import { test, expect } from "bun:test";
import { log } from "../src/logger.js";

test("log writes to stderr", () => {
  const originalWrite = process.stderr.write;
  let capturedOutput = "";

  process.stderr.write = ((chunk: string | Uint8Array) => {
    capturedOutput += chunk.toString();
    return true;
  }) as typeof process.stderr.write;

  log("info", "Test message");

  expect(capturedOutput.length > 0).toBe(true);
  expect(capturedOutput.includes("Test message")).toBe(true);

  process.stderr.write = originalWrite;
});

test("log format includes all required components", () => {
  const originalWrite = process.stderr.write;
  let capturedOutput = "";

  process.stderr.write = ((chunk: string | Uint8Array) => {
    capturedOutput += chunk.toString();
    return true;
  }) as typeof process.stderr.write;

  log("error", "Connection failed");

  expect(capturedOutput.includes("[minecraft]")).toBe(true);
  expect(capturedOutput.includes("[mcp-server]")).toBe(true);
  expect(capturedOutput.includes("[error]")).toBe(true);
  expect(capturedOutput.includes("Connection failed")).toBe(true);
  expect(capturedOutput.endsWith("\n")).toBe(true);

  process.stderr.write = originalWrite;
});

test("log includes ISO timestamp", () => {
  const originalWrite = process.stderr.write;
  let capturedOutput = "";

  process.stderr.write = ((chunk: string | Uint8Array) => {
    capturedOutput += chunk.toString();
    return true;
  }) as typeof process.stderr.write;

  const beforeTime = new Date().toISOString();
  log("info", "Timing test");
  const afterTime = new Date().toISOString();

  const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/;
  expect(timestampRegex.test(capturedOutput)).toBe(true);

  const timestamp = capturedOutput.match(timestampRegex)?.[0];
  expect(timestamp !== undefined).toBe(true);
  expect(timestamp! >= beforeTime.substring(0, 19)).toBe(true);
  expect(timestamp! <= afterTime).toBe(true);

  process.stderr.write = originalWrite;
});

test("log handles different log levels", () => {
  const originalWrite = process.stderr.write;
  const outputs: string[] = [];

  process.stderr.write = ((chunk: string | Uint8Array) => {
    outputs.push(chunk.toString());
    return true;
  }) as typeof process.stderr.write;

  log("info", "Info message");
  log("warn", "Warning message");
  log("error", "Error message");
  log("debug", "Debug message");

  expect(outputs.length).toBe(4);
  expect(outputs[0].includes("[info]")).toBe(true);
  expect(outputs[1].includes("[warn]")).toBe(true);
  expect(outputs[2].includes("[error]")).toBe(true);
  expect(outputs[3].includes("[debug]")).toBe(true);

  process.stderr.write = originalWrite;
});

test("log handles empty message", () => {
  const originalWrite = process.stderr.write;
  let capturedOutput = "";

  process.stderr.write = ((chunk: string | Uint8Array) => {
    capturedOutput += chunk.toString();
    return true;
  }) as typeof process.stderr.write;

  log("info", "");

  expect(capturedOutput.includes("[minecraft]")).toBe(true);
  expect(capturedOutput.includes("[info]")).toBe(true);
  expect(capturedOutput.endsWith(" \n")).toBe(true);

  process.stderr.write = originalWrite;
});

test("log handles special characters in message", () => {
  const originalWrite = process.stderr.write;
  let capturedOutput = "";

  process.stderr.write = ((chunk: string | Uint8Array) => {
    capturedOutput += chunk.toString();
    return true;
  }) as typeof process.stderr.write;

  const specialMessage = 'Error: {json: "value"} & <tag> "quotes" \'apostrophes\'';
  log("error", specialMessage);

  expect(capturedOutput.includes(specialMessage)).toBe(true);
  expect(capturedOutput.includes('{json: "value"}')).toBe(true);
  expect(capturedOutput.includes("<tag>")).toBe(true);

  process.stderr.write = originalWrite;
});

test("log handles multiline message", () => {
  const originalWrite = process.stderr.write;
  let capturedOutput = "";

  process.stderr.write = ((chunk: string | Uint8Array) => {
    capturedOutput += chunk.toString();
    return true;
  }) as typeof process.stderr.write;

  const multilineMessage = "Line 1\nLine 2\nLine 3";
  log("info", multilineMessage);

  expect(capturedOutput.includes(multilineMessage)).toBe(true);
  expect(capturedOutput.includes("Line 1\nLine 2\nLine 3")).toBe(true);

  process.stderr.write = originalWrite;
});

test("log output format is consistent", () => {
  const originalWrite = process.stderr.write;
  let capturedOutput = "";

  process.stderr.write = ((chunk: string | Uint8Array) => {
    capturedOutput += chunk.toString();
    return true;
  }) as typeof process.stderr.write;

  log("info", "Test");

  const expectedPattern =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[minecraft\] \[mcp-server\] \[info\] Test\n$/;
  expect(expectedPattern.test(capturedOutput)).toBe(true);

  process.stderr.write = originalWrite;
});
