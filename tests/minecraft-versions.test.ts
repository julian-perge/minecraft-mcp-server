import { describe, expect, test } from "bun:test";
import minecraftData from "minecraft-data";
import mineflayer from "mineflayer";
import { supportedVersions as protocolVersions } from "minecraft-protocol";
import {
  checkServerVersion,
  SUPPORTED_VERSIONS,
  supportedVersionNames,
  UNSUPPORTED_VERSIONS,
} from "../src/minecraft-versions.js";

// The minecraft-data release that ships a version's data is the one that the bot joins with, so these tests tie the list to the installed dependencies.
describe.each(SUPPORTED_VERSIONS.map((entry) => [entry.version, entry.protocol] as const))(
  "supported version %s",
  (version, protocol) => {
    test("resolves in minecraft-data to its protocol number and has block data", () => {
      const data = minecraftData(version);

      expect(data).toBeTruthy();
      expect(data.version.version).toBe(protocol);
      expect(data.blocksByName.stone).toBeTruthy();
    });

    test("is tested by mineflayer and minecraft-protocol", () => {
      const dataVersion = minecraftData(version).version.minecraftVersion ?? "no minecraftVersion";

      expect(mineflayer.testedVersions).toContain(dataVersion);
      expect(protocolVersions).toContain(dataVersion);
    });

    test("passes the gate with its exact version", () => {
      expect(checkServerVersion({ name: version, protocol })).toStrictEqual({
        supported: true,
        version,
      });
    });
  },
);

describe.each(UNSUPPORTED_VERSIONS.map((entry) => [entry.version, entry.protocol] as const))(
  "unsupported version %s",
  (version, protocol) => {
    test("has the protocol number that minecraft-data gives it", () => {
      // The typings say one version per protocol number, but minecraft-data stores a list, because several releases can share one protocol.
      const known = (minecraftData.postNettyVersionsByProtocolVersion.pc[protocol] ??
        []) as unknown as { minecraftVersion: string }[];

      expect(known.map((entry) => entry.minecraftVersion)).toContain(version);
    });

    // When a dependency update adds this version, this test fails on purpose, so that ADR 0003 and the list get a fresh look.
    test("still has no support in the installed mineflayer, minecraft-protocol or minecraft-data", () => {
      expect(minecraftData(version)).toBeFalsy();
      expect(mineflayer.testedVersions).not.toContain(version);
      expect(protocolVersions).not.toContain(version);
    });

    test("is refused with its reason and the supported list", () => {
      const check = checkServerVersion({ name: version, protocol });

      expect(check.supported).toBe(false);
      if (!check.supported) {
        expect(check.message).toContain(
          `${version} (protocol ${protocol}), which is not supported.`,
        );
        expect(check.message).toContain(
          UNSUPPORTED_VERSIONS.find((e) => e.version === version)!.reason,
        );
        expect(check.message).toContain("Supported versions: 1.21.11, 26.1.2.");
      }
    });
  },
);

test("the supported list names 1.21.11 and 26.1.2", () => {
  expect(supportedVersionNames()).toBe("1.21.11, 26.1.2");
});

test("a 26.1 server passes the gate as 26.1.2, since both use protocol 775", () => {
  expect(checkServerVersion({ name: "26.1", protocol: 775 })).toStrictEqual({
    supported: true,
    version: "26.1.2",
  });
});

test("an unknown protocol is refused without a reason", () => {
  const check = checkServerVersion({ name: "1.8.9", protocol: 47 });

  expect(check).toStrictEqual({
    supported: false,
    message:
      "The Minecraft server runs 1.8.9 (protocol 47), which is not supported. Supported versions: 1.21.11, 26.1.2.",
  });
});
