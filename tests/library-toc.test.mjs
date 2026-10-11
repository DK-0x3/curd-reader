import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyLibrary, addLibraryFolder, moveLibraryFolder, removeLibraryFolder, placeLibraryBook, migrateLibraryTags, validateLibrary, folderTrail, mergeLibraries } from '../src/library-model.js';
import { tocTree, mountTocTree } from '../src/toc-tree.js';
import { loadPlugin, memoryVault } from './load-plugin.mjs';

test('folders permit five levels and reject a sixth, cycles, and deep subtree moves',()=>{
  const data=emptyLibrary();let parent='';
  for(let i=1;i<=5;i++)parent=addLibraryFolder(data,'Level '+i,parent,'f'+i);
  assert.equal(folderTrail(data,'f5').length,5);
  assert.throws(()=>addLibraryFolder(structuredClone(data),'Sixth','f5','f6'),/пяти/);
  assert.throws(()=>moveLibraryFolder(structuredClone(data),'f1','f5'),/структура|пяти/);
  const second=addLibraryFolder(data,'Other','','other');
  assert.throws(()=>moveLibraryFolder(structuredClone(data),'f1',second),/пяти/);
});
test('deleting a virtual subtree frees memberships without touching books elsewhere',()=>{
  const data=emptyLibrary();addLibraryFolder(data,'A','','a');addLibraryFolder(data,'B','a','b');addLibraryFolder(data,'C','','c');
  placeLibraryBook(data,'Physical/book.epub','b');data.books['Physical/book.epub'].push('c');placeLibraryBook(data,'Other/book.pdf','a');
  removeLibraryFolder(data,'a');assert.deepEqual(data.books,{'Physical/book.epub':['c']});assert.deepEqual(data.folders.map(f=>f.id),['c']);
  placeLibraryBook(data,'Physical/book.epub','');assert.deepEqual(data.books,{});
});
test('legacy multi-category assignments migrate once without losing a membership',()=>{
  const data=emptyLibrary();migrateLibraryTags(data,{'Books/a.epub':['Science','History'],'Other/b.pdf':['science']});
  assert.equal(data.folders.length,2);assert.equal(data.books['Books/a.epub'].length,2);assert.equal(data.books['Other/b.pdf'].length,1);
  assert.equal(migrateLibraryTags(data,{'new':['Third']}),false);assert.equal(data.folders.length,2);
});
test('merge remaps folder ids to existing destination paths and preserves memberships',()=>{
  const a=emptyLibrary(),b=emptyLibrary();addLibraryFolder(a,'Root','','a');addLibraryFolder(a,'Child','a','ac');placeLibraryBook(a,'a.epub','ac');
  addLibraryFolder(b,'Root','','b');addLibraryFolder(b,'Child','b','bc');placeLibraryBook(b,'b.epub','bc');
  const merged=mergeLibraries(a,b);assert.equal(merged.folders.length,2);assert.deepEqual(merged.books['b.epub'],['ac']);assert.deepEqual(merged.books['a.epub'],['ac']);
});
test('malformed structure and orphan book links are rejected',()=>{
  assert.throws(()=>validateLibrary({version:1,folders:[{id:'x',name:'X',parentId:'missing'}],books:{}}));
  assert.throws(()=>validateLibrary({version:1,folders:[],books:{'b.pdf':['missing']}}));
});
test('TOC respects skipped heading levels and sibling hierarchy',()=>{
  const {roots}=tocTree([{label:'Root',level:0},{label:'Deep',level:3},{label:'Peer',level:3},{label:'Next root',level:0}]);
  assert.equal(roots.length,2);assert.deepEqual(roots[0].children.map(n=>n.item.label),['Deep','Peer']);
});
test('large collapsed TOC creates only roots, expands lazily, preserves search paths and page jumps',async()=>{
  const p=await loadPlugin();let widget;
  try{
    const items=[];for(let root=0;root<10;root++){items.push({label:'Part '+root,level:0,block:root*201});for(let child=0;child<200;child++)items.push({label:`Section ${root}.${child}`,level:1,block:root*201+child+1});}
    const host=p.window.document.createElement('div');p.window.document.body.appendChild(host);let measured=0,jumped;
    widget=mountTocTree(host,items,{measure:()=>{measured++;return {spread:1};},jump:item=>{jumped=item.block;}});
    assert.equal(host.querySelectorAll('[role=treeitem]').length,10);assert.equal(measured,0);
    const originalRoot=host.querySelector('[role=treeitem]');host.querySelector('.er-toc-toggle').click();
    for(let tries=0;tries<100 && host.querySelectorAll('[role=treeitem]').length!==210;tries++)await new Promise(resolve=>p.window.setTimeout(resolve,10));
    assert.equal(host.querySelector('[role=treeitem]'),originalRoot);
    assert.equal(host.querySelectorAll('[role=treeitem]').length,210);
    host.querySelector('.er-toc-collapse').click();assert.equal(host.querySelectorAll('[role=treeitem]').length,10);
    const search=host.querySelector('input');search.value='Section 7.199';search.dispatchEvent(new p.window.Event('input'));
    await new Promise(resolve=>p.window.setTimeout(resolve,150));
    assert.equal(host.querySelectorAll('[role=treeitem]').length,2);assert.match(host.textContent,/Part 7/);
    host.querySelectorAll('.er-toc-link')[1].click();assert.equal(jumped,7*201+200);
  }finally{widget?.dispose();p.close();}
});
test('TOC page measurement is limited to visible rows and cached until relayout',async()=>{
  const p=await loadPlugin();let widget;
  try{
    let report; p.window.IntersectionObserver=class{constructor(callback){report=callback;}observe(){}disconnect(){}};
    const host=p.window.document.createElement('div');p.window.document.body.appendChild(host);let measured=0,revision=1;
    widget=mountTocTree(host,Array.from({length:1000},(_,i)=>({label:'Root '+i,block:i,level:0})),{measure:()=>{measured++;return {spread:2};},revision:()=>revision});
    const row=host.querySelector('[role=treeitem]');report([{target:row,isIntersecting:true}]);for(let tries=0;tries<100 && measured<1;tries++)await new Promise(resolve=>p.window.setTimeout(resolve,10));assert.equal(measured,1);
    widget.render();report([{target:host.querySelector('[role=treeitem]'),isIntersecting:true}]);for(let tries=0;tries<100 && measured<1;tries++)await new Promise(resolve=>p.window.setTimeout(resolve,10));assert.equal(measured,1);
    revision++;widget.render();report([{target:host.querySelector('[role=treeitem]'),isIntersecting:true}]);for(let tries=0;tries<100 && measured<2;tries++)await new Promise(resolve=>p.window.setTimeout(resolve,10));assert.equal(measured,2);
  }finally{widget?.dispose();p.close();}
});
test('folder operations reread disk, serialize updates and refuse damaged JSON',async()=>{
  const p=await loadPlugin({console:{error(){},warn(){}}});
  try{
    const disk=memoryVault();const plugin=new p.EltonReader();plugin.app={vault:disk.vault};plugin._writeRescue=async()=>{};
    await Promise.all([plugin.editLibrary(data=>addLibraryFolder(data,'One','','a')),plugin.editLibrary(data=>addLibraryFolder(data,'Two','','b'))]);
    assert.equal(JSON.parse(disk.files.get('reading-library.json')).folders.length,2);
    assert.ok(await plugin.editLibrary(data=>placeLibraryBook(data,'Do/not/move.epub','a')));assert.deepEqual(plugin.library.books['Do/not/move.epub'],['a']);
    disk.files.set('reading-library.json','{broken');const writes=disk.writes.length;
    assert.equal(await plugin.editLibrary(data=>addLibraryFolder(data,'Three')),null);assert.equal(disk.writes.length,writes);
  }finally{p.close();}
});

test('large paginator reuses its block index across TOC lookups',async()=>{
  const p=await loadPlugin();
  try{
    const flow=p.window.document.createElement('div');
    for(let i=0;i<12000;i++){const el=p.window.document.createElement('p');el.textContent='Paragraph '+i;flow.appendChild(el);el.getBoundingClientRect=()=>({left:i*100,top:i*100});}
    flow.getBoundingClientRect=()=>({left:0,top:0});
    const native=flow.querySelectorAll.bind(flow);let queries=0;flow.querySelectorAll=(...args)=>{queries++;return native(...args);};
    const pager=new p.Paginator();Object.assign(pager,{flow,sw:100,cols:1,total:12000,scrollMode:false});
    assert.equal(pager.spreadForBlock(11000),11000);const initial=queries;
    for(let i=0;i<2000;i++)pager.spreadForBlock(i);
    assert.equal(queries,initial);assert.equal(pager.blockEl(999).textContent,'Paragraph 999');
  }finally{p.close();}
});
test('folder migration copies library data and queued edits use the new location',async()=>{
  const p=await loadPlugin();
  try{
    const source=emptyLibrary();addLibraryFolder(source,'Existing','','a');placeLibraryBook(source,'Physical/book.epub','a');
    const disk=memoryVault({'reading-library.json':JSON.stringify(source)});const plugin=new p.EltonReader();plugin.app={vault:disk.vault};plugin.library=source;plugin._writeRescue=async()=>{};plugin._saveLocalData=async()=>true;
    const migration=plugin.changeDataLocation('dataFolder','New data');
    const queued=plugin.editLibrary(data=>addLibraryFolder(data,'Queued','','b'));
    assert.equal(await migration,true);assert.equal(await queued,'b');
    const moved=JSON.parse(disk.files.get('New data/reading-library.json'));assert.equal(moved.folders.length,2);assert.deepEqual(moved.books['Physical/book.epub'],['a']);
    assert.equal(JSON.parse(disk.files.get('reading-library.json')).folders.length,1);
  }finally{p.close();}
});
test('reader settings can apply globally without an open book',async()=>{
  const p=await loadPlugin();
  try{
    const plugin=new p.EltonReader();plugin._saveLocalData=async()=>true;
    const modal=new p.ReadSettingsModal({}, {plugin,_librarySettings:true,_readers:()=>[]});
    await modal._apply(true);p.window.clearTimeout(modal._saveT);
    let applied=0,relayout=0;modal.view._readers=()=>[{applyVars:()=>{applied++;},repaginate:async()=>{relayout++;}}];
    await modal._apply(true);p.window.clearTimeout(modal._saveT);assert.equal(applied,1);assert.equal(relayout,1);
  }finally{p.close();}
});
function obsidianDom(window){
  const proto=window.HTMLElement.prototype;
  proto.empty=function(){this.replaceChildren();};proto.setText=function(text){this.textContent=text;};
  proto.addClass=function(...names){this.classList.add(...names.flatMap(name=>name.split(' ')));};proto.removeClass=function(...names){this.classList.remove(...names);};proto.hasClass=function(name){return this.classList.contains(name);};proto.toggleClass=function(name,on){this.classList.toggle(name,!!on);};proto.setAttr=function(name,value){this.setAttribute(name,value);};
  proto.createEl=function(tag,info={}){const el=window.document.createElement(tag);if(typeof info==='string')info={cls:info};if(info.cls)el.className=info.cls;if(info.text!==undefined)el.textContent=info.text;for(const [key,value]of Object.entries(info.attr||{}))el.setAttribute(key,value);for(const key of ['type','value'])if(info[key]!==undefined)el[key]=info[key];this.appendChild(el);return el;};
  proto.createDiv=function(info){return this.createEl('div',info);};proto.createSpan=function(info){return this.createEl('span',info);};
}
test('global settings render without a book and advanced controls update open readers',async()=>{
  const p=await loadPlugin();let modal;
  try{
    obsidianDom(p.window);const plugin=new p.EltonReader();plugin.saveAll=async()=>true;
    const reader={contentEl:p.window.document.createElement('div')};let relayout=0;
    const proxy={plugin,_librarySettings:true,_readers:()=>[reader],repaginate:async()=>{relayout++;}};
    modal=new p.ReadSettingsModal({},proxy);modal.contentEl=p.window.document.createElement('div');modal.modalEl=p.window.document.createElement('div');
    modal.onOpen();assert.match(modal.contentEl.textContent,/Настройки чтения/);
    const pick=async label=>{[...modal.contentEl.querySelectorAll('.er-col-btn')].find(el=>el.textContent===label).click();await new Promise(resolve=>p.window.setTimeout(resolve,0));};
    await pick('По клику');assert.equal(plugin.settings.navMode,'click');assert.ok(reader.contentEl.classList.contains('er-navclick'));
    await pick('По ширине');assert.equal(plugin.settings.textAlign,'justify');assert.equal(relayout,1);
    await pick('Снизу');assert.equal(plugin.settings.vAlign,'bottom');assert.equal(relayout,2);
  }finally{p.window.clearTimeout(modal?._saveT);p.close();}
});
test('library renders virtual cards, scans all vault books, navigates and refreshes newly added books',async()=>{
  const p=await loadPlugin({ResizeObserver:class{observe(){}disconnect(){}}});
  try{
    obsidianDom(p.window);
    const library=emptyLibrary();library.migratedLegacyTags=true;addLibraryFolder(library,'Research','','a');addLibraryFolder(library,'Deep','a','b');placeLibraryBook(library,'Outside/assigned.epub','b');
    const disk=memoryVault({'Some other physical folder/reading-library.json':JSON.stringify(library)});
    const files=[new p.TFile('Outside/assigned.epub'),new p.TFile('Elsewhere/free.pdf')];disk.vault.getFiles=()=>files;
    const plugin=new p.EltonReader();plugin.app={vault:disk.vault,workspace:{getLeavesOfType:()=>[]}};plugin.settings.booksFolder='Some other physical folder';plugin.library=library;plugin._saveLocalData=async()=>true;plugin._writeRescue=async()=>{};
    const view=new p.LibraryModal({},plugin);Object.assign(view,{app:plugin.app,contentEl:p.window.document.createElement('div'),modalEl:p.window.document.createElement('div'),containerEl:p.window.document.createElement('div')});p.window.document.body.appendChild(view.contentEl);
    view._setupDropZone=()=>{};view.renderCard=(grid,file)=>grid.createDiv({cls:'test-book',text:file.path});
    await view.onOpen();assert.equal(view.contentEl.querySelectorAll('.er-lib-folder-card').length,1);assert.match(view.contentEl.textContent,/Elsewhere\/free.pdf/);assert.doesNotMatch(view.contentEl.textContent,/Outside\/assigned.epub/);
    assert.ok(view.contentEl.querySelector('.er-lib-folder-icon svg'));
    assert.doesNotMatch(view.contentEl.querySelector('.er-lib-folder-icon').textContent,/📁/);
    assert.ok(view.contentEl.querySelector('[aria-label="Обновить книги"]'));assert.ok(view.contentEl.querySelector('[aria-label="Настройки чтения"] svg'));
    view.contentEl.querySelector('.er-lib-folder-open').click();assert.equal(view._folderId,'a');assert.match(view.contentEl.textContent,/Deep/);
    view.contentEl.querySelector('.er-lib-folder-open').click();assert.equal(view._folderId,'b');assert.match(view.contentEl.textContent,/Outside\/assigned.epub/);
    view.contentEl.querySelector('.er-lib-all').click();assert.equal(view.contentEl.querySelectorAll('.test-book').length,2);
    files.push(new p.TFile('Brand new/book.fb2'));await view.refreshBooks();assert.equal(view.contentEl.querySelectorAll('.test-book').length,3);
    view.onClose();
  }finally{p.close();}
});


test('opening TOC reveals exactly the current descendant and expands its ancestors',async()=>{
  const p=await loadPlugin();let widget;
  try{
    const host=p.window.document.createElement('div');p.window.document.body.appendChild(host);
    Object.defineProperty(host,'clientHeight',{value:300});host.getBoundingClientRect=()=>({top:0,bottom:300});
    const items=Array.from({length:100},(_,i)=>({label:'Root '+i,level:0,block:i}));
    const parent={label:'Nested',level:1,block:100},active={label:'Reading here',level:2,block:101};items.push(parent,active);
    const native=p.window.HTMLElement.prototype.getBoundingClientRect;
    p.window.HTMLElement.prototype.getBoundingClientRect=function(){if(this._toc)return {top:[...this.parentElement.children].indexOf(this)*30-host.scrollTop,bottom:0,height:30};return native.call(this);};
    widget=mountTocTree(host,items,{currentItem:()=>active,measure:()=>({spread:4})});
    widget.open();await new Promise(resolve=>p.window.setTimeout(resolve,30));
    const rows=host.querySelectorAll('[role=treeitem]');assert.equal(rows.length,102);
    const selected=host.querySelectorAll('[aria-current="location"]');assert.equal(selected.length,1);assert.match(selected[0].textContent,/Reading here/);assert.ok(selected[0].classList.contains('active'));
    assert.equal(host.querySelectorAll('[aria-expanded="true"]').length,2);assert.ok(host.scrollTop>2500);
    await new Promise(resolve=>p.window.setTimeout(resolve,20));assert.equal(host.querySelectorAll('.active').length,1);
    widget.state.filter='not found';widget.render();widget.open();await new Promise(resolve=>p.window.setTimeout(resolve,20));assert.equal(widget.state.filter,'');assert.equal(host.querySelectorAll('[aria-current]').length,1);
  }finally{widget?.dispose();p.close();}
});
test('expanding and collapsing keep the toggled row in place and retain keyboard focus',async()=>{
  const p=await loadPlugin();let widget;
  try{
    const host=p.window.document.createElement('div');p.window.document.body.appendChild(host);host.getBoundingClientRect=()=>({top:0,bottom:300});
    const items=[];for(let i=0;i<30;i++)items.push({label:'Root '+i,level:0},{label:'Child '+i,level:1});
    const native=p.window.HTMLElement.prototype.getBoundingClientRect;
    p.window.HTMLElement.prototype.getBoundingClientRect=function(){if(this._toc){const top=[...this.parentElement.children].indexOf(this)*30-host.scrollTop;return {top,bottom:top+30,height:30};}return native.call(this);};
    widget=mountTocTree(host,items);host.scrollTop=450;
    const row=[...host.querySelectorAll('[role=treeitem]')].find(el=>el._toc.node.item.label==='Root 16');const before=row.getBoundingClientRect().top;row.querySelector('button').click();
    await new Promise(resolve=>p.window.setTimeout(resolve,15));
    const expanded=[...host.querySelectorAll('[role=treeitem]')].find(el=>el._toc.node.item.label==='Root 16');assert.equal(expanded.getBoundingClientRect().top,before);assert.equal(host.scrollTop,450);assert.equal(p.window.document.activeElement,expanded.querySelector('button'));
    expanded.querySelector('button').click();await new Promise(resolve=>p.window.setTimeout(resolve,15));assert.equal(host.scrollTop,450);
  }finally{widget?.dispose();p.close();}
});
test('current chapter uses DOM order for extended block ids and PDF page for bookmarks',async()=>{
  const p=await loadPlugin();
  try{
    const flow=p.window.document.createElement('div');const h1=p.window.document.createElement('h1'),h6=p.window.document.createElement('h6'),para=p.window.document.createElement('p');flow.append(h1,h6,para);
    const blocks=[h1,para,h6],items=[{label:'Main',block:0},{label:'Deep',block:2}];
    const view={ext:'epub',tocItems:items,pager:{flow,currentBlockIndex:()=>1,blockEl:i=>blocks[i]}};assert.equal(p.currentTocItem(view),items[1]);
    const page=p.window.document.createElement('div');page.setAttribute('data-pdf-page-no','80');page.append(para);flow.append(page);
    view.ext='pdf';view.tocItems=[{label:'Start',page:1},{label:'Part',page:60},{label:'Section',page:70},{label:'Later',page:90}];assert.equal(p.currentTocItem(view),view.tocItems[2]);
  }finally{p.close();}
});


test('history removal deletes only the selected object and survives reloading local data',async()=>{
  const p=await loadPlugin();
  try{
    const plugin=new p.EltonReader();plugin.app={};let saved;plugin.saveData=async value=>{saved=value;};
    const a={percent:29,block:4,ts:1},b={percent:29,block:9,ts:1};plugin.progressBackups={'Book.epub':[a,b],'Other.pdf':[a]};
    assert.equal(await plugin.removeReadingHistory('Book.epub',a),true);assert.deepEqual(plugin.getBackups('Book.epub'),[b]);assert.equal(plugin.getBackups('Other.pdf').length,1);
    assert.equal(saved.progressBackups['Book.epub'].length,1);assert.equal(saved.progressBackups['Book.epub'][0].block,9);
    plugin._saveLocalData=async()=>false;assert.equal(await plugin.removeReadingHistory('Book.epub',b),false);assert.deepEqual(plugin.getBackups('Book.epub'),[b]);
  }finally{p.close();}
});
test('history clear persists current reading position without clearing another book',async()=>{
  const p=await loadPlugin();
  try{
    const disk=memoryVault();const plugin=new p.EltonReader();plugin.app={vault:disk.vault};let local;plugin.saveData=async value=>{local=value;};plugin._syncProgressFrontmatter=()=>{};
    plugin.progressBackups={'Book.epub':[{percent:4,block:2}],'Other.pdf':[{percent:90}]};plugin.progress['Book.epub']={pct:.04,percent:4,block:2,lastRead:1};
    const position={pct:.29,percent:29,block:99,lastRead:Date.now(),anchor:{text:'Current paragraph'}};
    assert.equal(await plugin.clearReadingHistory('Book.epub',position),true);assert.equal(plugin.getBackups('Book.epub').length,0);assert.equal(plugin.getBackups('Other.pdf').length,1);
    const progress=JSON.parse(disk.files.get('reading-progress.json'));assert.equal(progress['Book.epub'].block,99);assert.equal(progress['Book.epub'].percent,29);assert.equal(local.progressBackups['Book.epub'].length,0);
  }finally{p.close();}
});
test('history management UI removes a point without jumping and clear keeps the live position',async()=>{
  const p=await loadPlugin();
  try{
    obsidianDom(p.window);const plugin=new p.EltonReader();plugin._saveLocalData=async()=>true;plugin.saveAll=async()=>true;
    plugin.progressBackups['Book.epub']=[{percent:4,block:2,ts:1},{percent:29,block:9,ts:2,anchor:{text:'Saved paragraph'},manual:true}];
    const para=p.window.document.createElement('p');para.textContent='Live current paragraph';let jumped=0;
    const view={plugin,file:{path:'Book.epub'},bookHtml:'book',pager:{flow:para,spread:29,total:101,currentBlockIndex:()=>99,blockEl:()=>para,jumpToBlock:()=>{jumped++;return [0,101];}}};
    const host=p.window.document.createElement('div');p.renderReadingHistory(view,host);
    assert.match(host.querySelector('.er-history-current').textContent,/29%.*Текущее положение.*Live current paragraph/);assert.equal(host.querySelectorAll('.er-history-point').length,2);
    host.querySelector('.er-history-remove').click();await new Promise(resolve=>p.window.setTimeout(resolve,0));assert.equal(jumped,0);assert.equal(host.querySelectorAll('.er-history-point').length,1);
    host.querySelector('.er-history-clear').click();await new Promise(resolve=>p.window.setTimeout(resolve,0));assert.equal(plugin.progress['Book.epub'].block,99);assert.equal(plugin.getBackups('Book.epub').length,0);assert.ok(host.querySelector('.er-history-current'));assert.ok(host.querySelector('.er-history-clear').disabled);
  }finally{p.close();}
});
test('settings modal has its own history host and leaves the reader panel intact',async()=>{
  const p=await loadPlugin();
  try{
    obsidianDom(p.window);const plugin=new p.EltonReader();plugin.saveAll=async()=>true;
    const original=p.window.document.createElement('div');const view={plugin,file:{path:'Book.epub'},_histRow:original,_renderHistory:()=>{}};
    const modal=new p.ReadSettingsModal({},view);modal.contentEl=p.window.document.createElement('div');modal.modalEl=p.window.document.createElement('div');modal.onOpen();
    assert.ok(modal.historyEl);assert.equal(view._histRow,original);assert.equal(modal.contentEl.querySelectorAll('.er-rs-col').length,3);modal.onClose();assert.equal(view._histRow,original);
  }finally{p.close();}
});

test('explicit save retains an excerpt in the history restore point',async()=>{
  const p=await loadPlugin();
  try{
    const plugin=new p.EltonReader();const paragraph=p.window.document.createElement('p');paragraph.textContent='Excerpt to identify this place';
    plugin.app={workspace:{getLeavesOfType:()=>[{view:{file:{path:'Book.epub'},pager:{blockEl:()=>paragraph}}}]}};plugin._saveLocalData=async()=>true;plugin._saveProgressToVault=async()=>true;plugin._syncProgressFrontmatter=()=>{};
    assert.equal(await plugin.saveNow('Book.epub',29,101,99),29);assert.equal(plugin.getBackups('Book.epub')[0].anchor.text,'Excerpt to identify this place');
  }finally{p.close();}
});
test('changing reading layout saves progress without adding an explicit bookmark',async()=>{
  const p=await loadPlugin();let modal;
  try{
    const plugin=new p.EltonReader();let saves=0;plugin.saveProgress=async()=>{saves++;};plugin.saveAll=async()=>true;plugin.saveNow=()=>{throw new Error('Internal layout must not create a manual point');};
    const view={plugin,file:{path:'Book.epub'},bookHtml:'book',repaginate:async()=>{},pager:{currentBlockIndex:()=>3,spread:2,total:10,spreadForBlock:()=>2,jumpTo:()=>[2,10]}};
    modal=new p.ReadSettingsModal({},view);await modal._apply(true);assert.equal(saves,2);
  }finally{p.window.clearTimeout(modal?._saveT);p.close();}
});

test('cover fallback stays stable across observer calls and follows width changes',async()=>{
  const p=await loadPlugin();
  try{
    const grid=p.window.document.createElement('div'),cover=p.window.document.createElement('div');cover.className='er-lib-cover';grid.append(cover);let width=200;
    Object.defineProperty(cover,'offsetWidth',{get:()=>width});Object.defineProperty(cover,'offsetHeight',{get:()=>parseInt(cover.style.height)||10});
    const view=new p.LibraryModal({},{});view._grid=grid;view._sizeCovers();assert.equal(cover.style.height,'300px');
    let writes=0;const native=cover.style.setProperty.bind(cover.style);cover.style.setProperty=(...args)=>{writes++;return native(...args);};
    for(let i=0;i<10;i++)view._sizeCovers();assert.equal(writes,0);assert.equal(cover.style.height,'300px');
    width=240;view._sizeCovers();assert.equal(cover.style.height,'360px');assert.equal(writes,1);
  }finally{p.close();}
});

test('mobile library keeps its card size independent and restores it after reopening',async()=>{
  const p=await loadPlugin({Platform:{isMobile:true,isPhone:true},ResizeObserver:class{observe(){}disconnect(){}}});
  try {
    obsidianDom(p.window);
    const disk=memoryVault({});disk.vault.getFiles=()=>[];
    const plugin=new p.EltonReader();plugin.app={isMobile:true,vault:disk.vault,workspace:{getLeavesOfType:()=>[]}};
    plugin.library=emptyLibrary();plugin.library.migratedLegacyTags=true;
    plugin.settings.libCoverSize=288;plugin.settings.libCoverSizeMobile=132;
    plugin._writeRescue=async()=>{};let saved;
    plugin.saveAll=async()=>{saved=JSON.parse(JSON.stringify(plugin.settings));};
    const open=async()=>{
      const view=new p.LibraryModal({},plugin);
      Object.assign(view,{app:plugin.app,contentEl:p.window.document.createElement('div'),modalEl:p.window.document.createElement('div'),containerEl:p.window.document.createElement('div')});
      p.window.document.body.appendChild(view.contentEl);view._setupDropZone=()=>{};
      await view.onOpen();return view;
    };
    let view=await open();assert.ok(view.contentEl.classList.contains('er-lib-mobile'));
    assert.match(view._grid.style.gridTemplateColumns,/132px/);
    view.contentEl.querySelector('[aria-label="Больше обложки"]').click();
    assert.equal(plugin.settings.libCoverSizeMobile,160);assert.equal(saved.libCoverSizeMobile,160);
    assert.equal(plugin.settings.libCoverSize,288);view.onClose();
    plugin.settings= saved;view=await open();assert.match(view._grid.style.gridTemplateColumns,/160px/);view.onClose();
    p.evaluate('Platform.isMobile=false;Platform.isPhone=false');plugin.app.isMobile=false;
    view=await open();assert.ok(!view.contentEl.classList.contains('er-lib-mobile'));
    assert.match(view._grid.style.gridTemplateColumns,/288px/);
    view.contentEl.querySelector('[aria-label="Меньше обложки"]').click();
    assert.equal(plugin.settings.libCoverSize,260);assert.equal(plugin.settings.libCoverSizeMobile,160);view.onClose();
  } finally { p.close(); }
});

test('mobile reader builds its complete controls before book loading',async()=>{
 const p=await loadPlugin({Platform:{isMobile:true,isPhone:true}});
 try {
  obsidianDom(p.window);const plugin=new p.EltonReader();plugin.app={isMobile:true};
  plugin.getGoalSeconds=()=>1200;plugin.getTodaySeconds=()=>0;
  const view=new p.ReaderModal(plugin.app,plugin,new p.TFile('Books/book.epub'));
  view.app=plugin.app;view.contentEl=p.window.document.createElement('div');p.window.document.body.appendChild(view.contentEl);
  view._buildDOM();assert.ok(view.areaEl);assert.ok(view.contentEl.querySelector('.er-bot'));
  view.onClose();
 }finally{p.close();}
});

test('mobile reader loads a real FB2, toggles overlay chrome, and opens search',async()=>{
 const p=await loadPlugin({Platform:{isMobile:true,isPhone:true}});
 let view;
 try {
  obsidianDom(p.window);const plugin=new p.EltonReader();
  const xml='<FictionBook><body><section><title><p>Chapter</p></title><p>Readable mobile text.</p></section></body></FictionBook>';
  plugin.app={isMobile:true,vault:{readBinary:async()=>new TextEncoder().encode(xml).buffer}};
  plugin.refreshHighlights=async()=>{};plugin.refreshProgress=async()=>{};plugin.getGoalSeconds=()=>1200;plugin.getTodaySeconds=()=>0;
  view=new p.ReaderModal(plugin.app,plugin,new p.TFile('Books/book.fb2'));view.app=plugin.app;
  view.contentEl=p.window.document.createElement('div');p.window.document.body.appendChild(view.contentEl);
  view._maybePromptBookNote=()=>{};view._buildDOM();await view._loadBook();
  assert.match(view.pager.flow.textContent,/Readable mobile text/);assert.ok(!view.contentEl.querySelector('.er-load-error'));
  view.areaEl.click();assert.ok(view.contentEl.hasClass('er-chrome-hidden'));
  view.areaEl.click();assert.ok(!view.contentEl.hasClass('er-chrome-hidden'));
  view.contentEl.querySelector('[aria-label="Поиск по книге"]').click();
  assert.equal(view.panelOpen,'find');assert.ok(view.findPan.hasClass('er-panel-open'));
  view._closePanel();assert.ok(!view.findPan.hasClass('er-panel-open'));
  const original=view.pager.build;view.pager.build=async()=>{throw new Error('Failed layout');};
  await view._loadBook();assert.match(view.areaEl.textContent,/Failed layout/);
  assert.ok(!view.areaEl.hasClass('er-booting'));assert.ok(view.areaEl.querySelector('button'));
  view.pager.build=original;
 } finally { view?.onClose();p.close(); }
});

test('large mobile pagination paints at the requested page without a giant transformed layer',async()=>{
 const p=await loadPlugin();
 try {
  obsidianDom(p.window);const pager=new p.Paginator();pager.flow=p.window.document.createElement('div');
  pager._paintPaging=true;pager._flowLeft=24;pager._vOffset=()=>12;pager._spreadOffset=()=>390000;
  pager.flow.addClass('er-flow-anim');pager.applyTransform();
  assert.ok(pager.flow.hasClass('er-flow-paint'));assert.equal(pager.flow.style.transform,'');assert.equal(pager.flow.style.left,'-389976px');
  assert.equal(pager.flow.style.top,'12px');assert.ok(!pager.flow.hasClass('er-flow-anim'));
 }finally {p.close();}
});

test('mobile taps hide bars once and navigate both edges in scrolling mode',async()=>{
 const p=await loadPlugin({Platform:{isMobile:true}});let view;
 try {
  p.window.PointerEvent = undefined;
  obsidianDom(p.window);const plugin=new p.EltonReader();plugin.settings.navMode='click';
  plugin.getGoalSeconds=()=>1200;plugin.getTodaySeconds=()=>0;
  view=new p.ReaderModal({},plugin,new p.TFile('Books/b.fb2'));view.app={isMobile:true};
  view.contentEl=p.window.document.createElement('div');view._buildDOM();
  view.areaEl.getBoundingClientRect=()=>({left:0,width:400});view.pager.scrollMode=true;
  const directions=[];view._nav=dir=>directions.push(dir);
  view.areaEl.dispatchEvent(new p.window.MouseEvent('click',{bubbles:true,clientX:20}));
  view.areaEl.dispatchEvent(new p.window.MouseEvent('click',{bubbles:true,clientX:380}));
  assert.deepEqual(directions,['prev','next']);
  const touch=(name,x,y)=>{const e=new p.window.Event(name,{bubbles:true});Object.defineProperty(e,'touches',{value:[{clientX:x,clientY:y}]});Object.defineProperty(e,'changedTouches',{value:[{clientX:x,clientY:y}]});view.areaEl.dispatchEvent(e);};
  touch('touchstart',200,100);touch('touchend',200,100);
  assert.ok(view.contentEl.hasClass('er-chrome-hidden'));assert.ok(view.contentEl.querySelector('.er-top').hidden);
  view.areaEl.dispatchEvent(new p.window.MouseEvent('click',{bubbles:true,clientX:200}));
  assert.ok(view.contentEl.hasClass('er-chrome-hidden'));
  touch('touchstart',200,100);touch('touchend',200,100);
  assert.ok(!view.contentEl.hasClass('er-chrome-hidden'));assert.ok(!view.contentEl.querySelector('.er-bot').hidden);
  touch('touchstart',200,100);touch('touchend',200,150);
  assert.ok(!view.contentEl.hasClass('er-chrome-hidden'));assert.equal(directions.length,2);
 } finally {view?.onClose();p.close();}
});

test('mandatory device profiles migrate old appearance and isolate timer, layout and reading logs',async()=>{
 const p=await loadPlugin();
 try {
  const settings=p.evaluate('({...DEFAULT,perDevice:false,fontSize:22,dailyGoalMin:30,deviceProfiles:{phone:{fontSize:17}},readingLog:{today:5}})');
  p.context.profileSettings=settings;p.evaluate('applyDeviceProfile(profileSettings)');
  assert.equal(settings.perDevice,true);assert.equal(settings.fontSize,22);
  settings.fontSize=25;settings.timerEnabled=false;settings.mobileTextMargin=4;p.evaluate('captureDeviceProfile(profileSettings)');
  p.evaluate('Platform.isMobile=true');p.evaluate('applyDeviceProfile(profileSettings)');
  assert.equal(settings.fontSize,17);assert.equal(settings.timerEnabled,true);assert.equal(settings.dailyGoalMin,30);
  settings.readingLog.today=10;settings.readMode='scroll';p.evaluate('captureDeviceProfile(profileSettings)');
  p.evaluate('Platform.isMobile=false');p.evaluate('applyDeviceProfile(profileSettings)');
  assert.equal(settings.fontSize,25);assert.equal(settings.timerEnabled,false);assert.equal(settings.readMode,'pages');assert.equal(settings.readingLog.today,5);
  const plugin=new p.EltonReader();plugin.app={};plugin.settings=settings;
  plugin.loadData=async()=>({settings:{deviceProfiles:{phone:{fontSize:19,dailyGoalMin:45}}}});
  let saved;plugin.saveData=async data=>{saved=data;};await plugin._saveLocalData();
  assert.equal(saved.settings.deviceProfiles.phone.fontSize,19);assert.equal(saved.settings.deviceProfiles.desktop.fontSize,25);
 } finally {p.close();}
});

test('mobile margin control saves and repaginates while desktop has no phone margin control',async()=>{
 const p=await loadPlugin({Platform:{isMobile:true}});let modal;
 try {
  obsidianDom(p.window);const plugin=new p.EltonReader();plugin.app={isMobile:true};
  let saved=0,layouts=0;plugin._saveLocalData=async()=>{saved++;return true;};
  const view={app:plugin.app,plugin,_librarySettings:true,_readers:()=>[{_repaginate:async()=>{layouts++;}}]};
  modal=new p.ReadSettingsModal(plugin.app,view);modal.contentEl=p.window.document.createElement('div');modal.modalEl=p.window.document.createElement('div');modal.onOpen();
  const input=modal.contentEl.querySelector('[aria-label="Боковые отступы текста"]');assert.ok(input);
  input.value='8';input.dispatchEvent(new p.window.Event('change'));await new Promise(r=>p.window.setTimeout(r,0));
  assert.equal(plugin.settings.mobileTextMargin,8);assert.equal(saved,1);assert.equal(layouts,1);
  p.evaluate('Platform.isMobile=false');plugin.app.isMobile=false;
  modal.onOpen();assert.ok(!modal.contentEl.querySelector('[aria-label="Боковые отступы текста"]'));
 }finally {p.window.clearTimeout(modal?._saveT);p.close();}
});

test('mobile cover taps toggle controls and refresh button has a real SVG',async()=>{
 const p=await loadPlugin({Platform:{isMobile:true}});let view;
 try {
  obsidianDom(p.window);const plugin=new p.EltonReader();plugin.getGoalSeconds=()=>1200;plugin.getTodaySeconds=()=>0;
  view=new p.ReaderModal({},plugin,new p.TFile('Books/cover.epub'));view.app={isMobile:true};view.contentEl=p.window.document.createElement('div');
  view._buildDOM();assert.ok(view.contentEl.querySelector('[aria-label="Обновить книгу"] svg'));
  const image=view.areaEl.createEl('img',{attr:{src:'data:image/png;base64,AA=='}});
  image.dispatchEvent(new p.window.MouseEvent('click',{bubbles:true,clientX:200}));assert.ok(view.contentEl.querySelector('.er-top').hidden);
  image.dispatchEvent(new p.window.MouseEvent('click',{bubbles:true,clientX:200}));assert.ok(!view.contentEl.querySelector('.er-top').hidden);
  assert.ok(!p.window.document.querySelector('.er-lightbox'));
 }finally{view?.onClose();p.close();}
});

test('initial mobile pagination decodes cover before measuring and avoids GPU promotion from the start',async()=>{
 const p=await loadPlugin({Platform:{isMobile:true}});
 try {
  obsidianDom(p.window);let decoded=false,measured=false;
  p.window.HTMLImageElement.prototype.decode=async function(){await new Promise(r=>p.window.setTimeout(r,20));decoded=true;};
  const native=p.window.HTMLElement.prototype.getBoundingClientRect;
  p.window.HTMLElement.prototype.getBoundingClientRect=function(){
    if(this.classList.contains('er-end')){assert.ok(decoded);measured=true;assert.ok(this.parentElement.hasClass('er-flow-paint'));}
    return native.call(this);
  };
  const pager=new p.Paginator();const container=p.window.document.createElement('div');p.window.document.body.appendChild(container);
  await pager.build(container,'<p><img src="data:image/png;base64,AA=="></p><p>Text</p>',new p.EltonReader().settings,0);
  assert.ok(measured);assert.ok(decoded);assert.equal(pager.flow.style.transform,'');assert.ok(pager.flow.hasClass('er-flow-paint'));
  pager.destroy();
 }finally {p.close();}
});

test('captured mobile pointers toggle bars despite descendant handlers and stale text selection',async()=>{
 const p=await loadPlugin({Platform:{isMobile:true}});let view;
 try {
  obsidianDom(p.window);const plugin=new p.EltonReader();plugin.getGoalSeconds=()=>1200;plugin.getTodaySeconds=()=>0;
  view=new p.ReaderModal({},plugin,new p.TFile('Books/nested.epub'));view.app={isMobile:true};view.contentEl=p.window.document.createElement('div');
  p.window.document.body.appendChild(view.contentEl);view._buildDOM();view.areaEl.getBoundingClientRect=()=>({left:0,width:400,right:400});
  const wrapper=view.areaEl.createDiv();const paragraph=wrapper.createEl('p');const span=paragraph.createSpan({text:'Book text'});
  span.addEventListener('pointerup',e=>e.stopPropagation());
  const selection=p.window.getSelection();const range=p.window.document.createRange();range.selectNodeContents(span);selection.addRange(range);
  const pointer=(type,x,y)=>{const e=new p.window.Event(type,{bubbles:true});for(const [key,value]of Object.entries({pointerType:'touch',pointerId:1,clientX:x,clientY:y}))Object.defineProperty(e,key,{value});span.dispatchEvent(e);};
  pointer('pointerdown',200,100);pointer('pointerup',200,100);
  assert.ok(view.contentEl.querySelector('.er-top').hidden);assert.ok(selection.isCollapsed);
  span.dispatchEvent(new p.window.MouseEvent('click',{bubbles:true,clientX:200}));assert.ok(view.contentEl.querySelector('.er-top').hidden);
  pointer('pointerdown',200,100);pointer('pointerup',200,100);assert.ok(!view.contentEl.querySelector('.er-top').hidden);
  pointer('pointerdown',200,100);pointer('pointermove',200,160);pointer('pointerup',200,160);assert.ok(!view.contentEl.querySelector('.er-top').hidden);
  const image=wrapper.createEl('img',{attr:{src:'data:image/png;base64,AA=='}});image.dispatchEvent(new p.window.MouseEvent('dblclick',{bubbles:true}));
  assert.ok(!p.window.document.querySelector('.er-lightbox'));
 } finally {view?.onClose();p.close();}
});

test('first large EPUB opening completes the refresh pass before restoring its position',async()=>{
 const p=await loadPlugin({Platform:{isMobile:true}});let view;
 try {
  obsidianDom(p.window);const plugin=new p.EltonReader();plugin.app={isMobile:true};
  plugin.refreshHighlights=async()=>{};plugin.refreshProgress=async()=>{};plugin.getGoalSeconds=()=>1200;plugin.getTodaySeconds=()=>0;
  plugin.getProgress=()=>({block:7,pct:.5});
  p.context.largeHtml='<p>'+ 'Large book text '.repeat(18000)+'</p>';
  p.evaluate('extractEpub=async()=>largeHtml');
  view=new p.ReaderModal(plugin.app,plugin,new p.TFile('Books/large.epub'));view.app=plugin.app;
  view.contentEl=p.window.document.createElement('div');p.window.document.body.appendChild(view.contentEl);view._buildDOM();view._maybePromptBookNote=()=>{};
  let passes=0,restored=false;
  view.pager.build=async()=>{
    passes++;assert.ok(view._loading);view.areaEl.empty();
    view.pager.flow=view.areaEl.createDiv();view.pager.flow.createEl('p',{text:passes===1?'':'Visible after completed layout'});
    view.pager.total=20;view.pager.spread=0;
    if(passes===2)assert.ok(!view.areaEl.hasClass('er-booting'));
  };
  view.pager.spreadForBlock=()=>7;view.pager.jumpToBlock=block=>{assert.equal(passes,2);assert.equal(block,7);restored=true;return[7,20];};
  view._renderFlowHighlights=()=>{};view._flashBlock=()=>{};
  await view._loadBook();assert.equal(passes,2);assert.ok(restored);assert.match(view.pager.flow.textContent,/Visible after completed layout/);
 }finally{view?.onClose();p.close();}
});
