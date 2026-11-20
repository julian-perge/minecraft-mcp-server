# Contributing

Work on this repo goes through GitHub issues on julian-perge/minecraft-mcp-server. [AGENTS.md](AGENTS.md) and [docs/agents/workflow.md](docs/agents/workflow.md) give the full rules. This file is the short version.

## Set up

Install bun 1.4.4 or later, [just](https://just.systems) and [prek](https://prek.j178.dev) 0.5.0 or later. Then:

```bash
just install
prek install
```

`prek install` makes the hooks in `prek.toml` run on each commit: oxfmt, oxlint with type information, `bun check` on the code and on the tests, a check for focused tests (`.only`) and the file checks.

## Make a change

1. Open an issue, or pick one with the `ready-for-agent` or `ready-for-human` label.
2. Make a branch named `<type>/<issue>-<slug>`, for example `fix/12-dig-block-timeout`.
3. Write a failing test in `tests/` first when the change fixes a bug or changes behavior.
4. Run `just check`. It must pass before each commit.
5. Open a pull request against `main` of this repo. Put `(#<issue>)` in the title and `Closes #<issue>` in the body.

Pass `--repo julian-perge/minecraft-mcp-server` to every `gh` command that writes. In a fork, a bare `gh` can pick the parent repo as the base of a pull request.

## Try a change with a client

Restart your MCP client. The client config points at `src/main.ts` in your clone, as the README shows, so the client runs your change. `just dev` starts the server in the terminal, which helps when you read the logs on stderr.

The [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) calls single tools without a full client.
