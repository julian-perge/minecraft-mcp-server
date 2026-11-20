import type { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import type { BotConnection } from "./bot-connection.ts";

type McpResponse = CallToolResult & {
  content: { type: "text"; text: string }[];
};

export class ToolFactory {
  constructor(
    private server: McpServer,
    private connection: BotConnection,
  ) {}

  // The SDK checks the arguments against inputSchema before it calls the handler, and answers a bad call with an "Invalid arguments for tool" error, so the executor only sees parsed arguments.
  registerTool<Shape extends z.ZodRawShape>(
    name: string,
    description: string,
    inputSchema: Shape,
    executor: (args: z.infer<z.ZodObject<Shape>>) => Promise<McpResponse>,
  ): void {
    // ToolCallback stays an unresolved conditional type for a generic Shape, so the handler is typed for any raw shape and casts the arguments it passes on.
    const handler: ToolCallback<z.ZodRawShape> = async (args) => {
      const connectionCheck = await this.connection.checkConnectionAndReconnect();

      if (!connectionCheck.connected) {
        return {
          content: [{ type: "text", text: connectionCheck.message! }],
          isError: true,
        };
      }

      try {
        return await executor(args as z.infer<z.ZodObject<Shape>>);
      } catch (error) {
        return this.createErrorResponse(error as Error);
      }
    };
    this.server.registerTool(
      name,
      { description, inputSchema: inputSchema as z.ZodRawShape },
      handler,
    );
  }

  createResponse(text: string): McpResponse {
    return {
      content: [{ type: "text", text }],
    };
  }

  createErrorResponse(error: Error | string): McpResponse {
    const errorMessage = error instanceof Error ? error.message : error;
    return {
      content: [{ type: "text", text: `Failed: ${errorMessage}` }],
      isError: true,
    };
  }
}
