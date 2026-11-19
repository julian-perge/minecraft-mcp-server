# Working on minecraft-mcp-server

An MCP server that drives a mineflayer bot in a Minecraft Java server. An MCP
client, such as Claude Code or Claude Desktop, starts it over stdio and calls
its tools. It started as a fork of yuniko-software/minecraft-mcp-server and is
now its own project. See `docs/adr/0001-the-fork-is-its-own-project.md`.

## Commands

Run the project's tasks through their `just` recipes. `just` lists them, and
a recipe stops with a message when a tool it needs is missing.

- `just check` runs the lint, the type check, the unit tests and the build.
  It is the one command that proves a change.
- `just lint` runs the prek hooks in `prek.toml` on every file. `just fmt`
  runs them twice and keeps their fixes.
- `just test` runs the unit tests. `just test tests/chat-tools.test.ts`
  runs one file.
- `just dev` starts the server from source. Arguments pass through, for
  example `just dev --port 25566`.

## Setup

- Install Node 20.10 or later, `just` and `prek`.
- `just install` installs the dependencies from `package-lock.json`.
- `prek install` makes the hooks run on each commit.

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
