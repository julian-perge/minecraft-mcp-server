# Verification

This file records the last in-game check of each Minecraft version in `src/minecraft-versions.ts`. A version is supported only after `just ingame <version>` passed against a vanilla server of that version. See `docs/adr/0003-supported-minecraft-versions.md`.

## How to run

```bash
just ingame 1.21.11
just ingame 26.1.2
just ingame 26.3 --expect-refusal
```

`just ingame-all` runs all three in that order. Each run downloads the vanilla server jar into `MC_SERVER_CACHE` (default `~/.cache/minecraft-mcp-server/servers`) once and checks its SHA-1. It starts the server in offline mode on a flat world in a temporary folder, starts `node dist/main.js` through the MCP SDK client, calls every tool the server lists, and checks world state with server console commands. `--report <file>` writes the results as JSON.

The 1.21.11 server needs Java 21 or later, and the 26.1.2 and 26.3 servers need Java 25 or later. `JAVA_HOME_21` or `JAVA_HOME_25` picks a Java. Without them the check uses `java` on `PATH`.

## Results

| Version | Check | Result | Date | mineflayer | Node | Java |
| --- | --- | --- | --- | --- | --- | --- |
| 1.21.11 | every tool | 24 of 24 passed | 2026-11-19 | 4.39.0 | v26.13.1 | 25.0.4 |
| 26.1.2 | every tool | 24 of 24 passed | 2026-11-19 | 4.39.0 | v26.13.1 | 25.0.4 |
| 26.3 | refusal | 5 of 5 passed | 2026-11-19 | 4.39.0 | v26.13.1 | 25.0.4 |

- 1.21.11 and 26.1.2: every one of the 22 tools that `src/main.ts` registered on that date passed at least one check. `detect-gamemode` and `find-blocks` ran twice.
- 26.3: the bot refused the server before it joined, and each tool call returned the refusal message that names 1.21.11 and 26.1.2. 26.3 stays deferred until a mineflayer release supports it.

## What the unit tests cover

`just check` runs no server. Its unit tests prove that each supported version resolves in the installed minecraft-data to its protocol number, that mineflayer and minecraft-protocol list it as tested, that the gate refuses 26.3 and unknown protocols, and that the installed releases still have no 26.3 support.
