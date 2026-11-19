import { test, expect } from "bun:test";
import { MessageStore } from "../src/message-store.js";

test("adds and retrieves messages", () => {
  const store = new MessageStore();

  store.addMessage("player1", "Hello world");
  store.addMessage("player2", "Hi there");

  const messages = store.getRecentMessages(10);

  expect(messages.length).toBe(2);
  expect(messages[0].username).toBe("player1");
  expect(messages[0].content).toBe("Hello world");
  expect(messages[1].username).toBe("player2");
  expect(messages[1].content).toBe("Hi there");
  expect(typeof messages[0].timestamp === "number").toBe(true);
  expect(typeof messages[1].timestamp === "number").toBe(true);
});

test("limits messages to maximum of 100", () => {
  const store = new MessageStore();

  for (let i = 0; i < 150; i++) {
    store.addMessage(`player${i}`, `Message ${i}`);
  }

  const allMessages = store.getRecentMessages(200);

  expect(allMessages.length).toBe(100);
  expect(allMessages[0].content).toBe("Message 50");
  expect(allMessages[99].content).toBe("Message 149");
});

test("getRecentMessages returns limited count", () => {
  const store = new MessageStore();

  for (let i = 0; i < 20; i++) {
    store.addMessage("player", `Message ${i}`);
  }

  const messages = store.getRecentMessages(5);

  expect(messages.length).toBe(5);
  expect(messages[0].content).toBe("Message 15");
  expect(messages[4].content).toBe("Message 19");
});

test("returns empty array when no messages", () => {
  const store = new MessageStore();

  const messages = store.getRecentMessages(10);

  expect(messages.length).toBe(0);
  expect(messages).toStrictEqual([]);
});

test("getRecentMessages defaults to 10 messages", () => {
  const store = new MessageStore();

  for (let i = 0; i < 20; i++) {
    store.addMessage("player", `Message ${i}`);
  }

  const messages = store.getRecentMessages();

  expect(messages.length).toBe(10);
  expect(messages[0].content).toBe("Message 10");
  expect(messages[9].content).toBe("Message 19");
});

test("getRecentMessages with count larger than stored messages", () => {
  const store = new MessageStore();

  store.addMessage("player1", "Message 1");
  store.addMessage("player2", "Message 2");

  const messages = store.getRecentMessages(50);

  expect(messages.length).toBe(2);
});

test("getMaxMessages returns 100", () => {
  const store = new MessageStore();

  expect(store.getMaxMessages()).toBe(100);
});

test("messages have increasing timestamps", () => {
  const store = new MessageStore();

  store.addMessage("player1", "First");
  store.addMessage("player2", "Second");

  const messages = store.getRecentMessages(2);

  expect(messages[1].timestamp >= messages[0].timestamp).toBe(true);
});

test("handles empty username and content", () => {
  const store = new MessageStore();

  store.addMessage("", "");

  const messages = store.getRecentMessages(1);

  expect(messages.length).toBe(1);
  expect(messages[0].username).toBe("");
  expect(messages[0].content).toBe("");
});

test("getRecentMessages with zero count", () => {
  const store = new MessageStore();

  store.addMessage("player", "Message");

  const messages = store.getRecentMessages(0);

  expect(messages.length).toBe(0);
});
