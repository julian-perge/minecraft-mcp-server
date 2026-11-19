import { test, expect } from "bun:test";
import { setupStdioFiltering } from "../src/stdio-filter.js";

test("allows JSON messages to pass through", () => {
  const originalWrite = process.stdout.write;
  let capturedOutput = "";

  process.stdout.write = ((chunk: string | Uint8Array) => {
    capturedOutput += chunk.toString();
    return true;
  }) as typeof process.stdout.write;

  setupStdioFiltering();

  const jsonMessage = '{"jsonrpc":"2.0","id":1,"method":"test"}';
  process.stdout.write(jsonMessage);

  expect(capturedOutput).toBe(jsonMessage);

  process.stdout.write = originalWrite;
});

test("allows timestamp log messages to pass through", () => {
  const originalWrite = process.stdout.write;
  let capturedOutput = "";

  process.stdout.write = ((chunk: string | Uint8Array) => {
    capturedOutput += chunk.toString();
    return true;
  }) as typeof process.stdout.write;

  setupStdioFiltering();

  const logMessage = "2025-11-05T19:45:29.842Z [minecraft] [mcp-server] [info] Bot connected\n";
  process.stdout.write(logMessage);

  expect(capturedOutput).toBe(logMessage);

  process.stdout.write = originalWrite;
});

test("allows newline-only messages to pass through", () => {
  const originalWrite = process.stdout.write;
  let capturedOutput = "";

  process.stdout.write = ((chunk: string | Uint8Array) => {
    capturedOutput += chunk.toString();
    return true;
  }) as typeof process.stdout.write;

  setupStdioFiltering();

  process.stdout.write("\n");
  process.stdout.write("\r\n");

  expect(capturedOutput).toBe("\n\r\n");

  process.stdout.write = originalWrite;
});

test("filters out random debug messages", () => {
  const originalWrite = process.stdout.write;
  let capturedOutput = "";

  process.stdout.write = ((chunk: string | Uint8Array) => {
    capturedOutput += chunk.toString();
    return true;
  }) as typeof process.stdout.write;

  setupStdioFiltering();

  process.stdout.write("Minecraft bot debug message");
  process.stdout.write("Some random output");

  expect(capturedOutput).toBe("");

  process.stdout.write = originalWrite;
});

test("filters minecraft-protodef library output", () => {
  const originalWrite = process.stdout.write;
  let capturedOutput = "";

  process.stdout.write = ((chunk: string | Uint8Array) => {
    capturedOutput += chunk.toString();
    return true;
  }) as typeof process.stdout.write;

  setupStdioFiltering();

  process.stdout.write("Loading minecraft protocol version 1.20.4");
  process.stdout.write("[protodef] Packet received");

  expect(capturedOutput).toBe("");

  process.stdout.write = originalWrite;
});

test("allows JSON while filtering other messages", () => {
  const originalWrite = process.stdout.write;
  let capturedOutput = "";

  process.stdout.write = ((chunk: string | Uint8Array) => {
    capturedOutput += chunk.toString();
    return true;
  }) as typeof process.stdout.write;

  setupStdioFiltering();

  process.stdout.write("Random message");
  process.stdout.write('{"jsonrpc":"2.0","result":"success"}');
  process.stdout.write("More random output");

  expect(capturedOutput).toBe('{"jsonrpc":"2.0","result":"success"}');

  process.stdout.write = originalWrite;
});

test("suppresses console.error output", () => {
  setupStdioFiltering();

  expect(() => {
    console.error("This should be suppressed");
    console.error("No errors thrown");
  }).not.toThrow();
});

test("console.error becomes a no-op function", () => {
  const originalError = console.error;

  setupStdioFiltering();

  const result = console.error("test");

  expect(result).toBe(undefined);

  console.error = originalError;
});
