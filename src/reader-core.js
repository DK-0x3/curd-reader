// Legacy paragraph indices stay first; newly supported elements are appended.
// This lets old progress/quote URLs keep their P,H1-H4 addresses.
export const LEGACY_BLOCKS = "p,h1,h2,h3,h4";
export const EXTRA_BLOCKS = "h5,h6,pre,td,th,figure";
export function readerBlocks(flow) {
  if (!flow) return [];
  const old = [...flow.querySelectorAll(LEGACY_BLOCKS)];
  const extra = [...flow.querySelectorAll(EXTRA_BLOCKS)].filter(el =>
    !el.querySelector(`${LEGACY_BLOCKS},${EXTRA_BLOCKS}`) && !el.parentElement?.closest("pre"));
  return old.concat(extra);
}
export function blockOwner(target, flow) {
  const blocks = readerBlocks(flow);
  return blocks.find(el => el === target || el.contains(target))
    || blocks.find(el => target.contains(el)) || null;
}
export function normalizedText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}
export function anchorFor(el) {
  if (!el) return null;
  return {
    id: el.getAttribute("data-er-id") || el.closest("[data-er-id]")?.getAttribute("data-er-id") || "",
    text: normalizedText(el.textContent).slice(0, 160),
  };
}
export function resolveAnchor(flow, anchor, fallback) {
  const blocks = readerBlocks(flow);
  if (!anchor) return fallback;
  const text = anchor.text || "";
  const matches = blocks.map((el, index) => ({ el, index }))
    .filter(({ el }) => text && normalizedText(el.textContent).startsWith(text));
  if (matches.length) {
    matches.sort((a, b) => Math.abs(a.index - fallback) - Math.abs(b.index - fallback));
    return matches[0].index;
  }
  if (anchor.id) {
    const target = [...flow.querySelectorAll("[data-er-id]")].find(el => el.getAttribute("data-er-id") === anchor.id);
    const owner = target && blockOwner(target, flow);
    if (owner) return blocks.indexOf(owner);
  }
  return fallback;
}
export function archivePath(href, base = "") {
  const url = new URL(href, "https://reader.invalid/" + base.replace(/^\//, ""));
  if (url.origin !== "https://reader.invalid") return null;
  return decodeURIComponent(url.pathname.replace(/^\//, ""));
}
export function epubAddress(href, base = "") {
  const url = new URL(href, "https://reader.invalid/" + base.replace(/^\//, ""));
  if (url.origin !== "https://reader.invalid") return null;
  return `${decodeURIComponent(url.pathname.replace(/^\//, ""))}#${decodeURIComponent(url.hash.slice(1))}`;
}
export function abortError() {
  const error = new Error("Reading operation cancelled");
  error.name = "AbortError";
  return error;
}
export function checkAbort(signal) { if (signal?.aborted) throw abortError(); }
export async function bounded(promise, ms, { signal, cancel = () => {} } = {}) {
  checkAbort(signal);
  let timer, listener;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      const fail = error => { try { cancel(); } catch { /* cleanup */ } reject(error); };
      timer = globalThis.setTimeout(() => fail(new Error("Operation timed out")), ms);
      listener = () => fail(abortError());
      signal?.addEventListener("abort", listener, { once: true });
    })]);
  } finally {
    globalThis.clearTimeout(timer);
    signal?.removeEventListener("abort", listener);
  }
}
export function validateRecord(value, kind) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${kind} data`);
  for (const [key, entry] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Invalid data key");
    if (kind === "highlights") {
      if (!Array.isArray(entry) || entry.some(hl => !hl || typeof hl.id !== "string" || typeof hl.text !== "string" || !Number.isInteger(hl.block) || hl.block < 0)) throw new Error("Invalid highlights data");
    } else if (!entry || typeof entry !== "object" || Array.isArray(entry)
      || (entry.pct !== undefined && (!Number.isFinite(entry.pct) || entry.pct < 0 || entry.pct > 1))) throw new Error("Invalid progress data");
  }
  return value;
}
export function mergeProgress(disk, local, deleted = new Set()) {
  const result = { ...disk };
  for (const [key, entry] of Object.entries(local)) {
    if (!result[key] || (Number(entry.lastRead) || 0) >= (Number(result[key].lastRead) || 0)) result[key] = entry;
  }
  for (const key of deleted) delete result[key];
  return result;
}
export function activateButton(el) {
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
  el.addEventListener("keydown", event => {
    if (event.target === el && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault(); event.stopPropagation(); el.click();
    }
  });
  return el;
}
