import { test, expect } from "bun:test";
import sinon from "sinon";
import { ToolFactory } from "../src/tool-factory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BotConnection } from "../src/bot-connection.js";

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

test("registerTool calls server.tool with correct parameters", async () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;

  const factory = new ToolFactory(mockServer, mockConnection);
  const schema = { type: "object", properties: {} };
  const executor = sinon.stub().resolves({ content: [{ type: "text", text: "Success" }] });

  factory.registerTool("test_tool", "A test tool", schema, executor);

  expect((mockServer.tool as sinon.SinonStub).calledOnce).toBe(true);
  expect((mockServer.tool as sinon.SinonStub).firstCall.args[0]).toBe("test_tool");
  expect((mockServer.tool as sinon.SinonStub).firstCall.args[1]).toBe("A test tool");
  expect((mockServer.tool as sinon.SinonStub).firstCall.args[2]).toBe(schema);
});

test("registerTool executor checks connection before executing", async () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;

  const factory = new ToolFactory(mockServer, mockConnection);
  const executor = sinon.stub().resolves({ content: [{ type: "text", text: "Success" }] });

  factory.registerTool("test_tool", "A test tool", {}, executor);

  const registeredExecutor = (mockServer.tool as sinon.SinonStub).firstCall.args[3];
  await registeredExecutor({ arg: "value" });

  expect((mockConnection.checkConnectionAndReconnect as sinon.SinonStub).calledOnce).toBe(true);
});

test("registerTool executor returns error when not connected", async () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({
      connected: false,
      message: "Bot is not connected",
    }),
  } as unknown as BotConnection;

  const factory = new ToolFactory(mockServer, mockConnection);
  const executor = sinon.stub().resolves({ content: [{ type: "text", text: "Success" }] });

  factory.registerTool("test_tool", "A test tool", {}, executor);

  const registeredExecutor = (mockServer.tool as sinon.SinonStub).firstCall.args[3];
  const response = await registeredExecutor({ arg: "value" });

  expect(response).toStrictEqual({
    content: [{ type: "text", text: "Bot is not connected" }],
    isError: true,
  });
  expect((executor as sinon.SinonStub).notCalled).toBe(true);
});

test("registerTool executor calls executor when connected", async () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;

  const factory = new ToolFactory(mockServer, mockConnection);
  const executor = sinon.stub().resolves({ content: [{ type: "text", text: "Success" }] });

  factory.registerTool("test_tool", "A test tool", {}, executor);

  const registeredExecutor = (mockServer.tool as sinon.SinonStub).firstCall.args[3];
  const args = { arg: "value" };
  await registeredExecutor(args);

  expect((executor as sinon.SinonStub).calledOnceWith(args)).toBe(true);
});

test("registerTool executor returns executor result when successful", async () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;

  const factory = new ToolFactory(mockServer, mockConnection);
  const expectedResponse = { content: [{ type: "text", text: "Tool executed" }] };
  const executor = sinon.stub().resolves(expectedResponse);

  factory.registerTool("test_tool", "A test tool", {}, executor);

  const registeredExecutor = (mockServer.tool as sinon.SinonStub).firstCall.args[3];
  const response = await registeredExecutor({ arg: "value" });

  expect(response).toStrictEqual(expectedResponse);
});

test("registerTool executor catches and returns error response on exception", async () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;

  const factory = new ToolFactory(mockServer, mockConnection);
  const error = new Error("Execution failed");
  const executor = sinon.stub().rejects(error);

  factory.registerTool("test_tool", "A test tool", {}, executor);

  const registeredExecutor = (mockServer.tool as sinon.SinonStub).firstCall.args[3];
  const response = await registeredExecutor({ arg: "value" });

  expect(response).toStrictEqual({
    content: [{ type: "text", text: "Failed: Execution failed" }],
    isError: true,
  });
});
