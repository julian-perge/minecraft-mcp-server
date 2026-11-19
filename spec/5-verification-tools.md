# Spec: verification tools for minecraft-agent-skills and Structure Lab exports (#5)

Source issue: https://github.com/julian-perge/minecraft-mcp-server/issues/5. For commands, structure and code style, see [AGENTS.md](../AGENTS.md).

## Objective

An agent that builds a datapack, a world-generation change or a structure can prove the result in a running game with this bot. The users are the agents that follow the skills in julian-perge/minecraft-agent-skills, and the agents that export structures from Structure Lab (julian-perge/MinecraftStructureInjector). The bot gives them four tools that check the world and answer with a pass or fail result, and a doc that shows each flow.

## Research

The research for #5 is in ADR 0004. In short:

- Structure Lab is a NeoForge mod with a client-only HTTP bridge. Its lab world is a singleplayer world preset that freezes ticks, time, weather and mob spawns. The mod registers a block (the view pad), its block item and a block entity, so a vanilla client, and so mineflayer, cannot join a world that runs it (a guess from the mod's registrations, not checked against NeoForge source). Main targets 26.3, which mineflayer does not support. The `26.1.2` branch matches a supported version, but the client requirement, the singleplayer world, the offline-mode bot and the frozen ticks still stop a shared world.
- So the bot and Structure Lab do not share a world, now or after mineflayer adds 26.3. Inside a lab world the bot would add little: Structure Lab's own `inspect_blocks` reads exact block states, and the checks that need a player body (walking, doors, spawn safety) need ticks, which the lab turns off.
- The useful link is the export. Structure Lab exports clean NBT and a vanilla datapack with a `/place template` command. The bot can check that export on a vanilla server of a supported version, with ticks on.
- Seven skills in minecraft-agent-skills ask for checks that need a player in a running game: minecraft-datapack, minecraft-world-generation, minecraft-worldedit-ops, minecraft-essentials-ops, minecraft-server-admin, minecraft-testing and minecraft-commands-scripting.

## Decisions

- **Build verification tools, not a shared lab world.** ADR 0004 records the options and the answer.
- **`run-command`**: sends one command as the bot and returns the command's replies and any chat that arrive within a wait time (default 1000 ms, at most 10000 ms). The server's permissions decide what the bot may run. Most commands need the bot to be an operator.
- **`check-blocks`**: takes up to 1000 expected blocks, each with a position, a block name and optional properties, and returns how many match, and each mismatch and each position in a chunk that is not loaded.
- **`verify-structure`**: takes the path of a structure template `.nbt` file and the origin where it was placed, and compares every block in the file with the world, in the same format as `check-blocks`. It reads both palette spellings: `Name` and `Properties` (1.21.11, 26.1.2) and `id` and `properties` (26.3, as Structure Lab's main branch writes them). It skips `minecraft:structure_void`. It refuses a relative path, a path that is not a regular file, a file over 64 MiB, gzip data that unpacks to more than 256 MiB, a template with several palettes, and a template over 1,000,000 blocks.
- **`can-reach`**: asks the pathfinder for a path to a position, without moving, and returns the result (`success`, `timeout` or `noPath`) and the path length. It runs the whole search, so `partial` never comes back.
- **One comparison module** serves `check-blocks` and `verify-structure`, so both report in the same form.
- **The doc** `docs/verify-in-game.md` shows three flows with exact tool calls: a datapack after `/reload`, a structure from Structure Lab's export, and spawn reachability after a WorldEdit paste.
- **Other repos get issues only**: one in minecraft-agent-skills that asks for in-game steps with this bot in the skills above, and one in MinecraftStructureInjector that asks it to document the export check and to say that a lab world cannot host the bot.

## Commands

No new recipe. `just check` covers the unit tests. `just ingame <version>` covers the four tools in game, because it fails when a listed tool has no check.

## Project structure

- `src/tools/verification-tools.ts`: the four tools.
- `src/block-compare.ts`: the comparison of expected blocks with the world.
- `src/structure-file.ts`: the reader of structure template files.
- `tests/verification-tools.test.ts`, `tests/block-compare.test.ts`, `tests/structure-file.test.ts`, with fixture `.nbt` data that `scripts/structure-nbt.ts` writes into a temporary folder during the test.
- `scripts/ingame-check.ts`: checks for the four tools.
- `docs/adr/0004-verify-in-game-instead-of-sharing-a-lab-world.md`, `docs/verify-in-game.md`, README.md.

## Testing strategy

- **Unit tests**: each tool through the real MCP SDK client (`tests/helpers/mcp-client.ts`) with a stub bot. The structure reader against fixture files in both palette spellings, gzip and plain. The comparison against matches, mismatches, property differences and unloaded chunks.
- **In game** (`just ingame 1.21.11`, `just ingame 26.1.2`): `run-command` with `/seed`, whose reply is the same on both versions; `check-blocks` after `/setblock`; `verify-structure` with a template that the check puts in a datapack in the world's `datapacks` folder and places with `/place template`, then again after one block changes; `can-reach` to an open position and to a sealed one.

## Boundaries

- Always: answer with a clear pass or fail line first. Cap every list in a result.
- Ask first: nothing. The owner asked for the recommended option.
- Never: change minecraft-agent-skills or MinecraftStructureInjector. Never claim that the bot works in a Structure Lab world.

## Success criteria

- [ ] The four tools exist, with unit tests, and pass `just ingame` on 1.21.11 and 26.1.2.
- [ ] ADR 0004 answers whether the bot and Structure Lab can share a world and whether that is useful.
- [ ] `docs/verify-in-game.md` shows the three flows, and README.md lists the four tools.
- [ ] One issue is open in each of the two other repos, and the final report links both.
