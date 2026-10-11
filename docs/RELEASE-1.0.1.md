# Curd Reader 1.0.1

Mobile library and reading improvements, with independent preferences for phone, tablet and desktop. Requires Obsidian 1.11.4+; MIT licence and Elton Labs attribution remain intact.

## Library

- Compact toolbar, search, folder breadcrumbs, counters and filters on phones.
- Separate mobile card size, with two columns by default on typical phone widths.
- Matching book/folder card dimensions, stable gallery rows and isolated cover layers below Obsidian controls.
- Bottom clearance for Obsidian's mobile toolbar.
- Consistent SVG folder icons using the current Obsidian theme accent.

## Reading

- Floating top and bottom controls above the text. The top contains Back, the optional timer, Save position and Refresh; the bottom contains Settings, Search, Notes/highlights and Contents, followed by page/progress counters.
- Short center taps toggle controls; left/right edge taps move backward/forward in tap navigation mode, including scrolling mode. Text selection and swiping retain their own gestures.
- Adjustable mobile side margins from 0 to 48px.
- Separate device preferences, typography, timers and reading logs. Existing settings migrate into the profiles without resetting them.
- Correct refresh icon and search-panel opening, plus a visible loading error with retry.
- Mobile page positioning without giant transformed layers, image decoding before initial measurements and relayout on width/height changes.
- An automatic second layout pass for large EPUBs before restoring the saved position, based on the reported manual-refresh workaround. The loading screen remains until layout completes.
- Removed double-tap image zoom from the mobile reader.

## Install or update

Use BRAT with `DK-0x3/curd-reader`, or place `main.js`, `manifest.json` and `styles.css` in `<vault>/.obsidian/plugins/curd-reader/` and reload the plugin. Keep your existing `data.json` and reading-data folder. If migrating from Book Reader, follow the backup and migration instructions in README before enabling the fork.

The ZIP includes the three installable files, README and licence notices. SHA256SUMS.txt accompanies the release. No separate PDF resource directory is required.

## Validation and limitations

63 automated tests pass, including device-profile migration/persistence, mobile layout and gesture regressions. ESLint reports 0 errors and 22 existing warnings; the production build and release packaging pass.

The first-opening blank screen reported for a large EPUB has not been reproduced on real Android hardware. The additional layout pass is a workaround based on the user's successful manual refresh; its result still needs device confirmation. Full-book DOM virtualisation and transactional external sync are not implemented.

Obsidian Community directory submission remains deferred pending permission from the original author. Full Russian development history: [docs/WORKLOG.md](https://github.com/DK-0x3/curd-reader/blob/1.0.1/docs/WORKLOG.md).
