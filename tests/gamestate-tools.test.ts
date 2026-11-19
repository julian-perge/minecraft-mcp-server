import { test, expect } from "bun:test";
import sinon from "sinon";
import { registerGameStateTools } from "../src/tools/gamestate-tools.js";
import { ToolFactory } from "../src/tool-factory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BotConnection } from "../src/bot-connection.js";
import type mineflayer from "mineflayer";

test("registerGameStateTools registers detect-gamemode tool", () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);
  const mockBot = {} as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerGameStateTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const detectGamemodeCall = toolCalls.find((call) => call.args[0] === "detect-gamemode");

  expect(detectGamemodeCall).toBeTruthy();
  expect(detectGamemodeCall!.args[1].description).toBe("Detect the gamemode on game");
});

test("detect-gamemode returns creative mode", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    game: {
      gameMode: "creative",
    },
  } as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerGameStateTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const detectGamemodeCall = toolCalls.find((call) => call.args[0] === "detect-gamemode");
  const executor = detectGamemodeCall!.args[2];

  const result = await executor({});

  expect(result.content[0].text.includes("creative")).toBe(true);
});

test("detect-gamemode returns survival mode", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    game: {
      gameMode: "survival",
    },
  } as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerGameStateTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const detectGamemodeCall = toolCalls.find((call) => call.args[0] === "detect-gamemode");
  const executor = detectGamemodeCall!.args[2];

  const result = await executor({});

  expect(result.content[0].text.includes("survival")).toBe(true);
});

test("detect-gamemode returns adventure mode", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    game: {
      gameMode: "adventure",
    },
  } as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerGameStateTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const detectGamemodeCall = toolCalls.find((call) => call.args[0] === "detect-gamemode");
  const executor = detectGamemodeCall!.args[2];

  const result = await executor({});

  expect(result.content[0].text.includes("adventure")).toBe(true);
});
