import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { loadPlugin } from './load-plugin.mjs';

function tinyPdf() {
  const stream='BT /F1 12 Tf 40 740 Td (A real PDF extraction regression sentence.) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf='%PDF-1.4\n';const offsets=[0];
  objects.forEach((object,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;});
  const start=pdf.length;pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return new TextEncoder().encode(pdf).buffer;
}
test('real PDF.js 6 extracts text and releases the loading task',async()=>{
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const p=await loadPlugin({pdfjsLib:pdfjs});
  try {
    p.evaluate("workerReady = true");
    const result=await p.extractPdf({}, {vault:{readBinary:async()=>tinyPdf()}},{});
    assert.match(result.html,/A real PDF extraction regression sentence/);
    assert.match(result.html,/data-pdf-page-no="1"/);
    await result.lazy.destroy();
  }finally{p.close();}
});

test('embedded fonts, CMaps and decoders match installed PDF.js and return fresh buffers',async()=>{
  const fs=await import('node:fs/promises');const {embeddedPdfResources}=await import('../src/pdf-resources.js');
  const assets={};for(const name of ['cmaps/78-H.bcmap','standard_fonts/LiberationSans-Regular.ttf','wasm/openjpeg.wasm'])assets[name]=(await fs.readFile('node_modules/pdfjs-dist/'+name)).toString('base64');
  const {BinaryDataFactory}=embeddedPdfResources(assets,atob);const factory=new BinaryDataFactory();
  for(const [kind,name] of [['cMapUrl','cmaps/78-H.bcmap'],['standardFontDataUrl','standard_fonts/LiberationSans-Regular.ttf'],['wasmUrl','wasm/openjpeg.wasm']]){
    const first=await factory.fetch({kind,filename:name.split('/')[1]}),second=await factory.fetch({kind,filename:name.split('/')[1]});assert.deepEqual(Buffer.from(first),await fs.readFile('node_modules/pdfjs-dist/'+name));assert.notEqual(first.buffer,second.buffer);
  }
  await assert.rejects(factory.fetch({kind:'wasmUrl',filename:'missing.wasm'}),/Missing embedded/);
});
test('real PDF operator rendering uses embedded standard fonts without vault assets',async()=>{
  const fs=await import('node:fs/promises');const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const {embeddedPdfResources}=await import('../src/pdf-resources.js');
  const assets={'standard_fonts/LiberationSans-Regular.ttf':(await fs.readFile('node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf')).toString('base64')};const options=embeddedPdfResources(assets,atob),calls=[];
  const Base=options.BinaryDataFactory;options.BinaryDataFactory=class extends Base{fetch(request){calls.push(request);return super.fetch(request);}};
  const task=pdfjs.getDocument({data:new Uint8Array(tinyPdf()),...options,useSystemFonts:false});
  try{const doc=await task.promise,page=await doc.getPage(1);await page.getOperatorList();assert.ok(calls.some(c=>c.kind==='standardFontDataUrl'));}finally{await task.destroy();}
});
