#!/usr/bin/env bun

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupStdioFiltering } from "./stdio-filter.ts";
import { log } from "./logger.ts";
import { parseConfig } from "./config.ts";
import { BotConnection } from "./bot-connection.ts";
import { ToolFactory } from "./tool-factory.ts";
import { MessageStore } from "./message-store.ts";
import { registerPositionTools } from "./tools/position-tools.ts";
import { registerInventoryTools } from "./tools/inventory-tools.ts";
import { registerBlockTools } from "./tools/block-tools.ts";
import { registerEntityTools } from "./tools/entity-tools.ts";
import { registerChatTools } from "./tools/chat-tools.ts";
import { registerFlightTools } from "./tools/flight-tools.ts";
import { registerGameStateTools } from "./tools/gamestate-tools.ts";
import { registerCraftingTools } from "./tools/crafting-tools.ts";
import { registerFurnaceTools } from "./tools/furnace-tools.ts";
import { registerVerificationTools } from "./tools/verification-tools.ts";

setupStdioFiltering();

process.on("unhandledRejection", (reason) => {
  log("error", `Unhandled rejection: ${String(reason)}`);
});

process.on("uncaughtException", (error) => {
  log("error", `Uncaught exception: ${error}`);
});

async function main() {
  const config = parseConfig();
  const messageStore = new MessageStore();

  const connection = new BotConnection(config, {
    onLog: log,
    onChatMessage: (username, message) => messageStore.addMessage(username, message),
  });

  void connection.connect();

  const server = new McpServer({
    name: "minecraft-mcp-server",
    version: "2.0.4",
  });

  const factory = new ToolFactory(server, connection);
  const getBot = () => connection.getBot()!;

  registerPositionTools(factory, getBot);
  registerInventoryTools(factory, getBot);
  registerBlockTools(factory, getBot);
  registerEntityTools(factory, getBot);
  registerChatTools(factory, getBot, messageStore);
  registerFlightTools(factory, getBot);
  registerGameStateTools(factory, getBot);
  registerCraftingTools(factory, getBot);
  registerFurnaceTools(factory, getBot);
  registerVerificationTools(factory, getBot);

  process.stdin.on("end", () => {
    connection.cleanup();
    log("info", "MCP Client has disconnected. Shutting down...");
    process.exit(0);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  log("error", `Fatal error in main(): ${error}`);
  process.exit(1);
});
