# Commit description

```text
feat: release Curd Reader 1.0.1 with mobile library and reader improvements

Adapt the mobile library toolbar, filters, cards and bottom clearance.
Use theme-accent SVG folders and isolate cover layers below host controls.

Add floating mobile reading controls, capture-phase tap handling, symmetric
edge navigation and configurable text margins. Remove double-tap image zoom.
Separate phone/tablet/desktop preferences, timers and logs with migration.

Improve mobile EPUB layout, image readiness and resize handling. Complete
an automatic second layout pass for large EPUBs before restoring position,
based on the reported manual-refresh workaround; real Android verification
of that first-opening issue remains outstanding.

Document the release, migration, validation and remaining limitations.
Validate with 63 tests, ESLint (0 errors, 22 existing warnings), production
build and release packaging. Preserve MIT and Elton Labs attribution.
```
