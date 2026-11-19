import { test, expect } from "bun:test";
import sinon from "sinon";
import { registerBlockTools } from "../src/tools/block-tools.js";
import { ToolFactory } from "../src/tool-factory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BotConnection } from "../src/bot-connection.js";
import type mineflayer from "mineflayer";
import { Vec3 } from "vec3";

test("registerBlockTools registers place-block tool", () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);
  const mockBot = {} as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerBlockTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const placeBlockCall = toolCalls.find((call) => call.args[0] === "place-block");

  expect(placeBlockCall).toBeTruthy();
  expect(placeBlockCall!.args[1].description).toBe("Place a block at the specified position");
});

test("registerBlockTools registers dig-block tool", () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);
  const mockBot = {} as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerBlockTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const digBlockCall = toolCalls.find((call) => call.args[0] === "dig-block");

  expect(digBlockCall).toBeTruthy();
  expect(digBlockCall!.args[1].description).toBe("Dig a block at the specified position");
});

test("registerBlockTools registers get-block-info tool", () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);
  const mockBot = {} as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerBlockTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const getBlockInfoCall = toolCalls.find((call) => call.args[0] === "get-block-info");

  expect(getBlockInfoCall).toBeTruthy();
  expect(getBlockInfoCall!.args[1].description).toBe(
    "Get information about a block at the specified position",
  );
});

test("registerBlockTools registers find-blocks tool", () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);
  const mockBot = {} as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerBlockTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const findBlockCall = toolCalls.find((call) => call.args[0] === "find-blocks");

  expect(findBlockCall).toBeTruthy();
  expect(findBlockCall!.args[1].description).toBe(
    "Find one or more nearby blocks of a specific type",
  );
});

test("get-block-info returns block information", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBlock = {
    name: "stone",
    type: 1,
    position: new Vec3(10, 64, 20),
  };
  const mockBot = {
    blockAt: sinon.stub().returns(mockBlock),
  } as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerBlockTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const getBlockInfoCall = toolCalls.find((call) => call.args[0] === "get-block-info");
  const executor = getBlockInfoCall!.args[2];

  const result = await executor({ x: 10, y: 64, z: 20 });

  expect(result.content[0].text.includes("stone")).toBe(true);
  expect(result.content[0].text.includes("10")).toBe(true);
  expect(result.content[0].text.includes("64")).toBe(true);
  expect(result.content[0].text.includes("20")).toBe(true);
});

test("get-block-info handles missing block", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    blockAt: sinon.stub().returns(null),
  } as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerBlockTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const getBlockInfoCall = toolCalls.find((call) => call.args[0] === "get-block-info");
  const executor = getBlockInfoCall!.args[2];

  const result = await executor({ x: 10, y: 64, z: 20 });

  expect(result.content[0].text.includes("No block information found")).toBe(true);
});

test("dig-block handles air blocks", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBlock = {
    name: "air",
  };
  const mockBot = {
    blockAt: sinon.stub().returns(mockBlock),
  } as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerBlockTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const digBlockCall = toolCalls.find((call) => call.args[0] === "dig-block");
  const executor = digBlockCall!.args[2];

  const result = await executor({ x: 10, y: 64, z: 20 });

  expect(result.content[0].text.includes("No block found")).toBe(true);
});

test("place-block blocks placing at bot position and one block above", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    entity: { position: new Vec3(10.4, 64, 20.7) },
    blockAt: sinon.stub().returns({ name: "air" }),
  } as unknown as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerBlockTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const placeBlockCall = toolCalls.find((call) => call.args[0] === "place-block");
  const executor = placeBlockCall!.args[2];

  const resultAtFeet = await executor({ x: 10, y: 64, z: 20 });
  const resultAtHead = await executor({ x: 10, y: 65, z: 20 });

  expect(resultAtFeet.content[0].text.includes("can't place a block")).toBe(true);
  expect(resultAtHead.content[0].text.includes("can't place a block")).toBe(true);
});

test("place-block floors input coordinates before self-placement guard", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    entity: { position: new Vec3(10.4, 64, 20.7) },
    blockAt: sinon.stub().returns({ name: "air" }),
  } as unknown as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerBlockTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const placeBlockCall = toolCalls.find((call) => call.args[0] === "place-block");
  const executor = placeBlockCall!.args[2];

  const result = await executor({ x: 10.4, y: 64, z: 20.7 });

  expect(result.content[0].text.includes("can't place a block")).toBe(true);
});

test("find-blocks returns not found when block not found", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    version: "1.21",
    findBlock: sinon.stub().returns(null),
  } as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerBlockTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const findBlockCall = toolCalls.find((call) => call.args[0] === "find-blocks");
  const executor = findBlockCall!.args[2];

  const result = await executor({ blockType: "diamond_ore", maxDistance: 16 });

  expect(result.content[0].text.includes("No diamond_ore found")).toBe(true);
});

test("find-blocks returns multiple results when count is greater than one", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    version: "1.21",
    entity: { position: new Vec3(0, 64, 0) },
    findBlocks: sinon.stub().returns([new Vec3(1, 64, 0), new Vec3(2, 64, 0)]),
  } as unknown as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerBlockTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const findBlockCall = toolCalls.find((call) => call.args[0] === "find-blocks");
  const executor = findBlockCall!.args[2];

  const result = await executor({ blockType: "stone", maxDistance: 16, count: 2 });

  expect(result.content[0].text.includes("Found 2 stone block(s)")).toBe(true);
  expect(result.content[0].text.includes("(1, 64, 0)")).toBe(true);
  expect(result.content[0].text.includes("(2, 64, 0)")).toBe(true);
});

test("find-blocks clamps oversized count before calling bot.findBlocks", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const findBlocksStub = sinon.stub().returns([new Vec3(1, 64, 0)]);
  const mockBot = {
    version: "1.21",
    entity: { position: new Vec3(0, 64, 0) },
    findBlocks: findBlocksStub,
  } as unknown as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerBlockTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const findBlockCall = toolCalls.find((call) => call.args[0] === "find-blocks");
  const executor = findBlockCall!.args[2];

  await executor({ blockType: "stone", maxDistance: 16, count: 10_000 });

  const findBlocksArgs = findBlocksStub.firstCall.args[0];
  expect(findBlocksArgs.count).toBe(256);
});
