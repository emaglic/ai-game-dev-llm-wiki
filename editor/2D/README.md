# 2D level editor

A dependency-free browser editor for versioned project data. It supports tile and object layers together and learns element types, controls and visual feedback from a catalog. Gameplay belongs to the game runtime. The included two-room fixture and runtime preview verify the contract; neither initializes a game.

## Launch

From the repository root (Python 3.9+):

```powershell
python editor/2D/server.py --open
python editor/2D/server.py --project game/game.project.json --open
```

The default fixture URL is `http://127.0.0.1:8765/editor/index.html?project=/project/game.project.json`. Omit `--open` to leave the browser closed. Use `--port 8766` if the port is busy, or `--port 0` for an automatically assigned port printed on startup. `--project` can point outside this repository: editor and project are mounted separately. All project documents/assets served by this save server must reside inside the selected manifest's directory (subdirectories are fine). Paths in JSON remain relative to the manifest. The browser loader also works with a different manifest URL on any static server with appropriate browser access/CORS rules.

## Editing

- Choose a level, layer and palette entry. Tile layers support paint, erase and rectangle fill. One drag is one undo step.
- Object layers support placement, selection, moving and catalog-authorized resizing. The inspector exposes transforms and declared typed properties; object IDs remain stable.
- Toggle grid/snapping. Wheel zooms around the pointer; middle/right drag pans. Fit level resets navigation. Editor navigation zoom is independent of game camera zoom.
- Layers have visibility, locking, opacity and order. Higher entries in the stack draw later; the up button increases drawing order. New layers can be added. Locked layers cannot be painted or transformed.
- Edit global and per-level properties. The fixture's camera center and zoom show a gold outline equal to the reference viewport divided by game camera zoom. Position camera sets its center on the canvas.
- Teleporter destinations have a level selector, search and a filtered object picker. Pick on canvas can target an appropriate object after switching levels. Local destinations draw dashed lines; cross-level ones show destination labels.
- Undo/redo buttons or Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z restore whole editing transactions. Delete removes a selected object. Escape cancels a gesture or reference pick.
- Save project writes settings, catalog and all levels to their existing paths. Reload the runtime preview to observe the same data. Export creates a portable JSON project bundle; Import bundle validates it before replacing the current project. Assets are not embedded in bundles. Imported bundles can be exported again; load an HTTP manifest for assets and server-backed saving.

Errors for invalid property values, unsupported structures/versions, duplicate IDs, broken references and missing images are visible. Invalid structural or reference data blocks loading/saving; errors caused by deleting a reference target can be repaired via the picker or undo. Missing assets draw the catalog fallback color and report their URL. Unknown fields in supported documents are retained. Export can preserve an in-progress invalid bundle for recovery; importing it requires repairing its validation errors.

## Saving guarantees

The server binds to loopback, rejects foreign origins/hosts and traversal, resolves symlinks before checking containment, and only writes JSON paths named by the manifest selected at launch. It does not create arbitrary files or rewrite the manifest. Edit manifest paths on disk and reload when changing project structure. A content revision blocks overwriting edits made on disk after loading. Export unsaved work before reloading a conflicting project.

Saves validate the complete project, stage files in their destination directories and replace them under a server lock. An ordinary write failure rolls back previously replaced files and cleans up staging files. This is not a crash-safe multi-file database transaction: interruption or power loss during replacement can leave a partial save. Keep project data in version control. The write API limits requests to 8 MiB. Static-server use supports load/import/export without the save API.

## Extensions and future games

Read [FORMAT.md](FORMAT.md) for schemas, concrete definitions and extension points. Future agents must declare editor-facing properties, align runtime semantics and verify a save in the runtime. Use existing tools first. Before significant editor changes, notify the developer of the intended change and compatibility impact; this is notification, not an approval gate.

The fixture runtime renders the same layers through `src/render.mjs`, applies its actual camera viewport, and follows teleporter references on click. It supplies no physics or genre assumptions. Its light/weather/difficulty fields demonstrate extensibility; they are not implemented gameplay.

## Verification

Python exercises validation, save/reload, disk conflicts, containment, HTTP origin rejection and rollback on an injected disk failure:

```powershell
python -m unittest discover -s editor/2D/tests -p test_server.py -v
```

Node is optional verification tooling, never a runtime requirement:

```powershell
node --test editor/2D/tests/model.test.mjs
node editor/2D/tests/browser.mjs
```

The browser check uses installed Chrome/Edge and native Node APIs, temporary fixture copies and a temporary browser profile. Pass a browser executable as its first argument if auto-discovery fails.

Deferred: flood fill, tile atlas/spritesheet authoring, multi-selection, object rotation, layer removal, arbitrary property-definition authoring in the UI, and custom overlay plug-in registration. Catalog/settings definitions are edited as JSON; custom controls have a registration map. Rendering currently uses rectangular element bounds, optional whole-image assets and radius/box/connection overlays. Large-world chunking/virtualization and a 3D editor are future extensions.
