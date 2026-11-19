import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { isVersionName, sha1Hex, sha1Mismatch } from "./ingame-lib.js";

const MANIFEST_URL = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

interface ManifestEntry {
  id: string;
  url: string;
  sha1: string;
}

export interface VersionJson {
  id: string;
  javaVersion?: { majorVersion: number };
  downloads: { server?: { url: string; sha1: string; size: number } };
}

export interface ServerJar {
  version: string;
  jarPath: string;
  javaMajor: number;
  versionJson: VersionJson;
}

export function serverCacheDir(): string {
  return (
    process.env.MC_SERVER_CACHE || join(homedir(), ".cache", "minecraft-mcp-server", "servers")
  );
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchVersionJson(version: string): Promise<Uint8Array> {
  const manifest = JSON.parse(new TextDecoder().decode(await fetchBytes(MANIFEST_URL))) as {
    versions: ManifestEntry[];
  };
  const entry = manifest.versions.find((v) => v.id === version);
  if (!entry) {
    throw new Error(`Minecraft ${version} is not in the piston-meta manifest at ${MANIFEST_URL}`);
  }
  const bytes = await fetchBytes(entry.url);
  const mismatch = sha1Mismatch(entry.url, sha1Hex(bytes), entry.sha1);
  if (mismatch) throw new Error(mismatch);
  return bytes;
}

// The jar is downloaded to a temporary name and renamed only after its SHA-1 matches, so an interrupted download never looks like a cached jar.
export async function resolveServerJar(
  version: string,
  cacheDir = serverCacheDir(),
): Promise<ServerJar> {
  // The version names a folder in the cache, so a name such as ../x must not reach mkdir.
  if (!isVersionName(version)) {
    throw new Error(`"${version}" is not a Minecraft version name, such as 1.21.11 or 26.1.2.`);
  }
  const versionDir = join(cacheDir, version);
  const versionJsonPath = join(versionDir, "version.json");
  const jarPath = join(versionDir, "server.jar");
  await mkdir(versionDir, { recursive: true });

  if (!existsSync(versionJsonPath)) {
    await writeFile(versionJsonPath, await fetchVersionJson(version));
  }
  const versionJson = JSON.parse(await readFile(versionJsonPath, "utf8")) as VersionJson;
  const server = versionJson.downloads.server;
  if (!server) {
    throw new Error(`Minecraft ${version} has no server download in ${versionJsonPath}`);
  }

  if (!existsSync(jarPath)) {
    const partPath = `${jarPath}.part`;
    const bytes = await fetchBytes(server.url);
    const mismatch = sha1Mismatch(server.url, sha1Hex(bytes), server.sha1);
    if (mismatch) throw new Error(mismatch);
    await writeFile(partPath, bytes);
    await rename(partPath, jarPath);
  }

  const mismatch = sha1Mismatch(jarPath, sha1Hex(await readFile(jarPath)), server.sha1);
  if (mismatch) throw new Error(mismatch);

  return {
    version,
    jarPath,
    javaMajor: versionJson.javaVersion?.majorVersion ?? 8,
    versionJson,
  };
}

if (import.meta.main) {
  const version = process.argv[2];
  if (!version) {
    console.error("usage: bun scripts/server-jar.ts <version>");
    process.exit(2);
  }
  try {
    const jar = await resolveServerJar(version);
    console.log(jar.jarPath);
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
