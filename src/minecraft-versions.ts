// docs/adr/0003-supported-minecraft-versions.md records why each version is on these lists. README.md, AGENTS.md and docs/verification.md name the same versions.

export interface SupportedVersion {
  version: string;
  protocol: number;
}

export interface UnsupportedVersion {
  version: string;
  protocol: number;
  reason: string;
}

// Each supported version passed `just ingame`. 26.1 and 26.1.1 share protocol 775 with 26.1.2, so the gate lets them in, but only 26.1.2 is checked in game.
export const SUPPORTED_VERSIONS: readonly SupportedVersion[] = [
  { version: "1.21.11", protocol: 774 },
  { version: "26.1.2", protocol: 775 },
];

export const UNSUPPORTED_VERSIONS: readonly UnsupportedVersion[] = [
  { version: "26.2", protocol: 776, reason: "This project skips 26.2." },
  {
    version: "26.3",
    protocol: 777,
    reason: "Support waits for a mineflayer release that supports 26.3.",
  },
];

export type VersionCheck =
  | { supported: true; version: string }
  | { supported: false; message: string };

export function supportedVersionNames(): string {
  return SUPPORTED_VERSIONS.map((entry) => entry.version).join(", ");
}

export function checkServerVersion(server: { name: string; protocol: number }): VersionCheck {
  const supported = SUPPORTED_VERSIONS.find((entry) => entry.protocol === server.protocol);
  if (supported) {
    return { supported: true, version: supported.version };
  }

  const known = UNSUPPORTED_VERSIONS.find((entry) => entry.protocol === server.protocol);
  const reason = known ? ` ${known.reason}` : "";
  return {
    supported: false,
    message:
      `The Minecraft server runs ${server.name} (protocol ${server.protocol}), which is not supported.${reason} ` +
      `Supported versions: ${supportedVersionNames()}.`,
  };
}
