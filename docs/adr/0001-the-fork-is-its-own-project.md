# ADR-0001: The fork is its own project

## Status

Accepted

## Date

2026-11-19

## Context

julian-perge/minecraft-mcp-server is a GitHub fork of
yuniko-software/minecraft-mcp-server. On 2026-11-19 the two main branches were
identical (`240c8ce`). The owner wants a fork that is up to date and that
follows the owner's own tooling: the agent-skills workflow, `just`, `prek`,
bun and oxlint. Upstream uses npm, ESLint, AVA and Dependabot, and takes
contributions as pull requests from forks.

GitHub keeps the fork link, so `gh` in this clone can pick the parent repo as
the base of a pull request or as the target of an issue.

## Decision

- The fork is its own project. It can restructure files, rename tools and
  drop upstream conventions.
- No pull request goes to upstream. Upstream merges do not need to stay clean.
- Every `gh` command that writes passes
  `--repo julian-perge/minecraft-mcp-server`.
- Work goes through the agent-skills workflow in `docs/agents/workflow.md`,
  with GitHub Issues on the fork as the tracker.

## Alternatives Considered

### Stay a thin fork that tracks upstream

- Pros: upstream fixes merge with few conflicts.
- Cons: every change must fit upstream's tools and layout, which the owner
  does not use in other repos.
- Rejected: the owner chose to diverge freely.

### Detach the fork into a new repo

- Pros: `gh` can no longer pick the parent repo.
- Cons: it is a repo setting that is hard to undo, and it changes the repo's
  URL and history links.
- Rejected for now: it stays a decision for the owner. `--repo` on every
  write covers the risk until then.

## Consequences

- A fix from upstream comes in by hand, as a cherry-pick or a rewrite.
- Docs and links name the fork, not upstream.
- A detach or a rename of the repo stays a deferred decision for the owner.
