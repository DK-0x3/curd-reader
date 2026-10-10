# Curd Reader 1.0.0

First independent release maintained by DK-0x3, based on Book Reader 3.1.2 by Elton Labs. MIT licence with original attribution preserved.

- Organise books in virtual folders up to five levels without moving physical files.
- Search a lazy contents tree that highlights and reveals the current section.
- Refresh the library and open global reading settings from its header.
- Manage restore points: timestamps, excerpts, individual deletion and clearing while preserving your current position.
- More reliable navigation, note backlinks, export, persistence, migration, cancellation and PDF cleanup.
- Equal gallery cards, stable hover, scrolling and cover sizing.
- All offline PDF resources included in main.js; no extra asset folders.

Requires Obsidian 1.11.4+. Install using BRAT (`DK-0x3/curd-reader`) or copy main.js, manifest.json, styles.css to `.obsidian/plugins/curd-reader/`. Disable Book Reader first. Back up and copy its data.json before first enabling the fork to retain settings/history, and keep the same reading-data folder. Full migration instructions are in README.

Automated regression tests and a production build validate this release. Live verification on all devices and full DOM virtualisation remain outstanding. External sync conflicts remain possible.

The plugin is not yet submitted to the Obsidian directory: public permission for this fork has not been obtained.

Подробное русскоязычное описание всех исправлений, доработок и контекста находится в docs/WORKLOG.md. Краткий список изменений — CHANGELOG.md.
