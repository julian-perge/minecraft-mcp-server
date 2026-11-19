# Spec: modernize the toolchain (#3)

Source issue: https://github.com/julian-perge/minecraft-mcp-server/issues/3. For commands, structure and code style, see [AGENTS.md](../AGENTS.md).

## Objective

The fork builds, lints and tests with the tools that the owner's other repos use, at current versions, and `just check` proves a change. The owner is the user. Contributors and agents run `just` recipes only.

## Decisions

- **Package manager.** bun is the only package manager. `package.json` has `"packageManager": "bun@1.4.4"`. `bun.lock` is the only lockfile. `package-lock.json` is deleted. ADR 0002 records this, as ~/code/minecraft-agent-skills ADR 0001 does for that repo.
- **Runtime.** The server still runs on Node. mineflayer 4.39.0 declares `"engines": {"node": ">=22"}`, so `engines.node` becomes `>=22`. The audit of #22 raised it to `>=22.12`, because on Node 22, yargs 18.2, oxlint and oxfmt need 22.12.0 or later. The bin stays `dist/main.js`, built by `tsc`. bun runs the tests and the scripts, not the server. Moving the server to the bun runtime is not in scope, because no check proves that mineflayer works on it.
- **Lint and format.** oxlint and oxfmt replace ESLint. Both are pinned to exact versions in `devDependencies` and run through prek hooks with `bun x`, as in ~/code/julianperge_profile. `.oxlintrc.json` starts from that repo's `oxlint.json`. The file needs oxlint's default name, because oxlint does not load `oxlint.json` without `-c` (found in the audit of #20). The one-time oxfmt rewrite is its own commit, listed in `.git-blame-ignore-revs`.
- **Type check.** `bun check` runs as a prek hook, as in ~/code/julianperge_profile. `tsc -p tsconfig.build.json` still builds `dist/`.
- **Tests.** `bun test` replaces AVA. sinon stays for stubs and fake timers, so the test bodies keep their logic and only the assertions change. AVA, `@ava/typescript`, `tsx`, `ts-node` and `eslint-plugin-ava` are removed.
- **Dependencies.** Every dependency moves to its current release: `@modelcontextprotocol/sdk` 1.32.2, mineflayer 4.39.0, minecraft-data 3.119.0, zod 4, yargs 18.2, TypeScript 7.0.2, `@types/node`, sinon. Dev tools are pinned to exact versions. Runtime dependencies keep a caret range, and `bun.lock` pins them. vec3 stays on 0.1.x, the line that mineflayer 4.39.0 depends on, because a second copy of vec3 0.2.0 gives `Vec3` two types that do not match.
- **MCP SDK API.** Tools register with `McpServer.registerTool` and an `inputSchema`, not with the deprecated `McpServer.tool`.
- **Install path for users.** The README tells users to clone the fork, run `just install` and `just build`, and point the MCP client at `node <clone>/dist/main.js`. The old `npx -y github:...` path needed npm and the `prepare` script, so it goes away with `prepare`.
- **CI.** `.github/workflows/build.yml` changes only so that it stays correct: it installs bun from `packageManager` and runs the same steps with bun and oxlint. `.github/dependabot.yml` moves from the `npm` to the `bun` ecosystem. Nothing else changes there. CI is deferred and not part of this work.

## Commands

| Command | What it does |
| --- | --- |
| `just install` | `bun install --frozen-lockfile` |
| `just check` | `just lint`, `just test`, `just build`, `just smoke` (added in #12) |
| `just lint` | prek on every file: builtin hooks, oxfmt, oxlint, `bun check`, `no-focused-tests` |
| `just test [files]` | `bun test` |
| `just build` | `bun run build` (`tsc -p tsconfig.build.json`) |
| `just dev [args]` | build, then `node dist/main.js` with the arguments |

## Project structure

No source file moves in this work. New or changed files: `package.json`, `bun.lock`, `.oxlintrc.json`, `.oxfmtrc.json` (only if a setting differs from the default), `.git-blame-ignore-revs`, `prek.toml`, `justfile`, `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `docs/adr/0002-bun-is-the-only-package-manager.md`, `.github/workflows/build.yml`, `.github/dependabot.yml`, `tests/*.test.ts`. Removed: `package-lock.json`, `eslint.config.mjs`.

## Code style

oxfmt's defaults decide the format. Code keeps its current structure. Comments follow the three tests in the owner's standards: necessary, a full sentence, complete.

## Testing strategy

- Unit tests: every current test moves to `bun test` and still passes. The count of tests does not drop.
- The MCP SDK move adds a test that `ToolFactory` registers a tool with `registerTool` and that the SDK answers invalid arguments with its "Invalid arguments for tool" error before the executor runs.
- No in-game check is needed for this work. Part 3 (#4) adds the in-game check for each supported version.

## Boundaries

- Always: run `just check` before each commit. Pass `--repo julian-perge/minecraft-mcp-server` to `gh`.
- Ask first: nothing. The owner gave the decisions above.
- Never: bump the package version, publish to npm, change a repo setting, or turn on Actions.

## Success criteria

- [ ] `just install && just check` passes in a fresh clone.
- [ ] No tracked file names npm, `package-lock.json`, ESLint or AVA, except history in an ADR or a spec.
- [ ] ADR 0002 records bun as the only package manager.
- [ ] oxlint and oxfmt are pinned in `package.json` and run from `prek.toml`.
- [ ] Every dependency is at its current release on 2026-11-19, except vec3, which mineflayer keeps on 0.1.x.
- [ ] README.md and CONTRIBUTING.md describe this fork and its bun commands.
