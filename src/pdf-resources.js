// Build-time embedded resources: community installs download only three files.
// Return fresh buffers because PDF.js transfers them to its worker.
export function embeddedPdfResources(assets, decode) {
  const folders = { cMapUrl: 'cmaps', standardFontDataUrl: 'standard_fonts', wasmUrl: 'wasm' };
  class BinaryDataFactory {
    async fetch({ kind, filename }) {
      const encoded = assets[`${folders[kind]}/${filename}`];
      if (!encoded) throw new Error(`Missing embedded PDF resource: ${kind}/${filename}`);
      const binary = decode(encoded);
      return Uint8Array.from(binary, char => char.charCodeAt(0));
    }
  }
  // Sentinel URLs satisfy PDF.js option validation; BinaryDataFactory resolves
  // them in memory, and the embedded worker resolves ICC/fallback modules.
  return { BinaryDataFactory, cMapUrl:'https://curd-reader.invalid/cmaps/', standardFontDataUrl:'https://curd-reader.invalid/fonts/', wasmUrl:'https://curd-reader.invalid/wasm/', useWorkerFetch:false };
}
