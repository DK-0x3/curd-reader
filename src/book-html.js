import { epubAddress } from "./reader-core.js";

const escape = text => String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const blockTags = /^(p|div|section|article|main|aside|figure|figcaption|h[1-6]|ul|ol|dl|li|dt|dd|table|pre|blockquote|hr|img)$/i;
function address(el) {
  const id = el.getAttribute?.("id") || el.getAttribute?.("name");
  return id ? ` data-er-id="${escape(epubAddress("#" + encodeURIComponent(id), el.ownerDocument.__erBase || ""))}"` : "";
}
function safeImage(src) { return /^(data:image\/|blob:)/i.test(src) ? src : ""; }
export function inlineBookHtml(el) {
  let out = "";
  for (const node of el.childNodes || []) {
    if (node.nodeType === 3) { out += escape(node.textContent); continue; }
    if (node.nodeType !== 1) continue;
    const tag = node.localName.toLowerCase();
    if (["script", "style", "iframe", "object", "embed"].includes(tag)) continue;
    if (/^(ul|ol|dl)$/.test(tag) && /^(li|dt|dd)$/i.test(el.localName)) continue;
    const inner = inlineBookHtml(node);
    const attr = address(node);
    if (["b", "strong", "i", "em", "sup", "sub", "s", "del", "u", "code", "kbd", "samp", "tt", "var", "span"].includes(tag)) {
      out += `<${tag}${attr}>${inner}</${tag}>`;
    } else if (tag === "br") out += "<br>";
    else if (tag === "img" || tag === "image") {
      const src = safeImage(node.getAttribute("src") || node.getAttribute("href") || node.getAttribute("xlink:href") || "");
      if (src) out += `<img${attr} src="${escape(src)}" alt="${escape(node.getAttribute("alt"))}">`;
    } else if (tag === "a") {
      const href = node.getAttribute("href") || "";
      let ref = null;
      try { if (href) ref = epubAddress(href, el.ownerDocument.__erBase || ""); } catch { /* invalid address */ }
      if (ref) out += `<a${attr} class="er-fb2-ref" data-er-ref="${escape(ref)}" role="button" tabindex="0">${inner}</a>`;
      else if (/^https?:\/\//i.test(href)) out += `<a${attr} href="${escape(href)}" rel="noopener noreferrer" target="_blank">${inner}</a>`;
      else out += `<span${attr}>${inner}</span>`;
    } else out += attr ? `<span${attr}>${inner}</span>` : inner;
  }
  return out;
}
export function bookNodeHtml(el) {
  if (!el) return "";
  const tag = (el.localName || "").toLowerCase();
  if (["script", "style", "iframe", "object", "embed"].includes(tag)) return "";
  const attr = address(el);
  if (tag === "img" || tag === "image" || tag === "svg") {
    const img = tag === "svg" ? el.querySelector("image") : el;
    const src = img && safeImage(img.getAttribute("src") || img.getAttribute("href") || img.getAttribute("xlink:href") || "");
    return src ? `<img${attr} src="${escape(src)}" alt="${escape(img.getAttribute("alt"))}">` : (attr ? `<span${attr}></span>` : "");
  }
  if (/^h[1-6]$/.test(tag)) return `<${tag}${attr}>${inlineBookHtml(el)}</${tag}>`;
  if (tag === "pre") return `<pre${attr} class="er-code"><code>${escape(el.textContent).replace(/\s+$/, "")}</code></pre>`;
  if (tag === "br" || tag === "hr") return `<${tag}${attr}>`;
  if (tag === "table") {
    const rows = [...el.querySelectorAll("tr")].filter(row => row.closest("table") === el).map(row => {
      const cells = [...row.children].filter(cell => /^(td|th)$/i.test(cell.localName)).map(cell => {
        const cellTag = cell.localName.toLowerCase();
        const span = key => { const n = Number(cell.getAttribute(key)); return Number.isInteger(n) && n > 1 && n < 1000 ? ` ${key}="${n}"` : ""; };
        return `<${cellTag}${address(cell)}${span("colspan")}${span("rowspan")}>${inlineBookHtml(cell)}</${cellTag}>`;
      }).join("");
      return `<tr${address(row)}>${cells}</tr>`;
    }).join("");
    return `<table${attr} class="er-table">${rows}</table>`;
  }
  if (tag === "li" || tag === "dt" || tag === "dd") {
    // Keep the legacy paragraph anchor while retaining list semantics.
    return `<${tag}${attr}><p>${inlineBookHtml(el)}</p>${[...el.children].filter(c => /^(ul|ol|dl)$/i.test(c.localName)).map(bookNodeHtml).join("")}</${tag}>`;
  }
  if (tag === "p") return `<p${attr}>${inlineBookHtml(el)}</p>`;
  if (tag === "blockquote") return `<blockquote${attr}><p>${inlineBookHtml(el)}</p></blockquote>`;
  if (/^(ul|ol|dl)$/.test(tag)) return `<${tag}${attr}>${[...el.children].map(bookNodeHtml).join("\n")}</${tag}>`;
  if (/^(div|section|article|body|main|aside|figure)$/.test(tag)) {
    const role = el.getAttribute("role");
    if (role === "heading") {
      const level = Math.max(1, Math.min(6, Number(el.getAttribute("aria-level")) || 2));
      return `<h${level}${attr}>${inlineBookHtml(el)}</h${level}>`;
    }
    const hasBlocks = [...el.children].some(c => blockTags.test(c.localName));
    if (!hasBlocks) return `<div${attr}><p>${inlineBookHtml(el)}</p></div>`;
    const children = [];
    let text = "";
    const flush = () => { if (text.trim()) children.push(`<p>${text}</p>`); text = ""; };
    for (const child of el.childNodes) {
      if (child.nodeType === 3) text += escape(child.textContent);
      else if (child.nodeType === 1) { flush(); children.push(bookNodeHtml(child)); }
    }
    flush();
    const wrapper = tag === "aside" ? "aside" : tag === "figure" ? "figure" : "div";
    return `<${wrapper}${attr}${tag === "aside" ? ' class="er-side-notes"' : ""}>${children.join("\n")}</${wrapper}>`;
  }
  return `<p${attr}>${inlineBookHtml(el)}</p>`;
}
