import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const vault = path.resolve(process.argv[2] || path.join(os.homedir(), "Documents/ObsidianVault"));
const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"));
if (!/^[a-z0-9-]+$/.test(manifest.id)) throw new Error("Invalid plugin ID");
await fs.access(path.join(vault, ".obsidian"));
const files = ["main.js", "manifest.json", "styles.css"];
const contents = await Promise.all(files.map(file => fs.readFile(path.join(root,file))));
const target = path.join(vault, ".obsidian/plugins", manifest.id);
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
console.log(`Installed Book Reader ${manifest.version}: ${target}`);
console.log("Reload or enable Book Reader in Obsidian to load this build.");
