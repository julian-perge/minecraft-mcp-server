import { test, expect } from "bun:test";
import sinon from "sinon";
import { z } from "zod";
import { ToolFactory } from "../src/tool-factory.ts";
import { connectTools, textOf } from "./helpers/mcp-client.ts";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BotConnection } from "../src/bot-connection.ts";

test("createResponse returns proper MCP response format", () => {
  const mockServer = {} as McpServer;
  const mockConnection = {} as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const response = factory.createResponse("Test message");

  expect(response).toStrictEqual({
    content: [{ type: "text", text: "Test message" }],
  });
});

test("createResponse handles empty string", () => {
  const mockServer = {} as McpServer;
  const mockConnection = {} as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const response = factory.createResponse("");

  expect(response).toStrictEqual({
    content: [{ type: "text", text: "" }],
  });
});

test("createErrorResponse with Error object", () => {
  const mockServer = {} as McpServer;
  const mockConnection = {} as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const error = new Error("Connection timeout");
  const response = factory.createErrorResponse(error);

  expect(response).toStrictEqual({
    content: [{ type: "text", text: "Failed: Connection timeout" }],
    isError: true,
  });
});

test("createErrorResponse with string", () => {
  const mockServer = {} as McpServer;
  const mockConnection = {} as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const response = factory.createErrorResponse("Invalid argument");

  expect(response).toStrictEqual({
    content: [{ type: "text", text: "Failed: Invalid argument" }],
    isError: true,
  });
});

test("createErrorResponse includes isError flag", () => {
  const mockServer = {} as McpServer;
  const mockConnection = {} as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const response = factory.createErrorResponse("Error occurred");

  expect(response.isError === true).toBe(true);
});

test("registerTool registers the tool with its description and input schema", async () => {
  const tools = await connectTools((factory) =>
    factory.registerTool(
      "test_tool",
      "A test tool",
      { count: z.number().describe("How many") },
      async () => factory.createResponse("ok"),
    ),
  );

  const { tools: listed } = await tools.listTools();

  expect(listed).toHaveLength(1);
  expect(listed[0].name).toBe("test_tool");
  expect(listed[0].description).toBe("A test tool");
  expect(listed[0].inputSchema.properties).toHaveProperty("count");
  await tools.close();
});

test("registerTool checks the connection before it runs the executor", async () => {
  const executor = sinon.stub().resolves({ content: [{ type: "text", text: "Success" }] });
  const tools = await connectTools((factory) =>
    factory.registerTool("test_tool", "A test tool", {}, executor),
  );

  await tools.call("test_tool");

  expect((tools.connection.checkConnectionAndReconnect as sinon.SinonStub).calledOnce).toBe(true);
  expect(executor.calledOnce).toBe(true);
  await tools.close();
});

test("registerTool returns the connection message and skips the executor when not connected", async () => {
  const executor = sinon.stub().resolves({ content: [{ type: "text", text: "Success" }] });
  const tools = await connectTools(
    (factory) => factory.registerTool("test_tool", "A test tool", {}, executor),
    { connected: false, message: "Bot is not connected" },
  );

  const response = await tools.call("test_tool");

  expect(response.isError).toBe(true);
  expect(textOf(response)).toBe("Bot is not connected");
  expect(executor.notCalled).toBe(true);
  await tools.close();
});

test("registerTool passes the parsed arguments to the executor", async () => {
  const executor = sinon.stub().resolves({ content: [{ type: "text", text: "Success" }] });
  const tools = await connectTools((factory) =>
    factory.registerTool(
      "test_tool",
      "A test tool",
      { x: z.coerce.number(), name: z.string() },
      executor,
    ),
  );

  await tools.call("test_tool", { x: "12", name: "stone" });

  expect(executor.firstCall.args[0]).toStrictEqual({ x: 12, name: "stone" });
  await tools.close();
});

test("registerTool returns the executor result when it succeeds", async () => {
  const tools = await connectTools((factory) =>
    factory.registerTool("test_tool", "A test tool", {}, async () =>
      factory.createResponse("Tool executed"),
    ),
  );

  const response = await tools.call("test_tool");

  expect(response.isError).toBeFalsy();
  expect(textOf(response)).toBe("Tool executed");
  await tools.close();
});

test("registerTool turns an executor exception into an error response", async () => {
  const tools = await connectTools((factory) =>
    factory.registerTool(
      "test_tool",
      "A test tool",
      {},
      sinon.stub().rejects(new Error("Execution failed")),
    ),
  );

  const response = await tools.call("test_tool");

  expect(response.isError).toBe(true);
  expect(textOf(response)).toBe("Failed: Execution failed");
  await tools.close();
});

test("registerTool rejects invalid arguments before the executor runs", async () => {
  const executor = sinon.stub().resolves({ content: [{ type: "text", text: "Success" }] });
  const tools = await connectTools((factory) =>
    factory.registerTool(
      "test_tool",
      "A test tool",
      { count: z.number().int().positive() },
      executor,
    ),
  );

  const response = await tools.call("test_tool", { count: 0 });

  expect(response.isError).toBe(true);
  expect(textOf(response)).toContain("Invalid arguments for tool test_tool");
  expect(textOf(response)).toContain("count");
  expect(executor.notCalled).toBe(true);
  await tools.close();
});
