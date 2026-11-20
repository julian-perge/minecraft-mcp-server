# ADR-0005: The server runs on bun

## Status

Accepted. It replaces the part of ADR 0002 that kept the server on Node.

## Date

2026-11-19

## Context

ADR 0002 made bun the only package manager and kept the server on Node,
because no check proved that mineflayer and minecraft-protocol work on bun.
The server was compiled by `tsc` into `dist/`, and Node ran `dist/main.js`.
That is why `tsconfig.json` used `"module": "NodeNext"`: it makes each
relative import end in `.js`, which Node needs to load the compiled files.
Upstream chose `NodeNext` in its first commit and moved the target from
ES2020 to ES2022 in v2.0.0. Neither commit gives a reason.

On 2026-11-19 the in-game check started the server with `bun src/main.ts` in
place of `node dist/main.js`. On bun 1.4.5 it passed 28 of 28 checks on
Minecraft 1.21.11 and 28 of 28 on 26.1.2, the same results as on Node. That
is the check that ADR 0002 asked for.

## Decision

- The server runs on bun 1.4.4 or later: `bun <clone>/src/main.ts`. Node is
  not needed. `engines` names bun only.
- There is no build step. `tsconfig.build.json`, `just build` and `dist/`
  are removed.
- `tsconfig.json` uses the settings of a bun project: `"target": "ESNext"`,
  `"module": "Preserve"`, `"moduleResolution": "bundler"`,
  `allowImportingTsExtensions` and `verbatimModuleSyntax`. Relative imports
  end in `.ts`, the file that runs.
- `noUncheckedIndexedAccess`, `noImplicitOverride` and
  `noFallthroughCasesInSwitch` are on. `tsconfig.test.json` adds the tests
  and turns `noUncheckedIndexedAccess` off for them, because the tests index
  arrays that they set up themselves.
- oxlint runs with `--type-aware` through oxlint-tsgolint.
- The in-game check starts the server with the bun that runs the check, and
  its report records the bun version.

## Alternatives Considered

### Keep Node, and build `dist/` with `bun build --target=node`

- Pros: users keep Node. `tsconfig.json` can still use the bundler settings,
  because tsc only checks types.
- Cons: a build step stays, and two runtimes stay in the setup.
- Rejected: the in-game check passed on bun, so Node adds nothing.

### Keep Node and `tsc`, and only add the stricter flags

- Pros: the smallest change.
- Cons: `NodeNext` and the `.js` imports stay, and so does the build step.
- Rejected: it keeps the setup that only Node needs.

## Consequences

- MCP client configs run `bun`, not `node`. A config that points at
  `dist/main.js` stops working after an update.
- `just check` starts the server with `bun src/main.ts --help`, in place of
  the build and the Node start.
- A clone made before this change can still have a `dist/` folder. Git
  ignores it, and nothing reads it.
- A later mineflayer release can need a Node API that bun does not have. Run
  `just ingame-all` after each mineflayer update.
