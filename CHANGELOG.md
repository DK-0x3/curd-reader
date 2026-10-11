# Curd Reader changelog

## 1.0.1 — 2026-10-11

- Complete a second layout pass on first opening large mobile EPUBs, preserving the saved position and keeping the loading screen until layout finishes.
- Mandatory separate phone/tablet/desktop preference profiles, including reading timer, layout and reading logs, with migration of existing settings.
- Reliable Android center taps to hide toolbars, symmetric edge navigation in scroll mode, and adjustable mobile text margins.
- Overlay mobile reader toolbars with tap-to-toggle visibility, centered optional timer and direct search, highlights and contents actions.
- Fix the mobile search panel opening and show a visible retryable loading error.
- Use paint-based page positioning for very wide mobile books to avoid giant transformed layers.
- Compact mobile library toolbar, search, breadcrumbs and reading filters.
- Separate saved mobile card size with a two-column default on typical phone widths.
- Prevent folder cards from inheriting fixed mobile button heights and gallery rows from stretching or overlapping.
- Accessible card-size buttons and a regression check for independent mobile/desktop persistence.
- Bottom scroll clearance for Obsidian's mobile toolbar, isolated cover layers below host controls, and consistent SVG folder icons using the Obsidian theme accent.

Validation: 63 automated tests pass; ESLint reports 0 errors and 22 existing warnings. The large-EPUB first-opening workaround and device rendering still need confirmation on real Android hardware. Mobile image zoom by double tap has been removed.

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
