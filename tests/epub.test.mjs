import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { loadPlugin } from './load-plugin.mjs';

test('real EPUB archive: nav, cross-chapter footnote, image and H6 survive extraction',async()=>{
  const env=await loadPlugin();
  env.window.URL.createObjectURL=()=>"blob:regression-test";
  env.window.URL.revokeObjectURL=()=>{};
  const previous={window:globalThis.window,document:globalThis.document,DOMParser:globalThis.DOMParser,XMLSerializer:globalThis.XMLSerializer};
  Object.assign(globalThis,{window:env.window,document:env.window.document,DOMParser:env.window.DOMParser,XMLSerializer:env.window.XMLSerializer});
  let plugin;
  try {
    const module=(await import('epubjs')).default;
    const epub=module.default || module;
    const zip=new JSZip();
    zip.file('mimetype','application/epub+zip');
    zip.file('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
    zip.file('OPS/book.opf','<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">test</dc:identifier><dc:title>Regression book</dc:title><dc:language>en</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/><item id="c" href="Text/c.xhtml" media-type="application/xhtml+xml"/><item id="n" href="Notes/n.xhtml" media-type="application/xhtml+xml"/><item id="i" href="Images/i.png" media-type="image/png"/></manifest><spine><itemref idref="c"/><itemref idref="n"/></spine></package>');
    zip.file('OPS/nav.xhtml','<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Nav</title></head><body><nav epub:type="toc"><ol><li><a href="Text/c.xhtml#chapter">Official chapter</a><ol><li><a href="Notes/n.xhtml#note">Notes</a></li></ol></li></ol></nav></body></html>');
    zip.file('OPS/Text/c.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter</title></head><body><h6 id="chapter">Small heading</h6><p>Main text <a href="../Notes/n.xhtml#note">1</a></p><img src="../Images/i.png"/></body></html>');
    zip.file('OPS/Notes/n.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Notes</title></head><body><p id="note">Footnote text</p></body></html>');
    zip.file('OPS/Images/i.png','iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',{base64:true});
    const buffer=await zip.generateAsync({type:'arraybuffer'});
    plugin=await loadPlugin({ePub:epub});
    const html=await plugin.extractEpub({}, {vault:{readBinary:async()=>buffer}});
    assert.match(html,/data-er-ref="OPS\/Notes\/n.xhtml#note"/);
    assert.match(html,/data-er-id="OPS\/Notes\/n.xhtml#note"/);
    assert.match(html,/src="data:image\/png;base64,/);
    const toc=plugin.buildTocItems(html);
    assert.equal(toc.length,2);assert.equal(toc[0].label,'Official chapter');assert.equal(toc[1].level,1);
  }finally {
    plugin?.close();env.close();
    for(const [key,value] of Object.entries(previous)) if(value===undefined)delete globalThis[key];else globalThis[key]=value;
  }
});
