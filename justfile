# Local shortcuts for checking, building and running the MCP server. `just` lists them, and `just <recipe>` runs one.
#
# CI does not call just. .github/workflows/build.yml runs ESLint, tsc, the tests and the build with bun directly, and does not run the prek hooks.

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

[doc('Run the gate that proves a change: lint, type check, unit tests and build')]
[group('check')]
check: lint typecheck test build

[doc('Run the prek hooks in prek.toml on every file, and show the diff of any file they fix')]
[group('check')]
lint: (require "prek" "bun")
    prek run --all-files --show-diff-on-failure

# A fixer hook exits 1 when it changes a file, so the second run fails only when a problem is left that no hook can fix.
[doc('Run the prek hooks and keep the fixes they make')]
[group('check')]
fmt: (require "prek" "bun")
    prek run --all-files || prek run --all-files

[doc('Type-check src and tests')]
[group('check')]
typecheck: (require "bun")
    bun x tsc --noEmit

[doc('Run the unit tests, or the given test files')]
[group('check')]
test *files: (require "bun")
    bun run test "$@"

[doc('Compile src into dist/')]
[group('build')]
build: (require "bun")
    bun run build

[doc('Start the server from source, for example: just dev --port 25566')]
[group('run')]
dev *args: (require "bun")
    bun run dev "$@"

# bun.lock is the only lockfile (docs/adr/0002-bun-is-the-only-package-manager.md), so install never resolves new versions.
[doc('Install the dependencies from bun.lock')]
[group('setup')]
install: (require "bun")
    bun install --frozen-lockfile
