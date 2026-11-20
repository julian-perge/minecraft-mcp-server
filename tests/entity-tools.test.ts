import { test, expect } from "bun:test";
import sinon from "sinon";
import { registerEntityTools } from "../src/tools/entity-tools.ts";
import { ToolFactory } from "../src/tool-factory.ts";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BotConnection } from "../src/bot-connection.ts";
import type mineflayer from "mineflayer";
import { Vec3 } from "vec3";

test("registerEntityTools registers find-entity tool", () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);
  const mockBot = {} as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerEntityTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const findEntityCall = toolCalls.find((call) => call.args[0] === "find-entity");

  expect(findEntityCall).toBeTruthy();
  expect(findEntityCall!.args[1].description).toBe("Find the nearest entity of a specific type");
});

test("find-entity returns entity when found", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockEntity = {
    name: "zombie",
    type: "mob",
    position: new Vec3(5, 64, 8),
  };
  const mockBot = {
    entity: {
      position: new Vec3(0, 64, 0),
    },
    nearestEntity: sinon.stub().returns(mockEntity),
  } as unknown as mineflayer.Bot;
  const getBot = () => mockBot;

  registerEntityTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const findEntityCall = toolCalls.find((call) => call.args[0] === "find-entity");
  const executor = findEntityCall!.args[2];

  const result = await executor({ type: "zombie", maxDistance: 16 });

  expect(result.content[0].text.includes("zombie")).toBe(true);
  expect(result.content[0].text.includes("5")).toBe(true);
  expect(result.content[0].text.includes("64")).toBe(true);
  expect(result.content[0].text.includes("8")).toBe(true);
});

test("find-entity returns not found when entity too far", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockEntity = {
    name: "zombie",
    type: "mob",
    position: new Vec3(100, 64, 100),
  };
  const mockBot = {
    entity: {
      position: new Vec3(0, 64, 0),
    },
    nearestEntity: sinon.stub().returns(mockEntity),
  } as unknown as mineflayer.Bot;
  const getBot = () => mockBot;

  registerEntityTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const findEntityCall = toolCalls.find((call) => call.args[0] === "find-entity");
  const executor = findEntityCall!.args[2];

  const result = await executor({ type: "zombie", maxDistance: 16 });

  expect(result.content[0].text.includes("No zombie found within 16 blocks")).toBe(true);
});

test("find-entity returns not found when no entity exists", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    entity: {
      position: new Vec3(0, 64, 0),
    },
    nearestEntity: sinon.stub().returns(null),
  } as unknown as mineflayer.Bot;
  const getBot = () => mockBot;

  registerEntityTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const findEntityCall = toolCalls.find((call) => call.args[0] === "find-entity");
  const executor = findEntityCall!.args[2];

  const result = await executor({ type: "zombie", maxDistance: 16 });

  expect(result.content[0].text.includes("No zombie found")).toBe(true);
});

test("find-entity handles player type", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockEntity = {
    username: "TestPlayer",
    type: "player",
    position: new Vec3(5, 64, 5),
  };
  const mockBot = {
    entity: {
      position: new Vec3(0, 64, 0),
    },
    nearestEntity: sinon.stub().returns(mockEntity),
  } as unknown as mineflayer.Bot;
  const getBot = () => mockBot;

  registerEntityTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const findEntityCall = toolCalls.find((call) => call.args[0] === "find-entity");
  const executor = findEntityCall!.args[2];

  const result = await executor({ type: "player", maxDistance: 16 });

  expect(result.content[0].text.includes("TestPlayer")).toBe(true);
});

test("find-entity searches any entity when type not specified", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockEntity = {
    name: "cow",
    type: "mob",
    position: new Vec3(5, 64, 5),
  };
  const mockBot = {
    entity: {
      position: new Vec3(0, 64, 0),
    },
    nearestEntity: sinon.stub().returns(mockEntity),
  } as unknown as mineflayer.Bot;
  const getBot = () => mockBot;

  registerEntityTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const findEntityCall = toolCalls.find((call) => call.args[0] === "find-entity");
  const executor = findEntityCall!.args[2];

  const result = await executor({ maxDistance: 16 });

  expect(result.content[0].text.includes("cow")).toBe(true);
});
