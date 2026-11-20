import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import sinon from "sinon";
import type { BotConnection } from "../../src/bot-connection.ts";
import { ToolFactory } from "../../src/tool-factory.ts";

export type ConnectionCheck = { connected: boolean; message?: string };

// A real McpServer and Client joined by an in-memory transport, so a test goes through the SDK's own argument checks, as a call from an MCP client does.
export async function connectTools(
  register: (factory: ToolFactory) => void,
  connectionCheck: ConnectionCheck = { connected: true },
) {
  const server = new McpServer({ name: "test-server", version: "0.0.0" });
  const connection = {
    checkConnectionAndReconnect: sinon.stub().resolves(connectionCheck),
  } as unknown as BotConnection;
  register(new ToolFactory(server, connection));

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return {
    connection,
    listTools: () => client.listTools(),
    call: (name: string, args: Record<string, unknown> = {}) =>
      client.callTool({ name, arguments: args }) as Promise<CallToolResult>,
    close: () => client.close(),
  };
}

export function textOf(result: CallToolResult): string {
  return result.content.map((part) => (part.type === "text" ? part.text : "")).join("\n");
}
