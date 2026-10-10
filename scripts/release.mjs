import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';

const root = path.resolve(new URL('../',import.meta.url).pathname);
const read = file => fs.readFile(path.join(root,file));
const manifest = JSON.parse(await read('manifest.json'));
const pkg = JSON.parse(await read('package.json'));
const versions = JSON.parse(await read('versions.json'));
if (manifest.id !== 'curd-reader' || manifest.version !== pkg.version || versions[manifest.version] !== manifest.minAppVersion) throw new Error('Release metadata mismatch');
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Release tag must be x.y.z');
const files = ['main.js','manifest.json','styles.css','LICENSE','NOTICE.md','README.md'];
const notices = (await fs.readdir(path.join(root,'licenses'))).sort().map(name=>'licenses/'+name);
files.push(...notices);
const destination = path.join(root,'dist',manifest.version);
await fs.mkdir(destination,{recursive:true});
const zip = new JSZip(), checksums = [];
for (const file of files) {
  const data = await read(file);
  if (!data.length) throw new Error('Empty release file: '+file);
  const target = path.join(destination,file);
  await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,data);
  zip.file(file,data,{date:new Date('2026-10-10T00:00:00Z')});
  checksums.push(`${crypto.createHash('sha256').update(data).digest('hex')}  ${file}`);
}
const archive = await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
const archiveName = `curd-reader-${manifest.version}.zip`;
await fs.writeFile(path.join(destination,archiveName),archive);
checksums.push(`${crypto.createHash('sha256').update(archive).digest('hex')}  ${archiveName}`);
await fs.writeFile(path.join(destination,'SHA256SUMS.txt'),checksums.join('\n')+'\n');
for (const file of files) if (!(await read(file)).equals(await fs.readFile(path.join(destination,file)))) throw new Error('Release copy differs: '+file);
console.log(`Prepared Curd Reader ${manifest.version}: ${destination}`);
