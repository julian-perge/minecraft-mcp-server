import { test, expect } from "bun:test";
import sinon from "sinon";
import { registerPositionTools } from "../src/tools/position-tools.js";
import { ToolFactory } from "../src/tool-factory.js";
import { BotConnection } from "../src/bot-connection.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type mineflayer from "mineflayer";
import { Vec3 } from "vec3";

test("registerPositionTools registers get-position tool", () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);
  const mockBot = {} as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerPositionTools(factory, getBot);

  const toolCalls = (mockServer.tool as sinon.SinonStub).getCalls();
  const getPositionCall = toolCalls.find((call) => call.args[0] === "get-position");

  expect(getPositionCall).toBeTruthy();
  expect(getPositionCall!.args[1]).toBe("Get the current position of the bot");
});

test("registerPositionTools registers move-to-position tool", () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);
  const mockBot = {} as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerPositionTools(factory, getBot);

  const toolCalls = (mockServer.tool as sinon.SinonStub).getCalls();
  const moveToPositionCall = toolCalls.find((call) => call.args[0] === "move-to-position");

  expect(moveToPositionCall).toBeTruthy();
  expect(moveToPositionCall!.args[1]).toBe("Move the bot to a specific position");
});

test("get-position returns current bot position", async () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    entity: {
      position: new Vec3(100, 64, 200),
    },
  } as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerPositionTools(factory, getBot);

  const toolCalls = (mockServer.tool as sinon.SinonStub).getCalls();
  const getPositionCall = toolCalls.find((call) => call.args[0] === "get-position");
  const executor = getPositionCall!.args[3];

  const result = await executor({});

  expect(result.content[0].text.includes("100")).toBe(true);
  expect(result.content[0].text.includes("64")).toBe(true);
  expect(result.content[0].text.includes("200")).toBe(true);
});

test("move-to-position returns error when pathfinding fails", async () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    pathfinder: {
      goto: sinon.stub().rejects(new Error("Cannot find path")),
      stop: sinon.stub(),
    },
    entity: {
      position: new Vec3(10, 20, 30),
    },
  } as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerPositionTools(factory, getBot);

  const toolCalls = (mockServer.tool as sinon.SinonStub).getCalls();
  const moveToPositionCall = toolCalls.find((call) => call.args[0] === "move-to-position");
  const executor = moveToPositionCall!.args[3];

  const result = await executor({ x: 100, y: 64, z: 200 });

  expect(result.isError).toBe(true);
  expect(result.content[0].text.includes("Cannot find path")).toBe(true);
});

test("move-to-position returns timeout error and stops pathfinder", async () => {
  const clock = sinon.useFakeTimers();
  try {
    const mockServer = {
      tool: sinon.stub(),
    } as unknown as McpServer;
    const mockConnection = {
      checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
    } as unknown as BotConnection;
    const factory = new ToolFactory(mockServer, mockConnection);

    const mockBot = {
      pathfinder: {
        goto: sinon.stub().returns(new Promise(() => {})),
        stop: sinon.stub(),
      },
    } as Partial<mineflayer.Bot>;
    const getBot = () => mockBot as mineflayer.Bot;

    registerPositionTools(factory, getBot);

    const toolCalls = (mockServer.tool as sinon.SinonStub).getCalls();
    const moveToPositionCall = toolCalls.find((call) => call.args[0] === "move-to-position");
    const executor = moveToPositionCall!.args[3];

    const resultPromise = executor({ x: 100, y: 64, z: 200, timeoutMs: 1000 });
    await clock.tickAsync(1000);
    const result = await resultPromise;

    expect(result.isError).toBe(true);
    expect(result.content[0].text.includes("Move timed out after 1000ms")).toBe(true);
    expect((mockBot.pathfinder!.stop as sinon.SinonStub).calledOnce).toBe(true);
  } finally {
    clock.restore();
  }
});

test("move-to-position succeeds without timeout and does not stop pathfinder", async () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    pathfinder: {
      goto: sinon.stub().resolves(),
      stop: sinon.stub(),
    },
  } as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerPositionTools(factory, getBot);

  const toolCalls = (mockServer.tool as sinon.SinonStub).getCalls();
  const moveToPositionCall = toolCalls.find((call) => call.args[0] === "move-to-position");
  const executor = moveToPositionCall!.args[3];

  const result = await executor({ x: 100, y: 64, z: 200 });

  expect(result.isError).toBeFalsy();
  expect(result.content[0].text.includes("Successfully moved")).toBe(true);
  expect((mockBot.pathfinder!.stop as sinon.SinonStub).notCalled).toBe(true);
});

test("move-to-position succeeds before timeout and does not stop pathfinder", async () => {
  const clock = sinon.useFakeTimers();
  try {
    const mockServer = {
      tool: sinon.stub(),
    } as unknown as McpServer;
    const mockConnection = {
      checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
    } as unknown as BotConnection;
    const factory = new ToolFactory(mockServer, mockConnection);

    const mockBot = {
      pathfinder: {
        goto: sinon.stub().resolves(),
        stop: sinon.stub(),
      },
    } as Partial<mineflayer.Bot>;
    const getBot = () => mockBot as mineflayer.Bot;

    registerPositionTools(factory, getBot);

    const toolCalls = (mockServer.tool as sinon.SinonStub).getCalls();
    const moveToPositionCall = toolCalls.find((call) => call.args[0] === "move-to-position");
    const executor = moveToPositionCall!.args[3];

    const result = await executor({ x: 100, y: 64, z: 200, timeoutMs: 1000 });
    await clock.tickAsync(1000);

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text.includes("Successfully moved")).toBe(true);
    expect((mockBot.pathfinder!.stop as sinon.SinonStub).notCalled).toBe(true);
  } finally {
    clock.restore();
  }
});

test("move-to-position preserves pathfinder error when not timing out", async () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    pathfinder: {
      goto: sinon
        .stub()
        .rejects(
          new Error(
            "Path was stopped before it could be completed! Thus, the desired goal was not reached.",
          ),
        ),
      stop: sinon.stub(),
    },
  } as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;

  registerPositionTools(factory, getBot);

  const toolCalls = (mockServer.tool as sinon.SinonStub).getCalls();
  const moveToPositionCall = toolCalls.find((call) => call.args[0] === "move-to-position");
  const executor = moveToPositionCall!.args[3];

  const result = await executor({ x: 100, y: 64, z: 200, timeoutMs: 5000 });

  expect(result.isError).toBe(true);
  expect(result.content[0].text.includes("Path was stopped before it could be completed")).toBe(
    true,
  );
  expect((mockBot.pathfinder!.stop as sinon.SinonStub).notCalled).toBe(true);
});
