import { test, expect } from "bun:test";
import sinon from "sinon";
import { registerChatTools } from "../src/tools/chat-tools.js";
import { ToolFactory } from "../src/tool-factory.js";
import { MessageStore } from "../src/message-store.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BotConnection } from "../src/bot-connection.js";
import type mineflayer from "mineflayer";

test("registerChatTools registers send-chat tool", () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);
  const mockBot = {} as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;
  const messageStore = new MessageStore();

  registerChatTools(factory, getBot, messageStore);

  const toolCalls = (mockServer.tool as sinon.SinonStub).getCalls();
  const sendChatCall = toolCalls.find((call) => call.args[0] === "send-chat");

  expect(sendChatCall).toBeTruthy();
  expect(sendChatCall!.args[1]).toBe("Send a chat message in-game");
});

test("registerChatTools registers read-chat tool", () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);
  const mockBot = {} as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;
  const messageStore = new MessageStore();

  registerChatTools(factory, getBot, messageStore);

  const toolCalls = (mockServer.tool as sinon.SinonStub).getCalls();
  const readChatCall = toolCalls.find((call) => call.args[0] === "read-chat");

  expect(readChatCall).toBeTruthy();
  expect(readChatCall!.args[1]).toBe("Get recent chat messages from players");
});

test("send-chat calls bot.chat with message", async () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {
    chat: sinon.stub(),
  } as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;
  const messageStore = new MessageStore();

  registerChatTools(factory, getBot, messageStore);

  const toolCalls = (mockServer.tool as sinon.SinonStub).getCalls();
  const sendChatCall = toolCalls.find((call) => call.args[0] === "send-chat");
  const executor = sendChatCall!.args[3];

  const result = await executor({ message: "Hello world" });

  expect((mockBot.chat as sinon.SinonStub).calledOnceWith("Hello world")).toBe(true);
  expect(result.content[0].text.includes("Hello world")).toBe(true);
});

test("read-chat returns no messages when empty", async () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {} as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;
  const messageStore = new MessageStore();

  registerChatTools(factory, getBot, messageStore);

  const toolCalls = (mockServer.tool as sinon.SinonStub).getCalls();
  const readChatCall = toolCalls.find((call) => call.args[0] === "read-chat");
  const executor = readChatCall!.args[3];

  const result = await executor({});

  expect(result.content[0].text.includes("No chat messages found")).toBe(true);
});

test("read-chat returns formatted messages", async () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {} as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;
  const messageStore = new MessageStore();

  messageStore.addMessage("player1", "Hello");
  messageStore.addMessage("player2", "Hi there");

  registerChatTools(factory, getBot, messageStore);

  const toolCalls = (mockServer.tool as sinon.SinonStub).getCalls();
  const readChatCall = toolCalls.find((call) => call.args[0] === "read-chat");
  const executor = readChatCall!.args[3];

  const result = await executor({ count: 10 });

  expect(result.content[0].text.includes("player1")).toBe(true);
  expect(result.content[0].text.includes("Hello")).toBe(true);
  expect(result.content[0].text.includes("player2")).toBe(true);
  expect(result.content[0].text.includes("Hi there")).toBe(true);
  expect(result.content[0].text.includes("2 chat message")).toBe(true);
});

test("read-chat respects count parameter", async () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {} as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;
  const messageStore = new MessageStore();

  for (let i = 0; i < 20; i++) {
    messageStore.addMessage(`player${i}`, `Message ${i}`);
  }

  registerChatTools(factory, getBot, messageStore);

  const toolCalls = (mockServer.tool as sinon.SinonStub).getCalls();
  const readChatCall = toolCalls.find((call) => call.args[0] === "read-chat");
  const executor = readChatCall!.args[3];

  const result = await executor({ count: 5 });

  expect(result.content[0].text.includes("5 chat message")).toBe(true);
});

test("read-chat limits count to max messages", async () => {
  const mockServer = {
    tool: sinon.stub(),
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true }),
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);

  const mockBot = {} as Partial<mineflayer.Bot>;
  const getBot = () => mockBot as mineflayer.Bot;
  const messageStore = new MessageStore();

  for (let i = 0; i < 10; i++) {
    messageStore.addMessage(`player${i}`, `Message ${i}`);
  }

  registerChatTools(factory, getBot, messageStore);

  const toolCalls = (mockServer.tool as sinon.SinonStub).getCalls();
  const readChatCall = toolCalls.find((call) => call.args[0] === "read-chat");
  const executor = readChatCall!.args[3];

  const result = await executor({ count: 200 });

  expect(result.content[0].text.includes("10 chat message")).toBe(true);
});
