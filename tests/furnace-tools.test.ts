import { test, expect } from "bun:test";
import sinon from "sinon";
import { EventEmitter } from "events";
import { registerFurnaceTools } from "../src/tools/furnace-tools.ts";
import { ToolFactory } from "../src/tool-factory.ts";
import { connectTools, textOf } from "./helpers/mcp-client.ts";
import { BotConnection } from "../src/bot-connection.ts";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type mineflayer from "mineflayer";
import type { Item } from "prismarine-item";

const createMockItem = (fields: {
  name: string;
  count: number;
  type: number;
  metadata: number;
  slot?: number;
}): Item => fields as unknown as Item;

test("registerFurnaceTools registers smelt-item tool", () => {
  const mockServer = { registerTool: sinon.stub() } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);
  const mockBot = {} as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerFurnaceTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const smeltCall = toolCalls.find((call) => call.args[0] === "smelt-item");
  expect(smeltCall).toBeTruthy();
  expect(smeltCall!.args[1].description).toBe("Smelt items using a furnace-like block");
});

test("smelt-item returns error when no furnace block found", async () => {
  const mockServer = { registerTool: sinon.stub() } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    blockAt: sinon.stub().returns(null),
  } as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerFurnaceTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const smeltCall = toolCalls.find((call) => call.args[0] === "smelt-item");
  const executor = smeltCall!.args[2];

  const result = await executor({
    x: 1,
    y: 2,
    z: 3,
    inputItem: "iron_ore",
    fuelItem: "coal",
  });

  expect(result.content[0].text.includes("No furnace block found")).toBe(true);
});

test("smelt-item loads input and fuel and takes output", async () => {
  const mockServer = { registerTool: sinon.stub() } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const furnace = new EventEmitter() as mineflayer.Furnace & EventEmitter;
  const outputItem = createMockItem({
    name: "iron_ingot",
    count: 1,
    type: 100,
    metadata: 0,
    slot: 0,
  });

  furnace.putInput = sinon.stub().resolves();
  furnace.putFuel = sinon.stub().resolves();
  furnace.takeOutput = sinon.stub().resolves(outputItem);
  furnace.inputItem = sinon.stub().returns(null);
  furnace.fuelItem = sinon.stub().returns(null);
  furnace.outputItem = sinon.stub().returns(outputItem);
  furnace.close = sinon.stub();

  const mockBot = {
    blockAt: sinon.stub().returns({ name: "furnace" }),
    openFurnace: sinon.stub().resolves(furnace),
    inventory: {
      items: () => [
        createMockItem({ name: "iron_ore", count: 3, type: 15, metadata: 0 }),
        createMockItem({ name: "coal", count: 2, type: 263, metadata: 0 }),
      ],
    },
  } as unknown as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerFurnaceTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const smeltCall = toolCalls.find((call) => call.args[0] === "smelt-item");
  const executor = smeltCall!.args[2];

  const result = await executor({
    x: 1,
    y: 2,
    z: 3,
    inputItem: "iron_ore",
    fuelItem: "coal",
  });

  expect(result.content[0].text.includes("Smelted 1 iron_ingot")).toBe(true);
  expect((furnace.putInput as sinon.SinonStub).calledOnce).toBe(true);
  expect((furnace.putFuel as sinon.SinonStub).calledOnce).toBe(true);
  expect((furnace.takeOutput as sinon.SinonStub).calledOnce).toBe(true);
  expect((furnace.close as sinon.SinonStub).calledOnce).toBe(true);
});

test("smelt-item returns validation error for non-positive counts", async () => {
  const mockBot = {} as Partial<mineflayer.Bot>;
  const tools = await connectTools((factory) =>
    registerFurnaceTools(factory, () => mockBot as mineflayer.Bot),
  );
  const args = { x: 1, y: 2, z: 3, inputItem: "iron_ore", fuelItem: "coal" };

  const inputCountResult = await tools.call("smelt-item", { ...args, inputCount: 0, fuelCount: 1 });

  expect(inputCountResult.isError).toBe(true);
  expect(textOf(inputCountResult)).toContain("Invalid arguments for tool smelt-item");
  expect(textOf(inputCountResult)).toContain("inputCount");

  const fuelCountResult = await tools.call("smelt-item", { ...args, inputCount: 1, fuelCount: -1 });

  expect(fuelCountResult.isError).toBe(true);
  expect(textOf(fuelCountResult)).toContain("Invalid arguments for tool smelt-item");
  expect(textOf(fuelCountResult)).toContain("fuelCount");
  await tools.close();
});
