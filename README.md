# minecraft-mcp-server

An MCP server that drives a [mineflayer](https://github.com/PrismarineJS/mineflayer) bot in a Minecraft Java server. An MCP client, such as Claude Code or Claude Desktop, starts the server over stdio. The model then moves the bot, places and digs blocks, crafts, smelts and chats through the tools below.

This repo started as a fork of [yuniko-software/minecraft-mcp-server](https://github.com/yuniko-software/minecraft-mcp-server) and is now its own project. See [ADR 0001](docs/adr/0001-the-fork-is-its-own-project.md).

## Minecraft versions

The bot uses mineflayer 4.39.0. Issue #4 sets the list of supported versions and adds an in-game check for each one.

## Requirements

- [bun](https://bun.sh) 1.4.4 or later, to install and build. bun is the only package manager, see [ADR 0002](docs/adr/0002-bun-is-the-only-package-manager.md).
- Node 22 or later. The server runs on Node.
- [just](https://just.systems), to run the recipes.
- A Minecraft Java server with `online-mode=false` in `server.properties`. The bot joins without a Microsoft account, so a server in online mode refuses it.

## Install

```bash
git clone https://github.com/julian-perge/minecraft-mcp-server.git
cd minecraft-mcp-server
just install
just build
```

`just build` writes the server to `dist/main.js`. The MCP client runs that file with Node.

## Connect an MCP client

Use the absolute path of your clone in place of `/path/to/minecraft-mcp-server`.

Claude Code:

```bash
claude mcp add minecraft -- node /path/to/minecraft-mcp-server/dist/main.js --host localhost --port 25565 --username LLMBot
```

Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "minecraft": {
      "command": "node",
      "args": [
        "/path/to/minecraft-mcp-server/dist/main.js",
        "--host",
        "localhost",
        "--port",
        "25565",
        "--username",
        "LLMBot"
      ]
    }
  }
}
```

Restart the client after you change its config. The bot joins the server when the client starts the MCP server. When the Minecraft server is not up yet, the first tool call tries to connect again.

| Option | Default | Meaning |
| --- | --- | --- |
| `--host` | `localhost` | Host name of the Minecraft server |
| `--port` | `25565` | Port of the Minecraft server |
| `--username` | `LLMBot` | Name of the bot in the game |

## Tools

Movement:

- `get-position`: get the current position of the bot.
- `move-to-position`: move the bot to a position, with pathfinding.
- `look-at`: make the bot look at a position.
- `jump`: make the bot jump.
- `move-in-direction`: move the bot in a direction for a duration.
- `fly-to`: fly the bot to a position. The bot must be in creative mode.

Inventory:

- `list-inventory`: list the items in the bot's inventory.
- `find-item`: find an item in the bot's inventory.
- `equip-item`: equip an item.

Blocks:

- `place-block`: place a block at a position.
- `dig-block`: dig the block at a position.
- `get-block-info`: get information about the block at a position.
- `find-blocks`: find one or more nearby blocks of a type.

Crafting and smelting:

- `list-recipes`: list the recipes the bot can craft with its inventory.
- `get-recipe`: get the details of a recipe.
- `can-craft`: check whether the bot can craft an item with its inventory.
- `craft-item`: craft an item.
- `smelt-item`: smelt items in a furnace, blast furnace or smoker.

Entities, chat and game state:

- `find-entity`: find the nearest entity of a type.
- `send-chat`: send a chat message.
- `read-chat`: get the recent chat messages from players.
- `detect-gamemode`: get the bot's game mode.

## Development

`just` lists the recipes. `just check` runs the lint, the type check, the unit tests and the build, and proves a change. [AGENTS.md](AGENTS.md) lists the commands and the rules for this repo, and [CONTRIBUTING.md](CONTRIBUTING.md) says how a change gets in.
