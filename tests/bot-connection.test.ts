import { test, expect } from "bun:test";
import sinon from "sinon";
import { EventEmitter } from "events";
import { BotConnection, type ConnectionDeps } from "../src/bot-connection.js";

test("constructor initializes with correct state", () => {
  const config = { host: "localhost", port: 25565, username: "TestBot" };
  const callbacks = { onLog: sinon.stub(), onChatMessage: sinon.stub() };
  const connection = new BotConnection(config, callbacks);

  expect(connection.getState()).toBe("disconnected");
  expect(connection.getConfig()).toStrictEqual(config);
  expect(connection.getBot()).toBe(null);
  expect(connection.isConnected()).toBe(false);
});

test("constructor accepts custom reconnect delay", () => {
  const config = { host: "localhost", port: 25565, username: "TestBot" };
  const callbacks = { onLog: sinon.stub(), onChatMessage: sinon.stub() };
  const customDelay = 5000;
  const connection = new BotConnection(config, callbacks, customDelay);

  expect(connection.getState()).toBe("disconnected");
});

test("getState returns current state", () => {
  const config = { host: "localhost", port: 25565, username: "TestBot" };
  const callbacks = { onLog: sinon.stub(), onChatMessage: sinon.stub() };
  const connection = new BotConnection(config, callbacks);

  expect(connection.getState()).toBe("disconnected");
});

test("getConfig returns configuration", () => {
  const config = { host: "example.com", port: 30000, username: "MyBot" };
  const callbacks = { onLog: sinon.stub(), onChatMessage: sinon.stub() };
  const connection = new BotConnection(config, callbacks);

  const returnedConfig = connection.getConfig();
  expect(returnedConfig.host).toBe("example.com");
  expect(returnedConfig.port).toBe(30000);
  expect(returnedConfig.username).toBe("MyBot");
});

test("getBot returns null initially", () => {
  const config = { host: "localhost", port: 25565, username: "TestBot" };
  const callbacks = { onLog: sinon.stub(), onChatMessage: sinon.stub() };
  const connection = new BotConnection(config, callbacks);

  expect(connection.getBot()).toBe(null);
});

test("isConnected returns false when state is disconnected", () => {
  const config = { host: "localhost", port: 25565, username: "TestBot" };
  const callbacks = { onLog: sinon.stub(), onChatMessage: sinon.stub() };
  const connection = new BotConnection(config, callbacks);

  expect(connection.isConnected()).toBe(false);
});

test("formatError handles Error objects", () => {
  const config = { host: "localhost", port: 25565, username: "TestBot" };
  const callbacks = { onLog: sinon.stub(), onChatMessage: sinon.stub() };
  const connection = new BotConnection(config, callbacks);

  const error = new Error("Test error");
  const formatted = (
    connection as unknown as { formatError: (error: unknown) => string }
  ).formatError(error);

  expect(formatted).toBe("Test error");
});

test("formatError handles plain objects", () => {
  const config = { host: "localhost", port: 25565, username: "TestBot" };
  const callbacks = { onLog: sinon.stub(), onChatMessage: sinon.stub() };
  const connection = new BotConnection(config, callbacks);

  const errorObj = { code: "ECONNREFUSED", message: "Connection refused" };
  const formatted = (
    connection as unknown as { formatError: (error: unknown) => string }
  ).formatError(errorObj);

  expect(formatted.includes("ECONNREFUSED")).toBe(true);
  expect(formatted.includes("Connection refused")).toBe(true);
});

test("formatError handles strings", () => {
  const config = { host: "localhost", port: 25565, username: "TestBot" };
  const callbacks = { onLog: sinon.stub(), onChatMessage: sinon.stub() };
  const connection = new BotConnection(config, callbacks);

  const formatted = (
    connection as unknown as { formatError: (error: unknown) => string }
  ).formatError("Simple error");

  expect(formatted).toBe('"Simple error"');
});

test("formatError handles non-serializable objects", () => {
  const config = { host: "localhost", port: 25565, username: "TestBot" };
  const callbacks = { onLog: sinon.stub(), onChatMessage: sinon.stub() };
  const connection = new BotConnection(config, callbacks);

  const circular: Record<string, unknown> = {};
  circular.self = circular;
  const formatted = (
    connection as unknown as { formatError: (error: unknown) => string }
  ).formatError(circular);

  expect(typeof formatted).toBe("string");
});

test("checkConnectionAndReconnect returns connected when already connected", async () => {
  const config = { host: "localhost", port: 25565, username: "TestBot" };
  const callbacks = { onLog: sinon.stub(), onChatMessage: sinon.stub() };
  const connection = new BotConnection(config, callbacks);

  (connection as unknown as { state: string }).state = "connected";

  const result = await connection.checkConnectionAndReconnect();

  expect(result.connected).toBe(true);
  expect(result.message).toBe(undefined);
});

test("checkConnectionAndReconnect returns message when connecting", async () => {
  const config = { host: "localhost", port: 25565, username: "TestBot" };
  const callbacks = { onLog: sinon.stub(), onChatMessage: sinon.stub() };
  const connection = new BotConnection(config, callbacks);

  (connection as unknown as { state: string }).state = "connecting";

  const result = await connection.checkConnectionAndReconnect();

  expect(result.connected).toBe(false);
  expect(result.message!.includes("connecting")).toBe(true);
});

test("checkConnectionAndReconnect includes setup instructions on failure", async () => {
  const config = { host: "localhost", port: 25565, username: "TestBot" };
  const callbacks = { onLog: sinon.stub(), onChatMessage: sinon.stub() };
  const connection = new BotConnection(config, callbacks, 100);

  (connection as unknown as { state: string }).state = "disconnected";

  // Stub attemptReconnect to prevent actual connection attempt
  const attemptReconnectStub = sinon
    .stub(connection as unknown as { attemptReconnect: () => void }, "attemptReconnect")
    .callsFake(() => {
      (connection as unknown as { state: string }).state = "connecting";
    });

  const result = await connection.checkConnectionAndReconnect();

  expect(attemptReconnectStub.calledOnce).toBe(true);
  expect(result.connected).toBe(false);
  expect(result.message!.includes("Cannot connect")).toBe(true);
  expect(result.message!.includes("localhost:25565")).toBe(true);
  expect(result.message!).toContain("https://github.com/julian-perge/minecraft-mcp-server");

  attemptReconnectStub.restore();
}, 10_000);

test("cleanup clears reconnect timer", () => {
  const config = { host: "localhost", port: 25565, username: "TestBot" };
  const callbacks = { onLog: sinon.stub(), onChatMessage: sinon.stub() };
  const connection = new BotConnection(config, callbacks);

  (connection as unknown as { reconnectTimer: ReturnType<typeof setTimeout> }).reconnectTimer =
    setTimeout(() => {}, 10000);

  expect(() => {
    connection.cleanup();
  }).not.toThrow();
});

test("cleanup does not throw when no bot exists", () => {
  const config = { host: "localhost", port: 25565, username: "TestBot" };
  const callbacks = { onLog: sinon.stub(), onChatMessage: sinon.stub() };
  const connection = new BotConnection(config, callbacks);

  expect(() => {
    connection.cleanup();
  }).not.toThrow();
});

const gateConfig = { host: "localhost", port: 25565, username: "TestBot" };

function gateConnection(pingResult: Promise<unknown>, reconnectDelayMs = 10) {
  const callbacks = { onLog: sinon.stub(), onChatMessage: sinon.stub() };
  const createBot = sinon.stub().callsFake(() => new EventEmitter());
  const ping = sinon.stub().returns(pingResult);
  const connection = new BotConnection(gateConfig, callbacks, reconnectDelayMs, {
    ping: ping as unknown as ConnectionDeps["ping"],
    createBot: createBot as unknown as ConnectionDeps["createBot"],
  });
  return { connection, callbacks, createBot, ping };
}

test("connect joins a 1.21.11 server with that exact version", async () => {
  const { connection, createBot } = gateConnection(
    Promise.resolve({ version: { name: "1.21.11", protocol: 774 } }),
  );

  await connection.connect();

  expect(createBot.calledOnce).toBe(true);
  expect(createBot.firstCall.args[0]).toMatchObject({
    host: "localhost",
    port: 25565,
    username: "TestBot",
    version: "1.21.11",
  });
  expect(connection.getState()).toBe("connecting");
  expect(connection.getRefusal()).toBe(null);
});

test("connect joins a 26.1.2 server with that exact version", async () => {
  const { connection, createBot } = gateConnection(
    Promise.resolve({ version: { name: "26.1.2", protocol: 775 } }),
  );

  await connection.connect();

  expect(createBot.firstCall.args[0].version).toBe("26.1.2");
});

test("connect refuses a 26.3 server and never creates a bot", async () => {
  const { connection, callbacks, createBot } = gateConnection(
    Promise.resolve({ version: { name: "26.3", protocol: 777 } }),
  );

  await connection.connect();

  expect(createBot.notCalled).toBe(true);
  expect(connection.getState()).toBe("disconnected");
  expect(connection.getRefusal()).toContain("26.3 (protocol 777), which is not supported.");
  expect(connection.getRefusal()).toContain("Supported versions: 1.21.11, 26.1.2.");
  expect(callbacks.onLog.calledWith("error", connection.getRefusal())).toBe(true);
});

test("connect refuses a server that answers the ping without a protocol number", async () => {
  const { connection, createBot } = gateConnection(
    Promise.resolve({ version: "1.6.4", motd: "", playerCount: 0, maxPlayers: 20 }),
  );

  await connection.connect();

  expect(createBot.notCalled).toBe(true);
  expect(connection.getRefusal()).toContain("The Minecraft server runs 1.6.4 (protocol -1)");
});

test("connect logs an unreachable server and stays disconnected without a refusal", async () => {
  const { connection, callbacks, createBot } = gateConnection(
    Promise.reject(new Error("connect ECONNREFUSED")),
  );

  await connection.connect();

  expect(createBot.notCalled).toBe(true);
  expect(connection.getState()).toBe("disconnected");
  expect(connection.getRefusal()).toBe(null);
  expect(
    callbacks.onLog.calledWith(
      "error",
      "Cannot reach the Minecraft server at localhost:25565: connect ECONNREFUSED",
    ),
  ).toBe(true);
});

test("checkConnectionAndReconnect returns the refusal as soon as the gate refuses", async () => {
  const { connection } = gateConnection(
    Promise.resolve({ version: { name: "26.3", protocol: 777 } }),
  );

  const started = Date.now();
  const result = await connection.checkConnectionAndReconnect();

  expect(result.connected).toBe(false);
  expect(result.message).toContain("26.3 (protocol 777), which is not supported.");
  expect(Date.now() - started).toBeLessThan(2000);
});
