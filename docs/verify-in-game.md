# Verify a build in game

The bot checks the result of a datapack, a structure or a server change in a running game. Each check below is a sequence of tool calls that an agent makes through this MCP server. Every verification tool answers `PASS` or `FAIL` on its first line.

ADR 0004 says why the checks run on a vanilla server and not in a Structure Lab world.

## Before you start

- Run a Minecraft server of a supported version, 1.21.11 or 26.1.2, with `online-mode=false`. `just ingame` checks the tools on vanilla servers only. Paper and Fabric servers of those versions speak the same protocol, but no check here ran on them. A server with NeoForge mods that add blocks or items is expected to refuse the bot, see ADR 0004.
- Make the bot an operator in the server console, for example `op LLMBot`. `run-command` can run only the commands that the server allows the bot to run.
- Keep the bot near the area to check. The bot sees only the chunks around it, and a block in a chunk it has not loaded counts as a failure. Use `move-to-position` or `fly-to` (creative mode) first.

## A datapack

This is the in-game step of the minecraft-datapack skill in julian-perge/minecraft-agent-skills.

1. Copy the datapack folder or zip into the world's `datapacks` folder.
2. `run-command` with `{"command": "reload"}`. The answer lists the server's replies.
3. `run-command` with `{"command": "datapack list enabled"}` to see that the pack is on.
4. `run-command` with `{"command": "function mypack:setup"}`.
5. `check-blocks` with the blocks that the function should place:

   ```json
   {
     "blocks": [
       { "x": 10, "y": 64, "z": 10, "block": "minecraft:chest", "properties": { "facing": "north" } },
       { "x": 11, "y": 64, "z": 10, "block": "minecraft:lantern" }
     ]
   }
   ```

6. `list-inventory` or `find-item` when the function gives items to the bot.

## A Structure Lab export

Structure Lab's `export_structure` tool returns a clean `.nbt` file, a vanilla datapack zip and a `/place template` command. Use the `26.1.2` branch of julian-perge/MinecraftStructureInjector, because the bot cannot join 26.3 yet.

1. Copy the datapack zip into the `datapacks` folder of a vanilla 26.1.2 server's world.
2. `run-command` with `{"command": "reload"}`. When the pack is not on yet, `run-command` with `{"command": "datapack enable \"file/house.zip\""}`, with the zip's file name.
3. Move the bot near the place for the structure.
4. `run-command` with `{"command": "place template lab_export:house 100 64 100"}`, the command from the export with a fixed position instead of `~ ~ ~`. Leave out the rotation and mirror arguments: `verify-structure` compares the template as it is in the file, with no rotation and no mirror.
5. `verify-structure` with the exported file and the same position:

   ```json
   { "path": "/absolute/path/to/house.nbt", "x": 100, "y": 64, "z": 100 }
   ```

   The answer lists each block that differs, with the expected and the found state. A template with several palettes, such as a vanilla shipwreck, is refused, because `/place template` picks one of them at random.

6. `can-reach` to each room that a player should reach, for example `{"x": 104, "y": 64, "z": 103}`. `can-reach` asks the pathfinder for a path and does not move the bot. The pathfinder opens fence gates but not doors, so give the doorway as the target, or open the doors in the game first.

## A WorldEdit paste

This is the in-game step of the minecraft-worldedit-ops skill: after a `//paste`, check the blocks and that a player can walk from spawn.

1. `move-to-position` to the spawn point.
2. `can-reach` to each point that a player must reach from spawn. `can-reach` counts only walking, jumping and climbing, not digging or building. A `FAIL` answer gives the pathfinder's status: `noPath` (no way in) or `timeout` (the search used all of `timeoutMs`).
3. `check-blocks` with a few blocks that the schematic must have, such as the floor under the spawn point and the doors.
