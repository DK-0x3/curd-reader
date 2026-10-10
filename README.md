# Curd Reader

Read EPUB, FB2 and PDF books in Obsidian. Organise your vault-wide library in virtual folders, highlight passages and turn them into notes.

Maintained by **DK-0x3**. An independent MIT fork of [Book Reader by Elton Labs](https://github.com/swayinfo/elton-reader), based on upstream 3.1.2. This is not an official Elton Labs release.

## Features

- Virtual gallery folders up to five levels deep; physical books stay in place.
- Covers, progress, global search, status filters and a library refresh button.
- Lazy searchable contents with current-section highlighting, parent expansion and automatic reveal.
- Paged/scrolling reading, themes and global typography settings available from the library.
- Highlights, comments, book notes, exports and exact links back to the passage/PDF page.
- Restore history with timestamps and excerpts; delete points or clear history while retaining the current position.
- Offline PDF worker, fonts, CMaps and decoders embedded in the release.

## Install

First independent release: **1.0.0**. Requires Obsidian **1.11.4+**. Desktop and mobile code paths are supported; live verification on all devices has not been performed.

Curd Reader is **not yet in the Obsidian Community directory**. Fork submission is deferred pending [Obsidian's requirements](https://docs.obsidian.md/community-directory/developer-policies).

**BRAT:** add `DK-0x3/curd-reader`, then enable Curd Reader.

**Manual:** download `main.js`, `manifest.json`, `styles.css` from the [latest release](https://github.com/DK-0x3/curd-reader/releases/latest) to `<vault>/.obsidian/plugins/curd-reader/`, reload and enable the plugin. No separate PDF asset directory is needed.

## Migrate from Book Reader

1. Back up your vault and disable Book Reader before enabling Curd Reader. Both readers handle EPUB/FB2 and share reading-data formats.
2. To retain local settings/history, copy the original plugin's `data.json` into the Curd Reader directory before first enabling it. Do not overwrite newer Curd Reader data.
3. Keep the same reading-data folder. Progress, highlights and virtual folders are not reset by installation.
4. Old manual categories migrate once into virtual root folders, retaining legacy multiple memberships.

New note links use `obsidian://curd-reader`. Old `elton-reader` links are handled when the original plugin is disabled. Existing export markers are retained. SecretStorage migration can read the old key; new saves use Curd Reader's namespace.

## Data and privacy

Progress, highlights and folders are readable JSON in the configured reading-data folder, otherwise the import folder, otherwise the vault root. They follow your vault sync. Appearance, book-note links, restore history and caches remain local in the plugin's `data.json`.

API keys use Obsidian SecretStorage and are omitted from new JSON/backups. Old backups are not rewritten. No telemetry is added. Reading works offline unless you enable an optional network feature:

| Feature | Destination and data | Default |
| --- | --- | --- |
| Translation | Google Translate: selected passage and language settings | Off |
| Passage analysis | Your configured Elton AI, OpenRouter, OpenAI or custom/local endpoint: selected text, book context and prompt | Off |
| Remote covers | The configured cover URL; its server receives the image request | Off |

Providers may require accounts, keys or payment. Local Ollama/LM Studio endpoints can keep analysis on your machine. Passage analysis does not send the whole book.

## Development

```sh
npm ci
npm test
npm run lint
npm run build
npm run release:prepare
```

Release preparation creates the three installable files and checksums in `dist/1.0.0/`. See [development notes](docs/DEVELOPMENT.md).

Tests cover real EPUB/PDF extraction, embedded resources, navigation, data protection, folders, contents and history. Live desktop/mobile, popout, two-device sync and large-book verification remain necessary. Full-book DOM virtualisation is not implemented. External sync is not transactional. Static checking retains documented upstream warnings.

## Changes, licence and support

- [Changes](CHANGELOG.md), [release notes](docs/RELEASE-1.0.0.md), [commit description](docs/COMMIT-1.0.0.md).
- [All audit fixes and work context](docs/WORKLOG.md).
- [MIT licence](LICENSE), [third-party notices](NOTICE.md), verbatim dependency licences in `licenses/` and the generated bundle.
- [Report an issue](https://github.com/DK-0x3/curd-reader/issues).

Elton Labs' original copyright is preserved. Archived upstream README/screenshots describe the original interface, not this release.

## Russian documentation

The detailed Russian audit, iteration history, completed work and remaining limitations are in [WORKLOG.md](docs/WORKLOG.md). This is the first independent Curd Reader release; local builds 3.1.3-3.1.7 were development iterations, not public Curd Reader releases.
