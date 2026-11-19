# ADR-0004: Verify builds in game on a vanilla server, not in a shared Structure Lab world

## Status

Accepted

## Date

2026-11-19

## Context

Issue #5 asks how this bot can work with two of the owner's repos:

- julian-perge/minecraft-agent-skills: modding and server skills for Codex and
  Claude Code. Seven of them ask for checks that need a player in a running
  game: minecraft-datapack, minecraft-world-generation,
  minecraft-worldedit-ops, minecraft-essentials-ops, minecraft-server-admin,
  minecraft-testing and minecraft-commands-scripting. For example, the
  datapack skill runs `/reload` and `/function` and then needs to know that a
  block is at a position.
- julian-perge/MinecraftStructureInjector (Structure Lab): a NeoForge mod and a
  Python MCP server. An agent generates structure NBT, Structure Lab places it
  in a lab world, takes screenshots, and exports clean NBT and a vanilla
  datapack with a `/place template` command. Main targets 26.3. A `26.1.2`
  branch targets 26.1.2.

The issue also asks: Structure Lab only works in Structure Lab worlds, so can
the bot and Structure Lab share a world, and is that useful?

Facts from Structure Lab's source, on 2026-11-19:

- A lab world is the `structurelab:lab` world preset, made in Create New
  World. When it opens, the mod freezes the tick rate and turns off time,
  weather, mob spawns, random ticks and command blocks (`LabSession.java`).
- The HTTP bridge starts on client setup and serves only an open singleplayer
  world (`LabCapture.java`, `LabBridge.java`).
- The mod registers a block (`structurelab:view_pad`), its block item and a
  block entity type (`StructureLab.java`). `neoforge.mods.toml` sets
  `side="BOTH"` only on its dependencies on NeoForge and Minecraft, so the
  client requirement comes from the registered entries, not from that line.
- Capture and the bridge's `command` operation act on the first player in the
  player list (`LabSession.java`, `LabTestOps.java`).

## Decision

The bot and Structure Lab do not share a world. The bot checks results on a
vanilla server of a supported version instead, with four tools:
`run-command`, `check-blocks`, `verify-structure` and `can-reach`.
`docs/verify-in-game.md` shows the flows.

The answer to the question in #5:

- **Can they share a world today?** No. Main is 26.3, and no mineflayer
  release supports 26.3 (ADR 0003). On the `26.1.2` branch the versions match,
  but a lab world is a singleplayer world that the bot could reach only
  through Open to LAN, the bot joins only offline-mode servers, and a second
  player can change which player Structure Lab moves for captures. The main
  blocker is a guess from the mod's metadata, not checked against NeoForge's
  source: a server with modded entries in its block and item registries
  refuses a vanilla client, and mineflayer is a vanilla client.
- **After mineflayer supports 26.3?** Still no. Only the version blocker goes
  away.
- **Would it be useful?** Little. Structure Lab's `inspect_blocks` already
  reads exact block states in the lab. The checks that need a player body,
  such as walking into each room or opening doors, need ticks, and the lab
  freezes them.

The useful link is Structure Lab's export. Its datapack places the structure
on a vanilla server, where ticks run, and `verify-structure` compares the
placed blocks with the exported NBT. `verify-structure` reads both palette
spellings, `Name` and `Properties` and the `id` and `properties` that
Structure Lab's main branch writes for 26.3, so it is ready for 26.3 when the
bot is.

## Alternatives Considered

### Join a Structure Lab world over LAN

- Pros: one world for both tools.
- Cons: blocked by the client requirement, the singleplayer world, the online
  mode of a signed-in host and the first-player rule. Each one needs a change
  in Structure Lab.
- Rejected: high cost, an uncertain result and little value.

### A version gate only

- Pros: small.
- Cons: it gives the skills nothing to check with.
- Rejected as the whole answer: ADR 0003 already added the gate.

### A runner for ordered smoke-test steps

- Pros: one call for a whole server check.
- Cons: it needs the four tools first, and an agent can already call them in
  order.
- Deferred: it can follow when a skill needs it.

## Consequences

- Only this fork changed. minecraft-agent-skills and
  MinecraftStructureInjector each got one issue that asks for the docs on
  their side: julian-perge/minecraft-agent-skills#95 and
  julian-perge/MinecraftStructureInjector#1.
- `run-command` runs whatever the server lets the bot run. The server's
  permissions decide which commands run. The tool refuses only a command
  over 256 characters or one with a control character or the section sign.
- `verify-structure` reads a file path that the MCP client gives it. The MCP
  server runs on the client's machine with the client's rights. The tool
  refuses a relative path. The reader refuses a path that is not a regular
  file, a file over 64 MiB, gzip data that unpacks to more than 256 MiB, and a
  template over 1,000,000 blocks.
