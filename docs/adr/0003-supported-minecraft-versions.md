# ADR-0003: The supported Minecraft versions are 1.21.11 and 26.1.2, and 26.3 waits for mineflayer

## Status

Accepted

## Date

2026-11-19

## Context

The owner's Minecraft projects support 1.21.11, 26.1.2 and 26.3, and skip
26.2 (~/code/minecraft-agent-skills ADR 0002). Issue #4 asks this fork to
support the same list and to put a check behind each version it claims.

The bot is mineflayer. On 2026-11-19 the latest releases were mineflayer
4.39.0, minecraft-protocol 1.68.0 and minecraft-data 3.119.0:

- mineflayer and minecraft-protocol list `1.21.11` and `26.1` as tested.
  26.1, 26.1.1 and 26.1.2 share protocol 775, and minecraft-data resolves
  `26.1.2` to the `26.1` data.
- minecraft-data knows the protocol number of 26.3 (777) but has no data for
  it. Support for 26.3 exists only in open pull requests:
  PrismarineJS/mineflayer#4124 and #4206,
  PrismarineJS/node-minecraft-protocol#1532 and #1553, and
  PrismarineJS/minecraft-data#1345 and #1348.
  PrismarineJS/mineflayer#4213 is the open issue that tracks it.

Before this decision the bot joined any server and named 1.21.11 only in an
error message. On a version that mineflayer does not support, the join fails
in ways that do not name the cause.

## Decision

- The bot supports 1.21.11 and 26.1.2. `src/minecraft-versions.ts` holds the
  list with the protocol number of each version.
- 26.3 is deferred until a mineflayer release supports it. The fork does not
  claim 26.3 and does not depend on an unreleased build.
- 26.2 is skipped.
- The bot pings the server before it joins. It joins a supported protocol with
  the exact version, and refuses any other protocol. Every tool call then
  returns a message that names the server's version and the supported
  versions.
- A version is claimed only after `just ingame <version>` passed against a
  vanilla server of that version. `docs/verification.md` records each run.

## Alternatives Considered

### Claim 26.3 on mineflayer's open pull requests

- Pros: the fork would match the full list today.
- Cons: the code is unreleased and can change before release. The fork would
  depend on git builds of three packages.
- Rejected: a claim needs a released dependency and an in-game check.

### Let the bot join any version, as before

- Pros: no gate code.
- Cons: a user on 26.3 gets a failure that does not say why.
- Rejected: the refusal names the cause and the supported versions.

### Refuse 26.1 and 26.1.1 by name

- Pros: only the exact checked release passes.
- Cons: the three releases share one protocol, so the bot speaks to them in
  the same way. Not every server reports its exact release in the ping.
- Rejected: the gate matches on the protocol number.

## Consequences

- When a mineflayer release adds 26.3, the unit test "still has no support in
  the installed mineflayer, minecraft-protocol or minecraft-data" fails on the
  dependency update. That failure is the prompt to run `just ingame 26.3`,
  move 26.3 to the supported list and update this ADR.
- Each new Minecraft release needs an explicit change to the list, the docs
  and an in-game run.
