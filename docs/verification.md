# Verification

This file records the last in-game check of each supported version in `src/minecraft-versions.ts`, and of 26.3, which the bot refuses. 26.2 is skipped and has no check. A version is supported only after `just ingame <version>` passed against a vanilla server of that version. See `docs/adr/0003-supported-minecraft-versions.md`.

## How to run

```bash
just ingame 1.21.11
just ingame 26.1.2
just ingame 26.3
```

26.3 is on the unsupported list in `src/minecraft-versions.ts`, so its run checks the refusal. `--expect-refusal` runs the refusal check against any other version.

`just ingame-all` runs all three in that order. Each run downloads the vanilla server jar into `MC_SERVER_CACHE` (default `~/.cache/minecraft-mcp-server/servers`) once and checks its SHA-1. It starts the server in offline mode on a flat world in a temporary folder, starts `bun src/main.ts` with the bun that runs the check, through the MCP SDK client, on a supported version calls every tool that the server lists, and checks world state with server console commands. For 26.3 it checks that the bot refuses the server and never joins. `--report <file>` writes the results as JSON.

The 1.21.11 server needs Java 21 or later, and the 26.1.2 and 26.3 servers need Java 25 or later. `JAVA_HOME_21` or `JAVA_HOME_25` picks a Java. Without them the check uses `java` on `PATH`.

## Results

| Version | Check | Result | Run at | mineflayer | bun | Java |
| --- | --- | --- | --- | --- | --- | --- |
| 1.21.11 | every tool | 28 of 28 passed | 2026-11-20 00:20 UTC | 4.39.0 | 1.4.5 | 25.0.4 |
| 26.1.2 | every tool | 28 of 28 passed | 2026-11-20 00:21 UTC | 4.39.0 | 1.4.5 | 25.0.4 |
| 26.3 | refusal | 5 of 5 passed | 2026-11-20 00:21 UTC | 4.39.0 | 1.4.5 | 25.0.4 |

- 1.21.11 and 26.1.2: every one of the 26 tools that `src/main.ts` registered on that date passed at least one check. `detect-gamemode` and `find-blocks` ran twice.
- 26.3: the bot refused the server before it joined, and each tool call returned the refusal message that names 1.21.11 and 26.1.2. 26.3 stays deferred until a mineflayer release supports it.

## What the unit tests cover

`just check` runs no server. Its unit tests prove that each supported version resolves in the installed minecraft-data to its protocol number, that mineflayer and minecraft-protocol list it as tested, that the gate refuses 26.3 and unknown protocols, and that the installed releases still have no 26.3 support.
