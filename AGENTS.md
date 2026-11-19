# Working on minecraft-mcp-server

An MCP server that drives a mineflayer bot in a Minecraft Java server. An MCP
client, such as Claude Code or Claude Desktop, starts it over stdio and calls
its tools. It started as a fork of yuniko-software/minecraft-mcp-server and is
now its own project. See `docs/adr/0001-the-fork-is-its-own-project.md`.

## Commands

Run the project's tasks through their `just` recipes. `just` lists them, and
a recipe stops with a message when a tool it needs is missing.

- `just check` runs the lint, the type check, the unit tests, the build and
  a start of the built server in Node. It is the one command that proves a
  change. It runs no Minecraft server.
- `just ingame <version>` runs the bot against a real vanilla server of that
  version and calls every tool. Run it after a change to a tool, to the
  connection or to a dependency of mineflayer, and record the result in
  `docs/verification.md`. `just ingame-all` runs every version. It needs
  Java, and it downloads the server jar once into `MC_SERVER_CACHE`.
- `just lint` runs the prek hooks in `prek.toml` on every file. `just fmt`
  runs them, runs them again when the first run fails, and keeps their fixes.
- `just test` runs the unit tests. `just test tests/chat-tools.test.ts`
  runs one file.
- `just dev` builds the server and starts it in Node. Arguments pass
  through, for example `just dev --port 25566`.

## Setup

- Install bun 1.4.4 or later, Node 22.12 or later, `just` and `prek` 0.5.0
  or later. bun is the only package manager and runs the tests and scripts. The
  server itself runs on Node. See
  `docs/adr/0002-bun-is-the-only-package-manager.md`.
- The in-game check also needs Java 21 or later for 1.21.11, and Java 25 or
  later for 26.1.2 and 26.3.
- `just install` installs the dependencies from `bun.lock`.
- `prek install` makes the hooks run on each commit.
- The workflow needs the `agent-skills` CLI. It is in the `bin/` folder of
  julian-perge/agent-skills. Put that folder on `PATH`.

## Minecraft versions

- The bot supports Minecraft 1.21.11 and 26.1.2. 26.3 is deferred until a
  mineflayer release supports it, and 26.2 is skipped. See
  `docs/adr/0003-supported-minecraft-versions.md`.
- `src/minecraft-versions.ts` is the one list. README.md and
  `docs/verification.md` name the same versions. Claim a version only after
  `just ingame <version>` passed.
- Name exact versions, not "26.x" or "1.21.x".

## Fork rules

- Never open a pull request to yuniko-software/minecraft-mcp-server.
- Pass `--repo julian-perge/minecraft-mcp-server` to every `gh` command
  that writes. In a fork, a bare `gh` can pick the parent repo as the base
  of a pull request.
- A change does not need to keep upstream merges clean. Restructure files,
  rename tools and drop upstream conventions when that makes the code better.

## Every task

- Run `just check` before each commit.

## Workflow

- Tasks are tracked in GitHub Issues for julian-perge/minecraft-mcp-server, with the `gh` CLI. `/agent-skills:plan` creates one sub-issue per task. `tasks/` is git-ignored scratch.
- Specs are files at `spec/<issue>-<slug>.md`, not `SPEC.md`.
- ADRs go in `docs/adr/`. Read `GLOSSARY.md` and `docs/adr/` (those that exist) before design work.
- Start each `/agent-skills` stage with `agent-skills brief <stage> <n>`. It prints every rule of `docs/agents/workflow.md` that the stage needs, so do not read that file in a stage. Before other work in this repo, read all of `docs/agents/workflow.md`.
