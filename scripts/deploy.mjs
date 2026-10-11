import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const vault = path.resolve(process.argv[2] || path.join(os.homedir(), "Documents/ObsidianVault"));
const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"));
if (!/^[a-z0-9-]+$/.test(manifest.id)) throw new Error("Invalid plugin ID");
await fs.access(path.join(vault, ".obsidian"));
const files = ["main.js", "manifest.json", "styles.css"];
const contents = await Promise.all(files.map(file => fs.readFile(path.join(root,file))));
let target = path.join(vault, ".obsidian/plugins", manifest.id);
let installedId = manifest.id;
// Update an existing development installation in place, preserving its data
// and enabled-plugin entry. Fresh installations use the published Curd ID.
try {
  await fs.access(target);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  const legacy = path.join(vault, ".obsidian/plugins/elton-reader-books");
  try {
    const previous = JSON.parse(await fs.readFile(path.join(legacy, "manifest.json"), "utf8"));
    if (previous.id === "elton-reader-books") {
      target = legacy;
      installedId = previous.id;
      contents[files.indexOf("manifest.json")] = Buffer.from(JSON.stringify({ ...manifest, id: installedId }, null, 2) + "\n");
    }
  } catch (legacyError) {
    if (legacyError.code !== "ENOENT") throw legacyError;
  }
}
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = path.join(root, ".local/plugin-backups", stamp);
for (const file of files) {
  try {
    const old = await fs.readFile(path.join(target, file));
    await fs.mkdir(path.dirname(path.join(backup, file)), { recursive: true });
    await fs.writeFile(path.join(backup, file), old);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
await fs.mkdir(target, { recursive: true });
for (const [index, file] of files.entries()) {
  await fs.mkdir(path.dirname(path.join(target, file)), { recursive: true });
  const temporary = path.join(target, `${file}.pending`);
  await fs.writeFile(temporary, contents[index]);
  await fs.rename(temporary, path.join(target, file));
}
for (const [index, file] of files.entries()) {
  const installed = await fs.readFile(path.join(target, file));
  if (!installed.equals(contents[index])) throw new Error(`Verification failed: ${file}`);
}
console.log(`Installed ${manifest.name} ${manifest.version} by ${manifest.author}: ${target} (${installedId})`);
console.log(`Reload or enable ${manifest.name} in Obsidian to load this build.`);
