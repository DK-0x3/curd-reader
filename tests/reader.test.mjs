import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPlugin, memoryVault } from './load-plugin.mjs';
import { readerBlocks, archivePath, epubAddress, bounded, mergeProgress, validateRecord, anchorFor, resolveAnchor } from '../src/reader-core.js';
import { bookNodeHtml } from '../src/book-html.js';

test('H1-H6 and dense real headings remain in the TOC, with hierarchy', async () => {
  const p = await loadPlugin();
  try {
    const html = Array.from({ length: 40 }, (_, i) => `<h${i % 6 + 1}>Chapter ${i}</h${i % 6 + 1}><p>text</p>`).join('');
    const toc = p.buildTocItems(html);
    assert.equal(toc.length, 40);
    assert.equal(toc[5].level, 5);
    assert.equal(toc[39].label, 'Chapter 39');
  } finally { p.close(); }
});
test('extended blocks preserve old P,H1-H4 indices and recover anchors', async () => {
  const p = await loadPlugin();
  try {
    const doc = new p.window.DOMParser().parseFromString('<p>A</p><h5>New</h5><p data-er-id="old">B</p><pre>code</pre><table><tr><td>cell</td></tr></table>', 'text/html');
    const blocks = readerBlocks(doc.body);
    assert.deepEqual(blocks.map(el => el.textContent), ['A','B','New','code','cell']);
    assert.equal(resolveAnchor(doc.body, anchorFor(blocks[1]), 0), 1);
  } finally { p.close(); }
});
test('EPUB conversion retains internal addresses, lists and table spans, drops executable markup', async () => {
  const p = await loadPlugin();
  try {
    const doc = new p.window.DOMParser().parseFromString('<h5 id="heading">Title</h5><p><a href="../Notes/n.xhtml#n1">Note</a></p><ul><li>Item</li></ul><table><tr><td colspan="2">Cell</td></tr></table><script>alert(1)</script>', 'text/html');
    doc.__erBase = '/OPS/Text/chapter.xhtml';
    const html = bookNodeHtml(doc.body);
    assert.match(html, /data-er-id="OPS\/Text\/chapter.xhtml#heading"/);
    assert.match(html, /data-er-ref="OPS\/Notes\/n.xhtml#n1"/);
    assert.match(html, /<ul.*<li.*<p>Item<\/p>/s);
    assert.match(html, /colspan="2"/);
    assert.doesNotMatch(html, /alert|<script/);
  } finally { p.close(); }
});
test('FB2 preserves nested section and paragraph targets', async () => {
  const p = await loadPlugin();
  try {
    const xml = '<FictionBook><body><section id="outer"><title><p>Chapter</p></title><section id="nested"><p id="note">Note text</p></section></section></body></FictionBook>';
    const html = await p.extractFb2({}, { vault: { readBinary: async () => new TextEncoder().encode(xml).buffer } });
    assert.match(html, /data-er-id="nested"/);
    assert.match(html, /data-er-id="note"/);
  } finally { p.close(); }
});
test('rapid highlight deletions stay deleted and retain unrelated disk records', async () => {
  const p = await loadPlugin();
  try {
    const disk = memoryVault({ 'reading-highlights.json': JSON.stringify({ book: [{ id:'a',text:'A',block:0 },{ id:'b',text:'B',block:1 }], other: [{id:'c',text:'C',block:0}] }) });
    const plugin = new p.EltonReader();
    plugin.app = { vault: disk.vault };
    plugin.highlights = JSON.parse(disk.files.get('reading-highlights.json'));
    plugin._saveLocalData = async () => true;
    plugin._writeRescue = async () => {};
    plugin.removeHighlight('book','a'); plugin.removeHighlight('book','b');
    await plugin._hlChain;
    const saved = JSON.parse(disk.files.get('reading-highlights.json'));
    assert.deepEqual(saved.book, []);
    assert.equal(saved.other.length, 1);
  } finally { p.close(); }
});
test('corrupt files are never replaced by empty progress or highlights', async () => {
  const p = await loadPlugin();
  try {
    const disk = memoryVault({ 'reading-progress.json':'{broken', 'reading-highlights.json':'{broken' });
    const plugin = new p.EltonReader(); plugin.app = { vault: disk.vault };
    plugin._writeRescue = async () => {};
    plugin.progress = { book:{pct:0.5,lastRead:1} };
    assert.equal(await plugin._saveProgressToVault(), false);
    plugin.highlights = { book:[{id:'a',text:'A',block:0}] };
    assert.equal(await plugin._persistHighlights('book', disk => { disk.book = []; }), false);
    assert.equal(disk.writes.length, 0);
  } finally { p.close(); }
});
test('progress merges timestamps; backups include anchors, comments and colours', async () => {
  assert.deepEqual(mergeProgress({a:{lastRead:20,pct:.5},b:{lastRead:1,pct:.1}}, {a:{lastRead:10,pct:.2}}), {a:{lastRead:20,pct:.5},b:{lastRead:1,pct:.1}});
  const p = await loadPlugin();
  try {
    const plugin = new p.EltonReader(); plugin.highlightsBackups = {};
    plugin._recordBackup('book', {pct:.5,percent:50,block:42}, 100);
    assert.equal(plugin.progressBackups.book[0].block,42);
    plugin._backupHighlights('book',[{id:'a',comment:'old',color:'yellow'}]);
    plugin._backupHighlights('book',[{id:'a',comment:'new',color:'green'}]);
    assert.equal(plugin.highlightsBackups.book.length,2);
    assert.equal(plugin.highlightsBackups.book[1].items[0].comment,'new');
  } finally { p.close(); }
});
test('scroll jumps target an exact element coordinate, including image-only PDF pages', async () => {
  const p = await loadPlugin();
  try {
    const flow = p.window.document.createElement('div'), figure = flow.appendChild(p.window.document.createElement('figure'));
    flow.getBoundingClientRect = () => ({top:-1000,left:0});
    figure.getBoundingClientRect = () => ({top:2345,left:0});
    let target;
    const pager = new p.Paginator();
    Object.assign(pager,{flow,scrollMode:true,total:20,clip:{clientHeight:500,scrollHeight:10000,scrollTo:opts => { target = opts.top; }}});
    assert.equal(pager.jumpToElement(figure)[0], 6);
    assert.equal(target,3345);
  } finally { p.close(); }
});
test('printed one-entry contents and image-only PDF bookmarks stay available', async () => {
  const p = await loadPlugin();
  try {
    const toc = p.buildTocItems('<div data-pdf-page-no="1"><figure><img></figure></div><div data-pdf-page-no="2"><p>text</p></div>', [{label:'Scan',page:1,level:0}]);
    assert.equal(toc[0].page,1);
  } finally { p.close(); }
});
test('archive addresses handle parent directories, encodings and reject remote hosts', () => {
  assert.equal(archivePath('../Images/a%20b.png','OPS/Text/chapter.xhtml'),'OPS/Images/a b.png');
  assert.equal(epubAddress('../Notes/n.xhtml#n%201','OPS/Text/chapter.xhtml'),'OPS/Notes/n.xhtml#n 1');
  assert.equal(archivePath('https://example.com/image.png','OPS/Text/chapter.xhtml'),null);
});
test('bounded work aborts and releases cancellation resources', async () => {
  const controller = new AbortController(); let cancelled = false;
  const pending = bounded(new Promise(() => {}), 10000, { signal:controller.signal,cancel:() => { cancelled=true; } });
  controller.abort();
  await assert.rejects(pending,{name:'AbortError'});
  assert.equal(cancelled,true);
});
test('JSON validation rejects structurally malformed records', () => {
  assert.throws(() => validateRecord([], 'progress'));
  assert.throws(() => validateRecord({book:[{id:'a'}]}, 'highlights'));
});

test('nested list contents are emitted once', async () => {
  const p = await loadPlugin();
  try {
    const doc = new p.window.DOMParser().parseFromString('<ul><li>Parent<ul><li>Child</li></ul></li></ul>', 'text/html');
    const html = bookNodeHtml(doc.body);
    assert.equal((html.match(/Child/g) || []).length, 1);
  } finally { p.close(); }
});
test('EPUB navigation takes precedence over visible headings and keeps levels', async () => {
  const p = await loadPlugin();
  try {
    const html = '<nav data-er-toc hidden><a data-er-target="OPS/c.xhtml#two" data-er-level="1">Official name</a></nav><div data-er-id="OPS/c.xhtml#"><h1>Visible title</h1><h6 data-er-id="OPS/c.xhtml#two">Subsection</h6></div>';
    const toc = p.buildTocItems(html);
    assert.equal(toc.length, 1); assert.equal(toc[0].label, 'Official name'); assert.equal(toc[0].level, 1);
    assert.equal(toc[0].block, 1);
  } finally { p.close(); }
});
test('data folder migration merges both destinations and retains source', async () => {
  const p = await loadPlugin();
  try {
    const disk = memoryVault({'reading-progress.json':JSON.stringify({a:{pct:.4,lastRead:10}}),'reading-highlights.json':JSON.stringify({a:[{id:'a',text:'A',block:0}]}),'new/reading-progress.json':JSON.stringify({b:{pct:.8,lastRead:20}}),'new/reading-highlights.json':JSON.stringify({b:[{id:'b',text:'B',block:1}]})});
    const plugin = new p.EltonReader(); plugin.app={vault:disk.vault}; plugin._saveLocalData=async()=>true;
    assert.equal(await plugin.changeDataLocation('dataFolder','new'),true);
    assert.deepEqual(Object.keys(JSON.parse(disk.files.get('new/reading-progress.json'))).sort(),['a','b']);
    assert.deepEqual(Object.keys(JSON.parse(disk.files.get('new/reading-highlights.json'))).sort(),['a','b']);
    assert.ok(disk.files.has('reading-progress.json'));
  } finally { p.close(); }
});
test('damaged destination stops migration and restores settings', async () => {
  const p=await loadPlugin({console:{error(){},warn(){}}});
  try {
    const disk=memoryVault({'reading-progress.json':'{}','reading-highlights.json':'{}','new/reading-progress.json':'broken'});
    const plugin=new p.EltonReader(); plugin.app={vault:disk.vault}; plugin._saveLocalData=async()=>true;
    assert.equal(await plugin.changeDataLocation('dataFolder','new'),false);
    assert.equal(plugin.settings.dataFolder,''); assert.equal(disk.writes.length,0);
  } finally {p.close();}
});
test('cleared progress is not resurrected by merge',async()=>{
  const p=await loadPlugin();
  try {
    const disk=memoryVault({'reading-progress.json':JSON.stringify({book:{pct:.6,lastRead:3}})});
    const plugin=new p.EltonReader();plugin.app={vault:disk.vault};plugin._writeRescue=async()=>{};
    plugin._deletedBooks.add('book');plugin.progress={};
    assert.equal(await plugin._saveProgressToVault(),true);
    assert.deepEqual(JSON.parse(disk.files.get('reading-progress.json')),{});
  }finally{p.close();}
});
test('export deduplication uses identity, never a text substring',async()=>{
  const p=await loadPlugin();
  try {
    const a={id:'a',block:0,text:'a short quote'},b={id:'b',block:1,text:'a short quote'};
    const marker=p.context.quoteMarker(a,'book.epub');
    const split=p.splitExportedHighlights(marker+'\n> a short quote', [a,b], 'book.epub');
    assert.equal(split.already.length,1);assert.equal(split.fresh[0].id,'b');
    assert.equal(p.splitExportedHighlights('a longer a short quote text',[a],'book.epub').fresh.length,1);
  }finally{p.close();}
});
test('manual templates substitute dates and reject unsupported code intact',async()=>{
  const p=await loadPlugin();
  try {
    const out=p.processTemplateManually('<% tp.file.title %> <% tp.date.now("YYYY-MM-DD") %>', 'Book');
    assert.match(out,/Book \d{4}-\d{2}-\d{2}/);
    assert.throws(()=>p.processTemplateManually('<% tp.user.custom() %>', 'Book'));
  }finally{p.close();}
});
test('painted phrase spans inline tags in the correct window',async()=>{
  const p=await loadPlugin();
  try {
    const flow=p.window.document.createElement('div');flow.innerHTML='<p>Hello <em>world</em> again</p>';
    const registry=new Map();p.window.CSS={highlights:registry};p.window.Highlight=class {constructor(...ranges){this.ranges=ranges;}};
    const view={pager:{flow}};p.context.markFoundIn(view,'hello world');
    assert.equal(registry.get('er-found').ranges[0].toString(),'Hello world');
    p.context.clearFoundIn(view);
  }finally{p.close();}
});
test('mobile protocol returns the opened modal and awaits its exact jump',async()=>{
  const p=await loadPlugin();
  try {
    let jumped;const file=new p.TFile('Books/b.epub');const modal={file,_loadTask:Promise.resolve(),jumpToBlockWhenReady:async block=>{jumped=block;}};
    const plugin=new p.EltonReader();plugin.app={vault:{getAbstractFileByPath:()=>file}};plugin.openFile=async()=>modal;
    await plugin.openBookAt('Books/b.epub',42);assert.equal(jumped,42);
  }finally{p.close();}
});

test('secrets are absent from settings snapshots and stored through SecretStorage',async()=>{
  const p=await loadPlugin();
  try {
    const plugin=new p.EltonReader();let saved,key;
    plugin.app={vault:{getName:()=> 'Test vault'},secretStorage:{setSecret:(_,value)=>{key=value;}}};
    plugin.settings.aiKey='private-test-token';plugin.saveData=async value=>{saved=value;};
    assert.equal(await plugin._saveLocalData(),true);
    assert.equal(key,'private-test-token');assert.equal(saved.settings.aiKey,'');
    assert.ok(!JSON.stringify(saved).includes('private-test-token'));
  }finally{p.close();}
});
test('rename moves progress, highlights and local book metadata on disk',async()=>{
  const p=await loadPlugin();
  try {
    const disk=memoryVault({'reading-progress.json':JSON.stringify({old:{pct:.7,lastRead:4}}),'reading-highlights.json':JSON.stringify({old:[{id:'a',text:'A',block:0}]})});
    const plugin=new p.EltonReader();plugin.app={vault:disk.vault};plugin.progress={old:{pct:.7,lastRead:4}};plugin.highlights={old:[{id:'a',text:'A',block:0}]};plugin.settings.bookTags={old:['test']};
    plugin._writeRescue=async()=>{};plugin._saveLocalData=async()=>true;plugin._saveThumbCache=async()=>{};
    const file=new p.TFile('new.epub');await plugin.renameBookData(file,'old');
    const saved=JSON.parse(disk.files.get('reading-highlights.json'));assert.equal(saved.old,undefined);assert.equal(saved['new.epub'][0].id,'a');
    assert.equal(JSON.parse(disk.files.get('reading-progress.json'))['new.epub'].pct,.7);assert.deepEqual(plugin.settings.bookTags['new.epub'],['test']);
  }finally{p.close();}
});
test('replacing a load cancels the old task and stops the reading timer',async()=>{
  const p=await loadPlugin();
  try {
    let released=false;const view={pager:{destroy(){}},plugin:{flushReadingTime(){}},_running:true,_timer:p.window.setInterval(()=>{},1000)};
    const first=p.beginReaderLoad(view,signal=>bounded(new Promise(()=>{}),10000,{signal,cancel:()=>{released=true;}}));
    const rejected=assert.rejects(first,{name:'AbortError'});
    await new Promise(resolve=>setTimeout(resolve,0));
    await p.beginReaderLoad(view,async()=> 'new book');await rejected;
    assert.equal(released,true);assert.equal(view._timer,null);assert.equal(view._running,false);assert.equal(view._loading,false);
  }finally{p.close();}
});
