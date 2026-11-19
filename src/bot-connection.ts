import mineflayer from "mineflayer";
import pathfinderPkg from "mineflayer-pathfinder";
const { pathfinder, Movements } = pathfinderPkg;
import minecraftProtocol, { type NewPingResult, type OldPingResult } from "minecraft-protocol";
import { checkServerVersion, supportedVersionNames } from "./minecraft-versions.js";

type ConnectionState = "connected" | "connecting" | "disconnected";

interface BotConfig {
  host: string;
  port: number;
  username: string;
}

interface ConnectionCallbacks {
  onLog: (level: string, message: string) => void;
  onChatMessage: (username: string, message: string) => void;
}

export const PING_TIMEOUT_MS = 10_000;

// Tests replace these two to run the connection without a Minecraft server.
export interface ConnectionDeps {
  ping: (options: {
    host: string;
    port: number;
    closeTimeout: number;
  }) => Promise<OldPingResult | NewPingResult>;
  createBot: typeof mineflayer.createBot;
}

// minecraft-protocol is CommonJS, and Node cannot import its ping by name, so it comes from the default export.
const defaultDeps: ConnectionDeps = {
  ping: minecraftProtocol.ping,
  createBot: mineflayer.createBot,
};

export class BotConnection {
  private bot: mineflayer.Bot | null = null;
  private state: ConnectionState = "disconnected";
  private config: BotConfig;
  private callbacks: ConnectionCallbacks;
  private isReconnecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly reconnectDelayMs: number;
  private readonly deps: ConnectionDeps;
  private refusal: string | null = null;

  constructor(
    config: BotConfig,
    callbacks: ConnectionCallbacks,
    reconnectDelayMs = 2000,
    deps: Partial<ConnectionDeps> = {},
  ) {
    this.config = config;
    this.callbacks = callbacks;
    this.reconnectDelayMs = reconnectDelayMs;
    this.deps = { ...defaultDeps, ...deps };
  }

  getBot(): mineflayer.Bot | null {
    return this.bot;
  }

  getState(): ConnectionState {
    return this.state;
  }

  getConfig(): BotConfig {
    return this.config;
  }

  isConnected(): boolean {
    return this.state === "connected";
  }

  getRefusal(): string | null {
    return this.refusal;
  }

  // The bot pings the server first and joins only a version on the supported list, because mineflayer fails on other versions without naming the cause.
  async connect(): Promise<void> {
    this.state = "connecting";
    this.isReconnecting = false;
    this.refusal = null;

    let serverVersion: { name: string; protocol: number };
    try {
      // minecraft-protocol waits 120 seconds for a host that does not answer, and every tool call says "connecting" meanwhile, so the ping gives up after 10.
      const result = await this.deps.ping({
        host: this.config.host,
        port: this.config.port,
        closeTimeout: PING_TIMEOUT_MS,
      });
      // A server older than 1.7 answers the ping with a version string and no protocol number.
      serverVersion =
        typeof result.version === "object"
          ? result.version
          : { name: String(result.version), protocol: -1 };
    } catch (err) {
      this.callbacks.onLog(
        "error",
        `Cannot reach the Minecraft server at ${this.config.host}:${this.config.port}: ${this.formatError(err)}`,
      );
      this.state = "disconnected";
      return;
    }

    const check = checkServerVersion(serverVersion);
    if (!check.supported) {
      this.refusal = check.message;
      this.callbacks.onLog("error", check.message);
      this.state = "disconnected";
      return;
    }

    this.bot = this.deps.createBot({
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      version: check.version,
      plugins: { pathfinder },
    });
    this.registerEventHandlers(this.bot);
  }

  private registerEventHandlers(bot: mineflayer.Bot): void {
    bot.once("spawn", async () => {
      this.state = "connected";
      this.callbacks.onLog("info", "Bot spawned in world");

      const defaultMove = new Movements(bot);
      bot.pathfinder.setMovements(defaultMove);

      bot.chat("LLM-powered bot ready to receive instructions!");
      this.callbacks.onLog(
        "info",
        `Bot connected successfully. Username: ${this.config.username}, Server: ${this.config.host}:${this.config.port}`,
      );
    });

    bot.on("chat", (username, message) => {
      if (username === bot.username) return;
      this.callbacks.onChatMessage(username, message);
    });

    bot.on("kicked", (reason) => {
      this.callbacks.onLog("error", `Bot was kicked from server: ${this.formatError(reason)}`);
      this.state = "disconnected";
      bot.quit();
    });

    bot.on("error", (err) => {
      const errorCode = (err as { code?: string }).code || "Unknown error";
      const errorMsg = err instanceof Error ? err.message : String(err);

      this.callbacks.onLog("error", `Bot error [${errorCode}]: ${errorMsg}`);

      if (errorCode === "ECONNREFUSED" || errorCode === "ETIMEDOUT") {
        this.state = "disconnected";
      }
    });

    bot.on("login", () => {
      this.callbacks.onLog("info", "Bot logged in successfully");
    });

    bot.on("end", (reason) => {
      this.callbacks.onLog("info", `Bot disconnected: ${this.formatError(reason)}`);

      // A server can close the connection after the ping and before spawn, for example for a whitelist or a ban. The state then leaves "connecting" too, so the next tool call tries again.
      if (this.state === "connected" || this.state === "connecting") {
        this.state = "disconnected";
      }

      if (this.bot === bot) {
        try {
          bot.removeAllListeners();
          this.bot = null;
          this.callbacks.onLog("info", "Bot instance cleaned up after disconnect");
        } catch (err) {
          this.callbacks.onLog(
            "warn",
            `Error cleaning up bot on end event: ${this.formatError(err)}`,
          );
        }
      }
    });
  }

  attemptReconnect(): void {
    if (this.isReconnecting || this.state === "connecting") {
      return;
    }

    this.isReconnecting = true;
    this.state = "connecting";
    this.callbacks.onLog(
      "info",
      `Attempting to reconnect to Minecraft server in ${this.reconnectDelayMs}ms...`,
    );

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      if (this.bot) {
        try {
          this.bot.removeAllListeners();
          this.bot.quit("Reconnecting...");
          this.callbacks.onLog("info", "Old bot instance cleaned up");
        } catch (err) {
          this.callbacks.onLog("warn", `Error while cleaning up old bot: ${this.formatError(err)}`);
        }
      }

      this.callbacks.onLog("info", "Creating new bot instance...");
      void this.connect();
    }, this.reconnectDelayMs);
  }

  async checkConnectionAndReconnect(): Promise<{ connected: boolean; message?: string }> {
    const currentState = this.state;

    if (currentState === "disconnected") {
      this.attemptReconnect();

      const maxWaitTime = this.reconnectDelayMs + 5000;
      const pollInterval = 100;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        if (this.state === "connected") {
          return { connected: true };
        }
        if (this.state === "disconnected" && this.refusal) {
          return { connected: false, message: this.refusal };
        }
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      const errorMessage =
        `Cannot connect to Minecraft server at ${this.config.host}:${this.config.port}\n\n` +
        `Please ensure:\n` +
        `1. Minecraft server is running on ${this.config.host}:${this.config.port}\n` +
        `2. Server is accessible from this machine\n` +
        `3. Server version is one of: ${supportedVersionNames()}\n\n` +
        `For setup instructions, visit: https://github.com/julian-perge/minecraft-mcp-server`;

      return { connected: false, message: errorMessage };
    }

    if (currentState === "connecting") {
      return {
        connected: false,
        message: "Bot is connecting to the Minecraft server. Please wait a moment and try again.",
      };
    }

    return { connected: true };
  }

  cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.bot) {
      try {
        this.bot.quit("Server shutting down");
      } catch (err) {
        this.callbacks.onLog("warn", `Error during cleanup: ${this.formatError(err)}`);
      }
    }
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
