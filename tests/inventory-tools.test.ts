import { test, expect } from "bun:test";
import sinon from "sinon";
import { registerInventoryTools } from "../src/tools/inventory-tools.ts";
import { ToolFactory } from "../src/tool-factory.ts";
import { BotConnection } from "../src/bot-connection.ts";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type mineflayer from "mineflayer";

test("registerInventoryTools registers list-inventory tool", () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);
  const mockBot = {} as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerInventoryTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const listInventoryCall = toolCalls.find((call) => call.args[0] === "list-inventory");

  expect(listInventoryCall).toBeTruthy();
  expect(listInventoryCall!.args[1].description).toBe("List all items in the bot's inventory");
});

test("registerInventoryTools registers equip-item tool", () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);
  const mockBot = {} as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerInventoryTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const equipItemCall = toolCalls.find((call) => call.args[0] === "equip-item");

  expect(equipItemCall).toBeTruthy();
  expect(equipItemCall!.args[1].description).toBe("Equip a specific item");
});

test("list-inventory returns empty when no items", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    inventory: {
      items: () => [],
    },
  } as unknown as mineflayer.Bot;
  const getBot = () => mockBot;

  registerInventoryTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const listInventoryCall = toolCalls.find((call) => call.args[0] === "list-inventory");
  const executor = listInventoryCall!.args[2];

  const result = await executor({});

  expect(result.content[0].text.includes("empty")).toBe(true);
});

test("list-inventory returns items with counts", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    inventory: {
      items: () => [
        { name: "diamond_pickaxe", count: 1, slot: 0 },
        { name: "cobblestone", count: 64, slot: 1 },
      ],
    },
  } as unknown as mineflayer.Bot;
  const getBot = () => mockBot;

  registerInventoryTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const listInventoryCall = toolCalls.find((call) => call.args[0] === "list-inventory");
  const executor = listInventoryCall!.args[2];

  const result = await executor({});

  expect(result.content[0].text.includes("diamond_pickaxe")).toBe(true);
  expect(result.content[0].text.includes("cobblestone")).toBe(true);
  expect(result.content[0].text.includes("64")).toBe(true);
});

test("equip-item calls bot.equip", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const equipStub = sinon.stub().resolves();
  const mockBot = {
    inventory: {
      items: () => [{ name: "diamond_sword", type: 1 }],
    },
    equip: equipStub,
  } as unknown as mineflayer.Bot;
  const getBot = () => mockBot;

  registerInventoryTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const equipItemCall = toolCalls.find((call) => call.args[0] === "equip-item");
  const executor = equipItemCall!.args[2];

  const result = await executor({ itemName: "diamond_sword", destination: "hand" });

  expect(equipStub.calledOnce).toBe(true);
  expect(result.content[0].text.includes("Equipped")).toBe(true);
  expect(result.content[0].text.includes("diamond_sword")).toBe(true);
});

test("equip-item returns message when item not found", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    inventory: {
      items: () => [],
    },
  } as unknown as mineflayer.Bot;
  const getBot = () => mockBot;

  registerInventoryTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const equipItemCall = toolCalls.find((call) => call.args[0] === "equip-item");
  const executor = equipItemCall!.args[2];

  const result = await executor({ itemName: "diamond_sword", destination: "hand" });

  expect(result.content[0].text.includes("Couldn't find")).toBe(true);
});
