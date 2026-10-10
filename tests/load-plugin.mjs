import fs from 'node:fs/promises';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import * as core from '../src/reader-core.js';
import * as html from '../src/book-html.js';
import * as library from '../src/library-model.js';
import fsSync from 'node:fs';
import * as pdfResources from '../src/pdf-resources.js';
import * as toc from '../src/toc-tree.js';

export async function loadPlugin(overrides = {}) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>',{pretendToBeVisual:true});
  const { window } = dom;
  const notices = [];
  class Base { constructor() {} }
  class TFile { constructor(path) { this.path = path; this.basename = path.split('/').pop().replace(/\.[^.]+$/, ''); this.extension = path.split('.').pop(); } }
  const context = vm.createContext({
    ...core, ...html, ...library, ...toc, ...pdfResources, window, document: window.document, DOMParser: window.DOMParser,
    Node: window.Node, NodeFilter: window.NodeFilter, HTMLElement: window.HTMLElement,
    Blob: window.Blob, URL, AbortController, TextDecoder, TextEncoder,
    setTimeout, clearTimeout, console, Platform: {}, getLanguage: () => 'ru',
    Plugin: Base, ItemView: Base, Modal: Base, PluginSettingTab: Base,
    AbstractInputSuggest: Base, FuzzySuggestModal: Base, Scope: Base, Setting: Base,
    TFile, TFolder: Base, Menu: Base, Notice: class { constructor(text) { notices.push(text); } },
    normalizePath: path => path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, ''),
    pdfjsLib: {}, ePub: () => { throw new Error('EPUB stub not supplied'); },
    __PDF_WORKER_CODE__: '', __PDF_ASSETS__: Object.fromEntries(['cmaps','standard_fonts','wasm'].flatMap(folder=>fsSync.readdirSync('node_modules/pdfjs-dist/'+folder).filter(name=>!name.startsWith('LICENSE')).map(name=>[folder+'/'+name,fsSync.readFileSync('node_modules/pdfjs-dist/'+folder+'/'+name).toString('base64')]))), ...overrides,
  });
  let source = await fs.readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  source = source.replace(/^import .*;\n/gm, '').replace('export default EltonReader;', '');
  vm.runInContext(source, context);
  const names = ['EltonReader','Paginator','ReaderView','ReaderModal','buildTocItems','currentTocItem','extractEpub','extractFb2','extractPdf','splitExportedHighlights','resolveBookNote','quoteMarkdown','processTemplateManually','beginReaderLoad','followFootnote','LibraryView','LibraryModal','ReadSettingsModal','renderReadingHistory'];
  const exports = Object.fromEntries(names.map(name => [name, vm.runInContext(name, context)]));
  return { ...exports, context, evaluate: code => vm.runInContext(code, context), window, notices, TFile, close: () => window.close() };
}

export function memoryVault(initial = {}) {
  const files = new Map(Object.entries(initial));
  const writes = [];
  return { files, writes, vault: {
    adapter: {
      exists: async path => files.has(path),
      read: async path => { if (!files.has(path)) throw new Error('Missing file'); return files.get(path); },
      write: async (path, content) => { writes.push({ path, content }); files.set(path, content); },
      list: async () => ({ files: [], folders: [] }),
      rmdir: async () => {},
    },
    createFolder: async path => { files.set(path, ''); },
  } };
}
