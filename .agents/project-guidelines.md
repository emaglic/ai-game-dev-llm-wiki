# Agent Project Guidelines

This repository is a reusable template for AI-assisted browser game development.

This is the canonical shared instruction file for agents. Provider-specific entry files such as `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` should point here instead of duplicating these rules.

Provider-neutral workflows live in `.agent-workflows/`. Treat workflow names such as `/init-game` as plain-text triggers outside providers that natively support them. Do not create provider-specific commands, skills, memory files, or workflow systems unless the user explicitly asks for that provider integration.

For focused UI/UX review requests, follow [`.agent-workflows/ui-ux-review.md`](../.agent-workflows/ui-ux-review.md). Review exactly one explicitly chosen target, game or editor; ask which if it is unspecified. This workflow suggests usability and visual improvements without implementing them. In Codex, `/ui-ux-review` can use the repo-scoped skill at [`.codex/skills/ui-ux-review/SKILL.md`](../.codex/skills/ui-ux-review/SKILL.md).

After meaningful feature work, refactors, visual/input changes, game scaffold changes, dependency changes, or before the human developer commits, recommend `/self-review`. Before running it, ask the human developer whether they want the review, briefly explain what it checks, and briefly explain why it is being recommended at that moment. Do not run it automatically unless the user has asked for it or agreed to it.

Agents should treat root-level directories as having distinct ownership:

- `assets/` is the human developer's source asset inbox. Read from it, but do not mutate it.
- `game/` is where agents create and maintain the runnable browser game.
- `editor/` contains reusable template editors. `editor/2D/fixture/` is verification data, not an initialized game. Reserve `editor/3D/` for a future editor.
- `wiki/` is durable project memory for design, architecture, plans, decisions, and useful implementation context.
- `temp/` is ephemeral. Copy any durable insight from temp files into `wiki/` before relying on it long-term.

Prefer browser-native ES modules for the initial project so NodeJS is not required. Use NodeJS-based tooling only when the user asks for it or the game has outgrown the no-build setup.

Before making game changes, inspect the relevant wiki pages. After making durable design or architecture decisions, update the wiki.

Template maintenance, including shared editor work, does not initialize a game. For template-only work, do not read or populate the wiki, create game session activity logs, or invoke initialization. Keep reusable documentation beside the editor or in shared workflows.

## Shared 2D Editor Contract

During initialization, determine whether the game is 2D, 3D, or undecided. For 2D games, read [the editor contract](../editor/2D/FORMAT.md) and [usage guide](../editor/2D/README.md). Build around its versioned manifest, global settings, element catalog, and level documents. Resolve paths relative to the manifest, allowing the game and editor to live in different directories.

The runtime must load the same JSON the editor edits; do not maintain a separate hardcoded world. Level format v2 stores tile x/y and width/height as whole world pixels, including off-grid and out-of-bounds positions. Grid X/Y and Snap are editor placement aids; never multiply v2 tile coordinates by the grid or assume tile dimensions equal grid spacing. Objects and declared positions use world pixels. Match runtime units, camera center/zoom, reference viewport, layer order and other semantics to the documented contract. Keep gameplay behavior in the runtime.

Level `width` and `height` are configurable by the human developer through the editor's Level settings. Use the loaded level dimensions for world boundaries, camera limits and any gameplay systems that depend on room size; do not hardcode the initial dimensions. Resizing changes the boundary without scaling or deleting authored content, so handle out-of-bounds content explicitly and preserve it when editing. Verify a saved dimension change is reflected correctly by the game's runtime.

Anchored level resizing translates authored content across every layer, including locked layers, to keep the chosen edge/center fixed. The camera and position properties explicitly marked `space: "world"` move with it. Mark absolute per-level/object positions as world space; use `space: "local"` for offsets, directions and vectors. Unmarked position properties remain unchanged to preserve existing catalogs. Declare unusual coordinate fields explicitly and adapt the resize operation if needed. Verify translated pixel data in the runtime; object IDs and references stay stable.

For existing v1 cell-based levels, use the explicit migration documented in editor/2D/FORMAT.md, retain backups, and update the runtime before loading converted data. Manifest/settings/catalog remain version 1; levels are version 2. Allow partial tiles and overlap at different pixel origins; array order determines drawing order. Declare integer tile placement sizes in the catalog or use the level tileSize defaults. Use a spatial index when game collision/query scale warrants it; storage in pixels does not require abandoning efficient spatial lookups.

When adding an element or level/global setting, declare editable properties in the catalog/settings: types, labels, defaults, constraints, help and appropriate controls. Prefer numbers/sliders, checkboxes, enums, colors, asset selectors, positions and object pickers over unstructured text. Add declarative overlays or documented custom controls/visualizations when useful. Preserve unknown extension fields and reject unsupported structural versions instead of converting them silently.

Give placed objects stable IDs. Validate references to objects and levels, including target types and cross-level destinations. Check that saved/exported levels reload in the editor and are consumed correctly by the game's runtime.

Provide representative artwork in catalog `visual` definitions for visible objects and tiles. Recommend a clear sprite-sheet frame and placement size, using actual runtime assets and source pixel coordinates. Set art bounds/fit explicitly when artwork and collision dimensions differ. Palette thumbnails and placed elements should resemble their runtime appearance. For invisible triggers/teleport regions, use `visual.editorOnly` and declare `collision` geometry matching the actual runtime interaction area (rectangle, ellipse, or normalized polygon). Object dimensions and collision points must agree with runtime hitboxes; do not substitute a decorative icon for the true interaction bounds. Keep dynamically derived collision sizes in sync with edited properties, extending the shared geometry contract when needed. Verify appearance, frame bounds and collisions in both editor and runtime.

Use existing editor capabilities first. Agents may adapt and upgrade the shared editor for a game's needs. Before significant changes (schema versions, major editing tools, custom control systems, or saving behavior), notify the human developer of the intended change and compatibility impact. This is a notification requirement, not an approval requirement. Routine fixes and minor additions can proceed normally. Update editor documentation and meaningful compatibility tests when extending it.

Before maintaining the shared editor, read [its maintenance guide](../editor/2D/MAINTAINING.md) for file responsibilities, independent validators, save/migration constraints, verification and deferred scope.

When using a root asset in the game, copy it into `game/assets/` or an appropriate subdirectory under `game/`; link runtime code only to the copied asset.

Use a modular file structure under `game/` and avoid placing all gameplay logic into one large file.

Keep `game/` organized with subdirectories such as `src/` or `js/` for first-party JavaScript, `styles/` or `css/` for styles, `assets/` for runtime assets, `data/` for JSON/data files, and `vendor/` or `lib/` for third-party browser libraries. The exact names can fit the game, but avoid scattering loose files in `game/` beyond entrypoint/runtime files such as `index.html`, `manifest.webmanifest`, and `sw.js`.

When a third-party browser library is needed, prefer downloading or vendoring a browser-compatible copy into `game/vendor/` or `game/lib/` so the game ships with its dependencies. Avoid relying on CDN-hosted scripts for the committed game unless the user explicitly chooses that tradeoff. Record the library name, version, source URL, and license/provenance notes in the wiki.

Include a fullscreen option in playable game builds unless the user asks otherwise.

Playable games should include an in-game settings menu by default. The settings entry point should be visible but unobtrusive, preferably a gear icon button with an accessible label/title. By default, include fullscreen and virtual gamepad controls in this menu when those features apply.

## Responsive Game Viewport

The game should be the primary page experience and should use as much of the browser viewport as is feasible. Avoid presenting the game as a small fixed-size canvas or panel centered on an otherwise empty page unless the user explicitly asks for that style.

Plan gameplay, menus, HUD, and input around multiple screen sizes, including desktop, tablet, and mobile. Fullscreen mode should use the full available screen.

Use responsive layout, resize handling, canvas scaling, CSS viewport units, safe-area insets, and input adaptation as appropriate for the game. The gameplay surface and menus must remain visible, reachable, and usable within the available viewport.

Use 16:9 as the default target aspect ratio when a fixed gameplay aspect is useful, but treat it as a default rather than a hard rule. If the game is naturally portrait, square, ultrawide, or otherwise format-specific, propose a better aspect ratio such as 9:16 and let the human developer guide the choice.

Do not squash, stretch, or crop gameplay to fill the screen. On screens that do not match the target aspect ratio, scale the game as large as possible while preserving aspect ratio, using letterboxing or pillarboxing when needed.

## Iframe Compatibility

When practical, make games friendly to iframe embedding for sites such as itch.io or a human developer's website. This is a secondary compatibility goal and must not compromise the primary goal of making the standalone game feel like a polished, native-ish full-viewport app.

Prefer sizing the game from its own root container when reasonable so it adapts inside an iframe as well as in the top-level browser window. Do not depend on parent-page scripts or cross-origin parent access.

Handle iframe limitations gracefully. Fullscreen may require iframe permissions or may be blocked by the browser. Menus, HUD, touch controls, and gameplay should remain reachable within the iframe bounds when embedded at practical sizes.

## Input And Gamepad Support

Include gamepad support by default for most games, using the browser Gamepad API and an Xbox-style controller layout as the baseline.

Choose mappings that fit the genre, but use these defaults as a starting point:

- Left stick or D-pad: movement, cursor movement, or menu navigation.
- A: confirm, jump, interact, or primary action.
- B: cancel, back, dodge, or secondary action.
- X and Y: additional actions when useful.
- Shoulder buttons and triggers: modifiers, aim, dash, inventory, weapon swap, or other genre-specific actions.
- Start/Menu: pause or open the in-game menu.

Gamepad support should usually be additive alongside keyboard, mouse, pointer, and touch controls as appropriate. Do not assume a gamepad is connected; handle connection, disconnection, and absent gamepads gracefully.

If the game is touch-first, pointer-heavy, typing-heavy, drawing-based, menu-heavy, or otherwise a poor fit for gamepad controls, ask the human developer whether and how gamepad support should work instead of forcing a weak mapping.

Document the control scheme in the wiki and expose it in the game's controls/settings UI when useful.

When gamepad-style controls make sense, include a virtual gamepad for touch devices by default. It should be enabled by default only on likely mobile/tablet touch devices, and disabled by default on desktop. Provide a settings menu toggle so the user can show or hide it.

Choose the virtual gamepad layout based on the game using common mobile conventions: movement on the left thumb area, actions on the right thumb area, and pause/settings reachable without covering critical gameplay. Virtual controls must not hide important HUD, menus, or gameplay information.

If the game is a poor fit for physical gamepad support, apply the same caution to the virtual gamepad. Ask the human developer whether and how virtual controls should work instead of forcing them.

Fullscreen should be available from the settings menu where the browser supports it. Handle unsupported or restricted fullscreen behavior gracefully, especially on mobile browsers.

## Local Preview Server

When the user asks to run, play, test, or preview the game, serve the `game/` directory with a local static server and tell the user the URL.

After meaningful game changes, an agent may also start or reuse the preview server so the user can test immediately. Do not start a new server if a suitable one is already running.

Use `.agents/runtime/preview-server.json` for local preview server state. This file is runtime metadata and should not be committed.

Before starting a server:

- Check whether `.agents/runtime/preview-server.json` exists.
- If it exists, verify that the recorded URL still responds and that it points at this repo's `game/` directory.
- If the existing server is valid, reuse it and report the URL.
- If no valid server is running, start one rooted at `game/`.

Prefer non-Node options first because this template does not assume NodeJS is installed. Python's built-in static server is a good first choice when available. If the preferred port is busy, choose another available localhost port and record it.

The runtime record should include at least:

```json
{
  "root": "game",
  "url": "http://localhost:8000/",
  "port": 8000,
  "started_at": "YYYY-MM-DDTHH:MM:SS-07:00",
  "command": "python -m http.server 8000 -d game"
}
```

Provide the user a clickable localhost URL. Only launch the default browser when the user asks for it or grants permission.

## Concurrency

This template supports multiple agent sessions working in the same repository. Use optimistic coordination for wiki and documentation work, and an exclusive lock for game-code writes.

### Activity Logs

Each agent session should keep its own activity log in `wiki/activity/`, named with a timestamp and short session label when practical, such as `2026-10-12-1330-init-game.md`.

The activity log should record:

- Session start time.
- Current task.
- Files read.
- Files planned for edit.
- Files changed.
- Short handoff notes when the session finishes or pauses.

Before starting substantial work, check recent files in `wiki/activity/` to understand active or recent edits.

### Optimistic File Checks

When editing `wiki/`, `.agents/`, README files, or other documentation, record the file's last modified timestamp when you read it. Before writing, check whether the OS last modified timestamp changed since that read. If it changed, reread the file and fold your changes into the latest version instead of overwriting from stale context.

Use the same reread-before-write habit for game files too, even when holding the game write lock.

### Game Write Lock

Before editing anything under `game/`, acquire `.agents/locks/game-write.lock` using an atomic create operation that fails if the file already exists. Do not overwrite an existing lock.

The lock should contain at least:

```json
{
  "session_id": "codex-YYYYMMDD-HHMM-short-label",
  "created_at": "YYYY-MM-DDTHH:MM:SS-07:00",
  "task": "Short description of the work",
  "files": ["game/src/main.js"]
}
```

While a game write lock exists, other agents may inspect files and update non-game documentation, but they must not edit `game/`.

If the lock exists, read it and check its age. Treat locks younger than 2 hours as active unless the user says otherwise. If the lock is older than 2 hours or appears abandoned, do not clear, replace, ignore, or bypass it automatically. Report the lock details to the user and ask for permission before clearing or overriding it.

Release the lock after completing or pausing game-code edits. If a session ends prematurely and leaves a stale lock behind, the next agent should follow the stale-lock permission rule above.
