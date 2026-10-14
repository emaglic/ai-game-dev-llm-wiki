# 2D level editor

A dependency-free browser editor for versioned project data. It supports tile and object layers together and learns element types, controls and visual feedback from a catalog. Gameplay belongs to the game runtime. The included two-room fixture and runtime preview verify the contract; neither initializes a game.

## Launch

From the repository root (Python 3.9+):

```powershell
python editor/2D/server.py --open
python editor/2D/server.py --project game/game.project.json --open
```

Open `http://127.0.0.1:8765/editor/index.html`. By default, the server selects this template's `game/game.project.json` and the editor loads it automatically when present. If it is absent, the editor shows **No game project found** and offers **Load example editor**. The fixture loads only after that explicit choice, displays **Example project — changes won't be saved**, and permits in-memory experimentation while disabling Save project. The server rejects all writes to the bundled fixture as well, even when selected explicitly with `--project`.

Omit `--open` to leave the browser closed. Use `--port 8766` if the port is busy, or `--port 0` for an automatically assigned port printed on startup. `--project` can point outside this repository: editor and project are mounted separately. All project documents/assets served by this save server must reside inside the selected manifest's directory (subdirectories are fine). Paths in JSON remain relative to the manifest. The browser loader also works with a different manifest URL on any static server with appropriate browser access/CORS rules. Missing explicitly supplied manifest paths are startup errors; the missing-game prompt handles the default uninitialized template.

## Editing

- The tool bar uses mutually exclusive icon buttons for Select/move, Paint/place, Rectangle fill, Resize object and Position camera. The active tool has a filled highlight; hover for its label. Left/right arrows and Home/End navigate the tool buttons. Space panning and right-drag erasing work across tools.
- Rectangle fill previews the exact tile-stamp footprint, using the same layout as the final fill. With Snap enabled its starting/end positions use Grid X/Y; with Snap disabled they use whole pixels. The outline includes the full dimensions of the final row/column of tiles rather than just the cursor-to-cursor rectangle.
- The vertical three-dot button at the far right opens **Level Editor Settings**, containing the manifest URL, Load project, Export project and Import bundle. Close or Escape dismisses settings. The main toolbar labels the Level selector and keeps Save project and Runtime preview accessible.
- **View** controls element labels, trigger ranges, reference connections and the camera viewport, and can hide either side panel. Drag panel dividers to resize, or focus a divider and use arrow keys (Home/End choose its size limits). View/panel preferences persist in this browser, outside project JSON and undo history. Selected elements retain relevant guides; Position camera always shows its viewport. Grid visibility is also a local view preference; Grid X/Y remain saved placement settings. On smaller desktop windows, the shortcut reminder becomes a Help tooltip.
- The left panel has Layers and Palette tabs. Each list uses the full available panel height and scrolls independently beneath the tabs. Choose the active layer in Layers, then switch to Palette to choose its elements. Arrow keys and Home/End navigate the tabs; ordinary edits preserve the active tab.
- Catalog artwork supplies palette thumbnails and placed sprites/tiles, including selected sprite-sheet frames. Missing artwork falls back to a labeled interaction shape. Select a sprite to see its collider outline. Invisible regions show translucent, dashed editor-only bounds; rectangle, ellipse and polygon shapes are supported. See FORMAT.md for artwork sizing, source crops and runtime collision requirements.
- Choose a level, layer and palette entry. Tile layers support paint, erase and rectangle fill. Later tiles draw on top and picking selects the topmost collision shape; right-drag erases all touched tiles on the active layer. Painting at an exact existing origin changes its type while preserving its size/extension data. One drag is one undo step.
- The right panel separates **Selection** properties (objects and tiles) from **Level** settings (dimensions, tile defaults, level and global settings). Selecting an element opens Selection; you can switch to Level while keeping it selected. Both tabs scroll independently and support arrow-key navigation. Level settings are grouped into dimensions, tile defaults, camera, other level settings and global settings; global settings apply to all levels.
- Select/move selects an object or tile on the active layer. Press Delete/Backspace to remove it. Right-click or hold right-click and drag to erase tiles/objects on the active visible, unlocked layer. Fast drags erase along the cursor path, even when starting on empty space; the entire stroke is one undo step. Escape cancels and restores the stroke. Holding Space suppresses right-click deletion. Drag an object's interior or a selected tile to move it. Tile drags use Grid X/Y when Snap is enabled and whole pixels when disabled, preserving all tile data. Overlap and out-of-level placement are allowed; an exact duplicate origin is protected. A move is one undo step and Escape cancels it. Tile positions and sizes are independent of snapping. Selected tiles expose pixel X/Y and width/height in Properties. Object IDs remain stable. The runtime consumes the same v2 pixel tile data.
- Resizable catalog objects support dragging any edge or corner directly in Select/move. Hover near an edge to see a resize cursor. The opposite edge stays anchored; snapping uses the corresponding X/Y grid, and disabling Snap uses whole-pixel increments. Sizes remain at least one pixel. The explicit Resize object tool and numeric inspector remain available.
- Toggle grid/snapping. Grid X and Grid Y set independent positive whole-pixel spacings for the visible editor grid and tile/object/camera snapping, saved per level as editor metadata. Tile dimensions come from catalog size or level tileSize, independently of snapping. Level settings expose defaults for newly placed tiles; existing tiles retain their dimensions. Rectangle fill repeats tile-sized stamps from its snapped or unsnapped origin. Wheel zooms around the pointer; hold Space and left-drag to pan. Panning suppresses normal left-click tool actions, and releasing focus clears the Space modifier. Fit level resets navigation. Editor navigation zoom is independent of game camera zoom.
- Layers appear as rounded accordions: click a name to select the active layer; click its separate right-hand arrow to expand/collapse visibility, locking, opacity and order controls. Expanding settings preserves the active layer. Both buttons support keyboard activation. Collapsed layer headers show locked/hidden indicators. Expansion is editor-local and survives ordinary edits. Raise moves a layer later in drawing order. New layers can be added. Locked layers cannot be painted, deleted, moved or resized.
- Edit global and per-level properties. The fixture's camera center and zoom show a gold outline equal to the reference viewport divided by game camera zoom. Position camera lets you drag inside the gold viewport to move the camera relative to its current center. Snapping uses Grid X/Y; disabling Snap uses 1px steps. A click does not reposition it. Each drag is one undo step; Escape cancels it. Numeric camera fields remain available for precise values.
- Level settings includes **Level width**, **Level height**, a 3×3 **Anchor** selector and **Apply resize**. Dimensions are draft values until applied, and both axes change in one undo step. The anchor chooses the part that stays fixed: top-left adds space right/below; top-right adds width on the left; bottom anchors add height above; center distributes changes. All layers, the camera and declared world-position properties shift together. Content is preserved when shrinking, with an out-of-bounds notice. Resizes accept any positive dimensions; anchor translations round to the nearest whole pixel, with .5 rounding toward positive infinity. The preview displays the actual offset, so a centered odd-sized change may put the extra pixel on one side. Fit level reframes the editor view when needed.
- Teleporter destinations have a level selector, search and a filtered object picker. Pick on canvas shows a persistent picking notice, Cancel button and target cursor, and enters a temporary reference mode and can target an appropriate object after switching levels. Picking a valid target or pressing Escape returns to Select/move; there is no standalone reference tool button. Local destinations draw dashed lines; cross-level ones show destination labels.
- Undo/redo buttons or Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z restore whole editing transactions, including grid changes and edge drags. Escape cancels a gesture or reference pick.
- Save project writes settings, catalog and all levels to their existing paths. Reload the runtime preview to observe the same data. Export creates a portable JSON project bundle; Import bundle validates it before replacing the current project. Assets are not embedded in bundles. Imported bundles can be exported again; load an HTTP manifest for assets and server-backed saving.

Errors for invalid property values, unsupported structures/versions, duplicate IDs, broken references and missing images are visible. Invalid structural or reference data blocks loading/saving; errors caused by deleting a reference target can be repaired via the picker or undo. Missing assets draw the catalog fallback color and report their URL. Unknown fields in supported documents are retained. Export can preserve an in-progress invalid bundle for recovery; importing it requires repairing its validation errors.

## Saving guarantees

The server binds to loopback, rejects foreign origins/hosts and traversal, resolves symlinks before checking containment, and only writes JSON paths named by the game manifest selected at launch. Bundled example fixture files are read-only. It does not create arbitrary files or rewrite the manifest. Edit manifest paths on disk and reload when changing project structure. A content revision blocks overwriting edits made on disk after loading. Export unsaved work before reloading a conflicting project.

Saves validate the complete project, stage files in their destination directories and replace them under a server lock. An ordinary write failure rolls back previously replaced files and cleans up staging files. This is not a crash-safe multi-file database transaction: interruption or power loss during replacement can leave a partial save. Keep project data in version control. The write API limits requests to 8 MiB. Static-server use supports load/import/export without the save API.

## Extensions and future games

For editor changes, read [MAINTAINING.md](MAINTAINING.md) for module responsibilities, compatibility rules, validation requirements and known verification gaps.

Editor UI icons are a locally vendored subset of Google's Material Icons (Apache-2.0), requiring no CDN or npm install. See [icon provenance and usage](vendor/material-icons/README.md) for the pinned revision, original source URLs, license and how to add icons. Keep visible labels or accessible names when using them in controls.

Read [FORMAT.md](FORMAT.md) for schemas, concrete definitions and extension points. Future agents must declare editor-facing properties, align runtime semantics and verify a save in the runtime. Use existing tools first. Before significant editor changes, notify the developer of the intended change and compatibility impact; this is notification, not an approval gate.

The fixture runtime renders the same layers through `src/render.mjs`, applies its actual camera viewport, and follows teleporter references on click. It supplies no physics or genre assumptions. Its light/weather/difficulty fields demonstrate extensibility; they are not implemented gameplay.

## Verification

Python exercises validation, save/reload, disk conflicts, containment, HTTP origin rejection and rollback on an injected disk failure:

```powershell
python -m unittest discover -s editor/2D/tests -p "test_*.py" -v
```

Node is optional verification tooling, never a runtime requirement:

```powershell
node --test editor/2D/tests/model.test.mjs editor/2D/tests/interactions.test.mjs editor/2D/tests/appearance.test.mjs editor/2D/tests/level-resize.test.mjs editor/2D/tests/tiles.test.mjs
node editor/2D/tests/browser.mjs
```

The browser check uses installed Chrome/Edge and native Node APIs, temporary fixture copies and a temporary browser profile. It covers accordion layers, per-axis grid saving, edge resizing, tile deletion, and Space panning across tools as well as the base load/save/import/reference workflow. Pass a browser executable as its first argument if auto-discovery fails.

Deferred: flood fill, visual atlas/spritesheet authoring UI (source crops are configured in JSON), animated editor sprites, multi-selection, object rotation, layer removal, arbitrary property-definition authoring in the UI, and custom overlay plug-in registration. Catalog/settings definitions are edited as JSON; custom controls have a registration map. Rendering supports whole images/source frames, rectangle/ellipse/polygon interaction shapes and radius/box/connection overlays. Large-world chunking/virtualization and a 3D editor are future extensions.

## Existing game migration

Levels now use version 2 pixel tile records. Manifest/settings/catalog stay version 1. The editor rejects cell-based v1 levels with migration instructions. Preview the conversion before applying:

```powershell
python editor/2D/migrate_levels.py --project game/game.project.json
python editor/2D/migrate_levels.py --project game/game.project.json --apply
```

Each v1 tile position is multiplied by the old grid size and receives explicit width/height equal to that size. The script validates the complete converted project before writing, keeps `.json.v1.bak` originals, refuses to overwrite backups and is idempotent. Conflicting reserved extension fields or fractional legacy tile sizes require manual migration. Update the game runtime to use v2 pixels before playing converted levels. The bundled fixture has already been converted and remains read-only. See FORMAT.md for details.
