# Maintaining the shared 2D editor

Read [FORMAT.md](FORMAT.md) and [README.md](README.md) before changing editor behavior. This is reusable template infrastructure; template-only work leaves `game/` and `wiki/` unused. Provider entry files point to `.agents/project-guidelines.md`; update shared guidance rather than adding provider-specific rules.

## Version and runtime requirements

- Manifest, settings and catalog: version 1. Levels: version 2, with integer pixel tile x/y/width/height and independent tileSize defaults. The legacy level-v1 schema is for migration only.
- `grid` and editor Grid X/Y are snapping aids. Runtime code draws v2 tiles directly at their pixel coordinates, allows overlap/overhang, and derives world dimensions from the level.
- Catalog artwork, source frames and collision shapes must match runtime interpretation. World/local position metadata determines what anchored resizing translates. Unknown extension fields must survive editing/saving.
- Notify the developer before significant schema, tool, custom control or save-behavior changes, describing compatibility impact. Breaking changes require a new version and an explicit migration. Notification is not an approval gate.

## File responsibilities

| Files | Responsibility |
| --- | --- |
| `src/app.js`, `index.html`, `style.css` | UI, selection, gestures, settings and example onboarding |
| `src/menus.mjs` | Project/View/Help disclosures, keyboard navigation and help dialogs |
| `src/workspace.mjs` | Browser-local overlay/panel preferences, panel resizing and View controls; never serialized as game data |
| `src/model.mjs` | Validation, serialization, history, indexed tile painting and tile moves |
| `src/tiles.mjs`, `src/interactions.mjs` | Pixel tile picking/strokes/fill and pointer geometry |
| `src/level-resize.mjs` | Anchored resize transactions and world-position translation |
| `src/controls.mjs` | Typed property controls and custom control registration |
| `src/appearance.mjs`, `src/render.mjs` | Artwork, collision geometry, hit testing, layer rendering and overlays |
| `src/io.mjs`, `server.py` | Loading, optimistic revisions, validation and confined filesystem saves |
| `schemas/`, `migrate_levels.py` | Serialized contracts and explicit v1-to-v2 conversion with backups |
| `fixture/`, `preview.html`, `src/preview.js` | Example data and a minimal contract consumer, not an actual game |
| `vendor/material-icons/` | Local SVG subset, pinned provenance and license |

Browser and Python validators are independent: update both and their tests when extending serialized fields. The Python schema checker supports a documented subset of JSON Schema; adding schema keywords requires implementing their validation too. Keep gestures cancellable and each completed stroke/move/resize one undo step. Preserve layer locks for ordinary editing; anchored level resize translates every layer together.

## Save and migration constraints

The server selects this game's manifest at launch, binds to loopback, checks host/origin, confines resolved paths and rejects stale revisions. Example fixture writes must remain blocked by both UI and server. An imported bundle has no disk destination; exporting it is the fallback. Export is a single editor backup bundle, not a ZIP or game-ready replacement directory.

Run migration with the editor server stopped and other writers idle. Agents migrating files under `game/` must acquire the normal game write lock. Dry-run first, apply explicitly, preserve `.json.v1.bak` originals and update the runtime before playing converted levels. Saving/migration stages and rolls back ordinary errors but is not crash-safe across multiple files.

## Verification and remaining scope

Use the commands in README.md: all JavaScript model tests, all Python `test_*.py` tests and the Chrome/Edge browser workflow. Browser tests use temporary game copies, never saved changes to the bundled fixture. Check actual game save/reload behavior after integrating editor changes into a game; the fixture preview only verifies the contract.

Automated UI coverage currently uses desktop Chromium. Mobile/touch, Firefox and Safari need separate validation if targeted. This editor uses desktop pointer/keyboard interactions; physical/virtual gamepads and fullscreen requirements apply to playable games rather than this tooling UI. Tile rendering and shape queries are not chunked/virtualized; use runtime spatial indexing and profile representative large levels when needed. Drawing-count and collision costs matter more than whether tile coordinates are cells or pixels.

Deferred features are listed in README.md, including flood fill, multi-selection, animated editor sprites, graphical atlas authoring and a 3D editor. Actual gameplay behavior belongs to the game. No existing external game has been migrated in this template session.
