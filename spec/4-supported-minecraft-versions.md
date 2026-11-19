# Spec: supported Minecraft versions with a check for each (#4)

Source issue: https://github.com/julian-perge/minecraft-mcp-server/issues/4. For commands, structure and code style, see [AGENTS.md](../AGENTS.md).

## Objective

The bot names the Minecraft versions it supports, refuses every other version with a clear message, and each version it claims has passed a check in a real game. The list matches ~/code/minecraft-agent-skills/docs/adr/0002-supported-minecraft-versions.md: 1.21.11, 26.1.2 and 26.3, with 26.2 skipped.

## Facts on 2026-11-19

- mineflayer 4.39.0 (the latest release) lists `1.21.11` and `26.1` in `lib/version.js` `testedVersions`. minecraft-protocol 1.68.0 lists the same.
- minecraft-data 3.119.0 resolves `1.21.11` to protocol 774 and `26.1.2` to the `26.1` data with protocol 775. It knows the protocol number of 26.3 (777) but has no data for it, so `minecraftData("26.3")` is null.
- 26.3 support exists only in open pull requests: PrismarineJS/mineflayer#4213, PrismarineJS/node-minecraft-protocol#1532 and #1553, PrismarineJS/minecraft-data#1345 and #1348.
- Mojang's 1.21.11 server needs Java 21. The 26.1.2 and 26.3 servers need Java 25 (piston-meta `javaVersion`).

## Decisions

- **Supported now:** 1.21.11 and 26.1.2. **Deferred:** 26.3, until a mineflayer release supports it. **Skipped:** 26.2. ADR 0003 records this, and the deferral goes to the owner as a decision.
- **One source of truth:** `src/minecraft-versions.ts` holds the list: each supported version with its protocol number, and each known but unsupported version with the reason. Docs name the same versions.
- **The gate:** before the bot joins, the server pings the Minecraft server with minecraft-protocol's `ping`. It matches the protocol number to the list. A supported protocol makes the bot join with that exact version. Any other protocol stops the join, and every tool call returns a message that names the server's version and the supported versions. The bot does not try to join an unsupported server, because mineflayer fails there in ways that do not name the cause.
- **The in-game check:** `scripts/ingame-check.ts`, run with bun. It starts a vanilla server in a temporary folder (offline mode, flat world, a free port), starts the built MCP server with `node dist/main.js` through the MCP SDK client, calls every tool, and checks each result. It confirms world changes with server console commands such as `execute if block`. It prints a table and exits non-zero on any failure. For a deferred version, it checks that the tools return the refusal message.
- **Server jars:** `scripts/server-jar.ts` finds the jar URL and SHA-1 in Mojang's piston-meta manifest, downloads it once into a cache folder (`MC_SERVER_CACHE`, default `~/.cache/minecraft-mcp-server/servers`), and checks the SHA-1.
- **Java:** the check reads the Java major version the server needs from piston-meta and uses `JAVA_HOME_<major>` when it is set, else `java` on PATH, and stops with a message when that Java is too old.
- **Record:** `docs/verification.md` lists each version, the date, the mineflayer version, and the result of the last in-game check, as a table.

## Commands

| Command | What it does |
| --- | --- |
| `just ingame <version>` | Run the in-game check against one version. |
| `just ingame-all` | Run it for 1.21.11 and 26.1.2, then the refusal check for 26.3. |
| `just server-jar <version>` | Download and check one server jar. |
| `just check` | Also starts the built server in Node with `--help` (`just smoke`), because bun accepted an import that Node refused. It runs no Minecraft server. |

## Project structure

- `src/minecraft-versions.ts`: the list, and `resolveServerVersion(protocol)`.
- `src/bot-connection.ts`: pings, gates, then calls `mineflayer.createBot` with the exact version.
- `scripts/ingame-check.ts`, `scripts/server-jar.ts`: the in-game check and the jar download.
- `docs/adr/0003-supported-minecraft-versions.md`, `docs/verification.md`.
- Tests: `tests/minecraft-versions.test.ts`, and new cases in `tests/bot-connection.test.ts`.

## Testing strategy

- **Unit tests** (`just test`): the list agrees with minecraft-data (each supported version resolves to its protocol and has block data) and with mineflayer's `testedVersions`; an unsupported protocol gives the refusal message; the gate passes the exact version to `createBot`.
- **In game** (`just ingame`): every tool on 1.21.11 and 26.1.2, and the refusal on 26.3. The in-game check is not part of `just check`, because it needs Java, a download and about a minute per version.

## Boundaries

- Always: name versions exactly. Claim a version in README.md only after it passed `just ingame`.
- Ask first: nothing. The version list comes from the owner and the ADR in minecraft-agent-skills.
- Never: depend on an unreleased mineflayer, minecraft-protocol or minecraft-data build. Never claim 26.3.

## Success criteria

- [ ] ADR 0003 records 1.21.11 and 26.1.2 as supported, 26.3 as deferred and 26.2 as skipped.
- [ ] The bot refuses a 26.3 server with a message that names the supported versions.
- [ ] `just ingame 1.21.11` and `just ingame 26.1.2` pass, and `just ingame 26.3` passes its refusal check.
- [ ] README.md, AGENTS.md and `docs/verification.md` name the same versions as `src/minecraft-versions.ts`.
