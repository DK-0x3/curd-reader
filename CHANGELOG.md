# Curd Reader changelog

## 1.0.0 — 2026-10-10

First independent MIT release by DK-0x3, based on Book Reader 3.1.2 by Elton Labs. Local development versions 3.1.3–3.1.7 are consolidated here.

### Added and improved

- Virtual library folders up to five levels, breadcrumb navigation, moves without changing physical files and one-time migration from manual categories.
- Library refresh, global reading settings and a vault-wide scan of books.
- Lazy hierarchical contents, search, current-section highlight, parent expansion and reveal; cached block lookup and visible-row measurements.
- One-column reading settings, clearer history with timestamps/excerpts, point deletion and clearing while retaining current progress.
- Equal folder/book cards, stable hover and cover sizing, contents scroll/focus preservation.
- Embedded PDF worker, fonts, CMaps, ICC/WASM decoders and fallback modules for three-file installation.
- Regression tests, release packaging/checksums, development documentation and licence notices.

### Fixed

- EPUB navigation/NCX and H1–H6, FB2 anchors, internal links, richer lists/tables/images.
- Exact note/highlight/contents/PDF jumps in paged, scrolling and mobile readers.
- Persistence races, malformed JSON protection, stale-data resurrection, folder migration, renamed books and bounded backups.
- Stale/cancelled loads, PDF cleanup, relayout position, timers and cover caches.
- Note-path ambiguity, export identity/deduplication, comments, exact backlinks, templates and inline-text search.
- Internal settings saves appearing as manual bookmarks; modal history replacing the side-panel container.

### Release changes

- Curd Reader identity and support links, preserving Elton Labs attribution and old export markers/URI compatibility.
- PDF.js 6.4.299, JSZip 3.10.2, esbuild 0.28.2 and compatible transitive fixes.
- SecretStorage keys, opt-in remote covers and bounded remote requests.

### Remaining limitations

Full-book DOM virtualisation is not implemented. External sync is not transactional. Live desktop/mobile, popout, sync and large-book checks remain necessary. Old backups/URLs are not bulk rewritten. Some upstream style/settings warnings remain. Obsidian directory submission is deferred pending its fork requirements.

The complete 45-point audit and all iteration records are in [WORKLOG.md](docs/WORKLOG.md).
