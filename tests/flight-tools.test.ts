import { test, expect } from "bun:test";
import sinon from "sinon";
import { registerFlightTools } from "../src/tools/flight-tools.ts";
import { ToolFactory } from "../src/tool-factory.ts";
import { BotConnection } from "../src/bot-connection.ts";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type mineflayer from "mineflayer";
import { Vec3 } from "vec3";

test("registerFlightTools registers fly-to tool", () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);
  const mockBot = {} as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerFlightTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const flyToCall = toolCalls.find((call) => call.args[0] === "fly-to");

  expect(flyToCall).toBeTruthy();
  expect(flyToCall!.args[1].description).toBe("Make the bot fly to a specific position");
});

test("fly-to successfully flies to destination", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const flyToStub = sinon.stub().resolves();
  const stopFlyingStub = sinon.stub();
  const mockBot = {
    creative: {
      flyTo: flyToStub,
      stopFlying: stopFlyingStub,
    },
    entity: {
      position: new Vec3(0, 64, 0),
    },
  } as unknown as mineflayer.Bot;
  const getBot = () => mockBot;

  registerFlightTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const flyToCall = toolCalls.find((call) => call.args[0] === "fly-to");
  const executor = flyToCall!.args[2];

  const result = await executor({ x: 100, y: 80, z: 200 });

  expect(flyToStub.calledOnce).toBe(true);
  expect(stopFlyingStub.calledOnce).toBe(true);
  expect(result.content[0].text.includes("Successfully flew")).toBe(true);
  expect(result.content[0].text.includes("100")).toBe(true);
});

test("fly-to returns error when creative mode not available", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    creative: null,
  } as unknown as mineflayer.Bot;
  const getBot = () => mockBot;

  registerFlightTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const flyToCall = toolCalls.find((call) => call.args[0] === "fly-to");
  const executor = flyToCall!.args[2];

  const result = await executor({ x: 100, y: 80, z: 200 });

  expect(result.content[0].text.includes("Creative mode is not available")).toBe(true);
});

test("fly-to handles flight errors", async () => {
  const mockServer = {
    registerTool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const flyToStub = sinon.stub().rejects(new Error("Cannot reach destination"));
  const stopFlyingStub = sinon.stub();
  const mockBot = {
    creative: {
      flyTo: flyToStub,
      stopFlying: stopFlyingStub,
    },
    entity: {
      position: new Vec3(0, 64, 0),
    },
  } as unknown as mineflayer.Bot;
  const getBot = () => mockBot;

  registerFlightTools(factory, getBot);

  const toolCalls = (mockServer.registerTool as sinon.SinonStub).getCalls();
  const flyToCall = toolCalls.find((call) => call.args[0] === "fly-to");
  const executor = flyToCall!.args[2];

  const result = await executor({ x: 100, y: 80, z: 200 });

  expect(result.isError).toBe(true);
  expect(result.content[0].text.includes("Cannot reach destination")).toBe(true);
});
