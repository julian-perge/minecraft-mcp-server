# ADR-0002: Bun is the only package manager

## Status

Accepted

## Date

2026-11-19

## Context

The fork came from upstream with npm, `package-lock.json` and a `prepare`
script that built `dist/` when `npx -y github:...` installed the package.
The owner's other repos use bun as the only package manager
(~/code/minecraft-agent-skills ADR 0001) and want one lockfile. Issue #3 asks
for bun as the only package manager.

mineflayer 4.39.0 declares `"engines": {"node": ">=22"}`. The server talks
to Minecraft through mineflayer's network, zlib and crypto code, and only Node
has been checked to run it.

## Decision

- bun is the only package manager. `package.json` has
  `"packageManager": "bun@1.4.4"`, and `bun.lock` is the only lockfile.
- `package-lock.json` is deleted. No doc, script or recipe names npm as a
  fallback.
- The server runs on Node 22 or later. `engines.node` says so. bun installs
  the dependencies and runs the tests and scripts.
- The `prepare` script is removed. Users install from a clone with
  `just install` and `just build`, and point their MCP client at
  `node <clone>/dist/main.js`.
- CI reads the bun version from `packageManager` with `oven-sh/setup-bun`
  and `bun-version-file`.

## Alternatives Considered

### Keep npm as a fallback

- Pros: users without bun can install.
- Cons: with no `package-lock.json`, npm resolves unpinned versions.
- Rejected: an unpinned fallback can pass or fail for reasons that the checks
  never see.

### Run the server on the bun runtime

- Pros: one runtime, and no build step for development.
- Cons: no check proves that mineflayer and minecraft-protocol work on bun.
- Rejected for now: the in-game checks run on Node. A move needs those checks
  on bun first.

### Keep `npx -y github:...` as the install path

- Pros: one line in the MCP client config.
- Cons: it needs npm and a `prepare` script that builds on every install.
- Rejected: it conflicts with bun as the only package manager.

## Consequences

- A dependency change updates `bun.lock` only.
- Contributors install bun 1.4.4 or later and Node 22 or later.
- The MCP client config needs the path of a local clone.
