# Local shortcuts for checking, building and running the MCP server. `just` lists them, and `just <recipe>` runs one.
#
# CI does not call just. .github/workflows/build.yml runs oxlint, the type check, the tests and the build with bun directly, and does not run the prek hooks.

set shell := ["bash", "-euo", "pipefail", "-c"]

# Recipe arguments arrive as $1, $2 and so on, so variadic recipes forward them with "$@" and keep each argument intact.
set positional-arguments

[private]
default:
    @just --list --unsorted

# Recipes that call a tool depend on this, so a missing tool stops the recipe before it starts. The Setup section of AGENTS.md says what to install.
[private]
require +tools:
    #!/usr/bin/env bash
    set -euo pipefail
    missing=()
    for tool in "$@"; do
        command -v "$tool" >/dev/null || missing+=("$tool")
    done
    if [ ${#missing[@]} -gt 0 ]; then
        echo "error: missing ${missing[*]}. See the Setup section of AGENTS.md." >&2
        exit 1
    fi

# The lint recipe runs the type check too, through the bun-check hook in prek.toml.
[doc('Run the gate that proves a change: lint, type check, unit tests and build')]
[group('check')]
check: lint test build smoke

[doc('Run the prek hooks in prek.toml on every file, and show the diff of any file they fix')]
[group('check')]
lint: (require "prek" "bun")
    prek run --all-files --show-diff-on-failure

# A fixer hook exits 1 when it changes a file, so the second run fails only when a problem is left that no hook can fix.
[doc('Run the prek hooks and keep the fixes they make')]
[group('check')]
fmt: (require "prek" "bun")
    prek run --all-files || prek run --all-files

[doc('Type-check src, tests and scripts')]
[group('check')]
typecheck: (require "bun")
    bun check

[doc('Run the unit tests, or the given test files')]
[group('check')]
test *files: (require "bun")
    bun run test "$@"

# bun runs the unit tests and resolves CommonJS imports that Node refuses, so this loads the built server in Node, the runtime that users run.
[doc('Start the built server in Node with --help, which loads every module and exits')]
[group('check')]
smoke: (require "node")
    node dist/main.js --help > /dev/null

[doc('Compile src into dist/')]
[group('build')]
build: (require "bun")
    bun run build

[doc('Start the server from source, for example: just dev --port 25566')]
[group('run')]
dev *args: (require "bun" "node")
    bun run dev "$@"

[doc('Run the in-game check against a real Minecraft server, for example: just ingame 1.21.11')]
[group('ingame')]
ingame version *flags: (require "bun" "node" "java") build
    bun scripts/ingame-check.ts "$@"

# 26.3 is deferred until a mineflayer release supports it, so its run checks that the bot refuses the server (spec/4-supported-minecraft-versions.md).
[doc('Run the in-game check for every supported version, then the refusal check for 26.3')]
[group('ingame')]
ingame-all: (require "bun" "node" "java") build
    bun scripts/ingame-check.ts 1.21.11
    bun scripts/ingame-check.ts 26.1.2
    bun scripts/ingame-check.ts 26.3 --expect-refusal

[doc('Download a vanilla server jar into the cache, check its SHA-1 and print its path')]
[group('ingame')]
server-jar version: (require "bun")
    bun scripts/server-jar.ts "$@"

# bun.lock is the only lockfile (docs/adr/0002-bun-is-the-only-package-manager.md), so install never resolves new versions.
[doc('Install the dependencies from bun.lock')]
[group('setup')]
install: (require "bun")
    bun install --frozen-lockfile
