export const MAX_FOLDER_DEPTH = 5;
export const emptyLibrary = () => ({ version: 1, folders: [], books: {}, migratedLegacyTags: false });
const folderIndexes = new WeakMap();
function folderIndex(data) {
  let cached = folderIndexes.get(data);
  if (!cached || cached.folders !== data.folders || cached.size !== data.folders.length) {
    cached = { folders: data.folders, size: data.folders.length, index: new Map(data.folders.map(folder => [folder.id,folder])) }; folderIndexes.set(data,cached);
  }
  return cached.index;
}
export function folderTrail(data, id) {
  const byId = folderIndex(data);
  const trail = [], seen = new Set();
  while (id) {
    if (seen.has(id) || !byId.has(id)) throw new Error('Неверная структура папок');
    seen.add(id); const folder = byId.get(id); trail.unshift(folder); id = folder.parentId;
    if (trail.length > MAX_FOLDER_DEPTH) throw new Error('Допустимо не более пяти уровней папок');
  }
  return trail;
}
export function validateLibrary(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.folders) || !data.books || typeof data.books !== 'object' || Array.isArray(data.books)) throw new Error('Неверный файл библиотеки');
  const ids = new Set(), siblings = new Set();
  for (const folder of data.folders) {
    if (!folder || typeof folder.id !== 'string' || !folder.id || typeof folder.parentId !== 'string' || typeof folder.name !== 'string' || !folder.name.trim() || folder.name.length > 120) throw new Error('Неверная папка');
    if (ids.has(folder.id)) throw new Error('Повторный идентификатор папки');
    ids.add(folder.id);
    const key = JSON.stringify([folder.parentId, folder.name.trim().toLocaleLowerCase()]);
    if (siblings.has(key)) throw new Error('Папка с таким названием уже есть');
    siblings.add(key);
  }
  for (const folder of data.folders) folderTrail(data, folder.id);
  for (const [path, memberships] of Object.entries(data.books)) {
    if (!path || ['__proto__','constructor','prototype'].includes(path) || !Array.isArray(memberships) || memberships.some(id => !ids.has(id)) || new Set(memberships).size !== memberships.length) throw new Error('Неверные ссылки книг на папки');
  }
  return data;
}
export function addLibraryFolder(data, name, parentId = '', id = 'folder-' + Date.now().toString(36) + Math.random().toString(36).slice(2,8)) {
  name = String(name || '').replace(/\s+/g,' ').trim();
  if (!name) throw new Error('Введите название папки');
  if (parentId && !data.folders.some(folder => folder.id === parentId)) throw new Error('Родительская папка не найдена');
  data.folders.push({ id, name, parentId }); validateLibrary(data); return id;
}
export function moveLibraryFolder(data, id, parentId) {
  const folder = data.folders.find(folder => folder.id === id);
  if (!folder) throw new Error('Папка не найдена');
  folder.parentId = parentId; validateLibrary(data);
}
export function renameLibraryFolder(data, id, name) {
  const folder = data.folders.find(folder => folder.id === id);
  if (!folder) throw new Error('Папка не найдена');
  folder.name = String(name || '').replace(/\s+/g,' ').trim(); validateLibrary(data);
}
export function removeLibraryFolder(data, id) {
  if (!data.folders.some(folder => folder.id === id)) throw new Error('Папка не найдена');
  const removed = new Set(data.folders.filter(folder => folderTrail(data, folder.id).some(parent => parent.id === id)).map(folder => folder.id));
  data.folders = data.folders.filter(folder => !removed.has(folder.id));
  for (const [path, memberships] of Object.entries(data.books)) {
    const remaining = memberships.filter(folder => !removed.has(folder));
    if (remaining.length) data.books[path] = remaining; else delete data.books[path];
  }
}
export function placeLibraryBook(data, path, folderId) {
  if (folderId && !data.folders.some(folder => folder.id === folderId)) throw new Error('Папка не найдена');
  if (folderId) data.books[path] = [folderId]; else delete data.books[path];
  validateLibrary(data);
}
export function migrateLibraryTags(data, tags) {
  if (data.migratedLegacyTags) return false;
  for (const [path, names] of Object.entries(tags || {})) {
    if (!Array.isArray(names)) continue;
    for (const raw of names) {
      const name = String(raw).replace(/\s+/g,' ').trim().slice(0,120); if (!name) continue;
      let folder = data.folders.find(folder => !folder.parentId && folder.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      if (!folder) { const id = addLibraryFolder(data,name); folder = data.folders.find(folder => folder.id === id); }
      const memberships = data.books[path] || (data.books[path] = []);
      if (!memberships.includes(folder.id)) memberships.push(folder.id);
    }
  }
  data.migratedLegacyTags = true; validateLibrary(data); return true;
}
export function mergeLibraries(destination, source) {
  const result = JSON.parse(JSON.stringify(destination)), mapped = new Map([['','']]);
  const ordered = [...source.folders].sort((a,b) => folderTrail(source,a.id).length-folderTrail(source,b.id).length);
  for (const folder of ordered) {
    const parent = mapped.get(folder.parentId);
    const existing = result.folders.find(f => f.parentId === parent && f.name.toLocaleLowerCase() === folder.name.toLocaleLowerCase());
    const id = existing?.id || addLibraryFolder(result,folder.name,parent, result.folders.some(f=>f.id===folder.id) ? undefined : folder.id);
    mapped.set(folder.id,id);
  }
  for (const [path, memberships] of Object.entries(source.books)) result.books[path] = [...new Set([...(result.books[path] || []),...memberships.map(id=>mapped.get(id))])];
  result.migratedLegacyTags ||= source.migratedLegacyTags;
  return validateLibrary(result);
}
