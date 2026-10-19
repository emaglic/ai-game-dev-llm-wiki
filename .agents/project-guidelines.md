# Agent Project Guidelines

This repository is a reusable template for AI-assisted browser game development.

This is the canonical shared instruction file for agents. Provider-specific entry files such as `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` should point here instead of duplicating these rules.

Provider-neutral workflows live in `.agent-workflows/`. Treat workflow names such as `/init-game` as plain-text triggers outside providers that natively support them. Do not create provider-specific commands, skills, memory files, or workflow systems unless the user explicitly asks for that provider integration.

For migrating an existing game/wiki to an updated template, follow [`.agent-workflows/migrate-game.md`](../.agent-workflows/migrate-game.md), rather than initialization. Establish preparation with the developer, inspect compatibility and preserve the existing wiki. Codex provides the repo-scoped adapter at [`.codex/skills/migrate-game/SKILL.md`](../.codex/skills/migrate-game/SKILL.md).

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

The runtime must load the same JSON the editor edits; do not maintain a separate hardcoded world. Level format v2 stores tile x/y and width/height as whole world pixels, including off-grid and out-of-bounds positions. Grid X/Y and Snap are editor placement aids; never multiply v2 tile coordinates by the grid or assume tile dimensions equal grid spacing. Objects and declared positions use world pixels. Match runtime units, camera center/zoom, reference viewport, layer order and other semantics to the documented contract. Keep gameplay behavior in the runtime. Camera viewport handles edit the existing camera center/zoom and preserve the reference viewport aspect ratio; runtimes must honor saved zoom and declared defaults, rather than assuming a fixed camera rectangle. Layer renaming changes display names only: identify layers by stable IDs/kind, never user-editable names. Grid appearance/linking and workspace panels are local editor preferences and need no game integration.

Honor layer order for the actual game, including live players/entities spawned from authored objects: render layers in array order (back-to-front), and render each entity at its owning object layer's position, not in a final pass above all tiles. The panel's topmost layer is frontmost. Verify a foreground tile layer above the player's layer visibly occludes the player; moving it below should put it behind the player. Rendering order is independent of collision behavior.

Background layers are a separate non-colliding type requiring level v3; existing pixel v2 levels remain supported. Implement the exact Background transform, inverse picking, scale/flip/repeat/clipping and anchored-resize rules in editor/2D/FORMAT.md. Background/foreground is determined only by array order, including occlusion of the live player. Parallax uses camera viewport top-left, not editor navigation. Keep game catalog v1 unchanged; Background image/color records are built-in authoring types. Before enabling Background layers in an existing game, upgrade its runtime for v3 and verify the same camera composition in editor and game. The explicit migration tool supports --target-version 3 with backups and adds no background content automatically.

Tile layers expose a `Solid` checkbox backed by optional boolean `solid`. Skip movement-blocking tile collisions when `layer.solid === false`; true or missing retains normal per-tile collision rules, including existing non-solid scenery types. Do not treat every tile as collidable merely because its layer is solid. Object behavior remains game-defined. Honor this in collision generation/queries and refresh collision caches when levels reload. Verify saved Solid changes in the actual game; editor visuals alone cannot establish correctness. See the migration workflow for adapting older collision implementations.

Level `width` and `height` are configurable by the human developer through the editor's Level settings. Use the loaded level dimensions for world boundaries, camera limits and any gameplay systems that depend on room size; do not hardcode the initial dimensions. Resizing changes the boundary without scaling or deleting authored content, so handle out-of-bounds content explicitly and preserve it when editing. Verify a saved dimension change is reflected correctly by the game's runtime.

Anchored level resizing translates authored content across every layer, including locked layers, to keep the chosen edge/center fixed. The camera and position properties explicitly marked `space: "world"` move with it. Mark absolute per-level/object positions as world space; use `space: "local"` for offsets, directions and vectors. Unmarked position properties remain unchanged to preserve existing catalogs. Declare unusual coordinate fields explicitly and adapt the resize operation if needed. Verify translated pixel data in the runtime; object IDs and references stay stable.

For existing v1 cell-based levels, use the explicit migration documented in editor/2D/FORMAT.md, retain backups, and update the runtime before loading converted data. Manifest/settings/catalog remain version 1; levels are version 2. Allow partial tiles and overlap at different pixel origins; array order determines drawing order. Declare integer tile placement sizes in the catalog or use the level tileSize defaults. Use a spatial index when game collision/query scale warrants it; storage in pixels does not require abandoning efficient spatial lookups.

When adding an element or level/global setting, declare editable properties in the catalog/settings: types, labels, defaults, constraints, help and appropriate controls. Prefer numbers/sliders, checkboxes, enums, colors, asset selectors, positions and object pickers over unstructured text. Add declarative overlays or documented custom controls/visualizations when useful. Preserve unknown extension fields and reject unsupported structural versions instead of converting them silently.

Give placed objects stable IDs. Validate references to objects and levels, including target types and cross-level destinations. Check that saved/exported levels reload in the editor and are consumed correctly by the game's runtime.

Provide representative artwork in catalog `visual` definitions for visible objects and tiles. Recommend a clear sprite-sheet frame and placement size, using actual runtime assets and source pixel coordinates. Set art bounds/fit explicitly when artwork and collision dimensions differ. Palette thumbnails and placed elements should resemble their runtime appearance. For invisible triggers/teleport regions, use `visual.editorOnly` and declare `collision` geometry matching the actual runtime interaction area (rectangle, ellipse, or normalized polygon). Object dimensions and collision points must agree with runtime hitboxes; do not substitute a decorative icon for the true interaction bounds. Keep dynamically derived collision sizes in sync with edited properties, extending the shared geometry contract when needed. Verify appearance, frame bounds and collisions in both editor and runtime.

Use existing editor capabilities first. Agents may adapt and upgrade the shared editor for a game's needs. Before significant changes (schema versions, major editing tools, custom control systems, or saving behavior), notify the human developer of the intended change and compatibility impact. This is a notification requirement, not an approval requirement. Routine fixes and minor additions can proceed normally. Update editor documentation and meaningful compatibility tests when extending it.

Before maintaining the shared editor, including game-specific extensions in a cloned template, read [its maintenance guide](../editor/2D/MAINTAINING.md) for UI conventions, file responsibilities, interaction invariants, validators and verification. Follow its [Editor UI conventions](../editor/2D/MAINTAINING.md#editor-ui-conventions) by default. Explicit human developer instructions may override design conventions for the task/project; do not infer an approval requirement for intentional exceptions.

When using a root asset in the game, copy it into `game/assets/` or an appropriate subdirectory under `game/`; link runtime code only to the copied asset.

Use a modular file structure under `game/` and avoid placing all gameplay logic into one large file.

Keep `game/` organized with subdirectories such as `src/` or `js/` for first-party JavaScript, `styles/` or `css/` for styles, `assets/` for runtime assets, `data/` for JSON/data files, and `vendor/` or `lib/` for third-party browser libraries. The exact names can fit the game, but avoid scattering loose files in `game/` beyond entrypoint/runtime files such as `index.html`, `manifest.webmanifest`, and `sw.js`.

When a third-party browser library is needed, prefer downloading or vendoring a browser-compatible copy into `game/vendor/` or `game/lib/` so the game ships with its dependencies. Avoid relying on CDN-hosted scripts for the committed game unless the user explicitly chooses that tradeoff. Record the library name, version, source URL, and license/provenance notes in the wiki.

Include a fullscreen option in playable game builds unless the user asks otherwise.

Playable games should include an in-game settings menu by default. The settings entry point should be visible but unobtrusive, preferably a gear icon button with an accessible label/title. By default, include fullscreen and virtual gamepad controls in this menu when those features apply.

## Console-Style Menus And Icons

Design game UI to feel like a console game. Keep menus within the available viewport; prefer tabs, pages, categories, and submenus over long scrolling lists. Preserve readability and access on small screens and with larger text rather than shrinking controls to force a fit. Where scrolling is necessary, keep it contained and navigable with the supported inputs.

For games that support gamepads, make the entire experience usable with only a controller: main menus, settings, dialogs, pause screens, lobbies, gameplay, and results/retry flows. Provide visible focus, predictable navigation, consistent confirm/back actions, and a way to reach every applicable control without mouse hover, pointer clicks, or keyboard input. Restore sensible focus when opening/closing menus or switching tabs. Verify complete controller-only flows, not just movement during gameplay.

Include a suitable icon library by default, such as Google's Material Icons, so menus and HUD controls can use consistent icons. Download and ship the required icons/fonts/styles locally under `game/`, including their license; avoid third-party CDN dependencies or stylesheets that fetch remote fonts. Use an appropriate subset when practical. Record version, source, and license/provenance in the initialized game's wiki.

Choose icon-only, text-only, or icon-plus-text controls using UI/UX judgment and the human developer's direction. Use recognizable icons, give icon-only controls accessible names, and make their meaning discoverable with supported inputs rather than relying only on mouse-hover tooltips.

## Asset Loading And Lifetime

Plan asset loading and preloading from the start. Consider download size, decoding/upload time, memory, and transitions; preload assets needed for the initial screen and imminent gameplay rather than automatically loading the entire game up front.

When useful, show a brief loading screen or transition while preparing the next stage's assets. Show honest progress or an activity indicator, handle failures with useful feedback and recovery, and begin play only once required assets are ready. Release assets from previous stages when no longer needed, retaining shared or soon-needed resources and respecting engine/library ownership so active assets are not disposed accidentally.

Choose the strategy for the game's scale: small games may need only a simple initial load and no separate loading screen. Avoid artificial delays. Verify stage transitions, restarts, and load failures as applicable, and watch for repeated asset loads or growing memory usage.

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

If the game concept is genuinely a poor fit for gamepads, such as a typing or drawing game, gamepad support may be skipped in favor of keyboard/mouse or direct touch as appropriate. Follow the human developer's direction and ask only when suitability is unclear. Being menu-heavy or touch-first alone does not make a game unsuitable for gamepads.

Document the control scheme in the wiki and expose it in the game's controls/settings UI when useful.

When gamepad-style controls make sense, include a virtual gamepad for touch devices by default. It should be enabled by default only on likely mobile/tablet touch devices, and disabled by default on desktop. Provide a settings menu toggle so the user can show or hide it.

Use a physical gamepad layout as the strong starting recommendation for virtual controls: movement in the left thumb area, preferably a virtual analog stick when it fits, and circular action buttons in the right thumb area, arranged in an SNES/Xbox-style diamond when the action count warrants it. Use a D-pad or fewer buttons when better suited to the game; do not add unused controls just to reproduce a controller. Adapt spacing, size, and placement for comfortable touch use and simultaneous movement/actions. Keep pause/settings reachable and avoid covering important HUD, menus, or gameplay information. This is a starting point for developer refinement, not a rigid layout rule.

If the game is a poor fit for physical gamepad support, virtual gamepad controls may also be skipped in favor of suitable direct touch or other input. Ask the human developer only when the appropriate approach is unclear.

Fullscreen should be available from the settings menu where the browser supports it. Handle unsupported or restricted fullscreen behavior gracefully, especially on mobile browsers.

## Local Multiplayer And Controller Ownership

For multiple players on the same device, support multiple physical gamepads when gamepad controls fit the game, so each player can use their own controller. Track controller-to-player assignments explicitly rather than sending every controller to Player 1. Handle joining, leaving, disconnection, and reconnection gracefully; preserve other players' assignments and choices and make reassignment understandable.

Assign a Player 1 to navigate main/shared menus and shared options, including starting the match. Each player controls their own choices, such as character, team, and ready status, using their assigned gamepad. Player 1 controls both their own choices and the shared menu options. Keep player-specific focus and input separate so one player's navigation does not change another player's selection. Make ownership and focus clear and avoid a single press activating both a personal choice and a shared action. Provide a clear recovery or reassignment flow if Player 1 leaves or disconnects.

Use a lobby as the usual starting point for local multiplayer games. Let players join/leave and complete the choices the game requires, such as character, team, loadout, or ready status, before starting. Display player slots, controller assignments, selections, and readiness clearly; keep shared controls with Player 1 while allowing independent player choices. A lobby is a recommendation, not a requirement for games that work better with immediate play or another joining flow.

Verify with multiple controllers where available: independent joining and selections, Player 1's access to both personal and shared controls, match start, and leave/disconnect/reconnect recovery. State any hardware verification limitations.

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

### Saved Editor Changes During Active Work

The human developer may save level, settings or catalog edits while an agent is working. These edits are project files on disk; unsaved browser edits are not visible to the agent. Check for relevant saved changes at sensible task checkpoints, not through continuous polling or background monitoring:

- At task start, inspect current project data and the working-tree state.
- Before writing related data or runtime code, check whether the manifest, referenced levels, settings or catalog changed since you last read them.
- Between meaningful stages of longer tasks, and before testing or finishing, recheck data that can affect the implementation or verification.

Use Git diffs where available, supplemented by file timestamps or content comparisons against the state observed at task start/last read. Git alone may not expose changes to ignored or untracked project files; follow the actual manifest paths. If a file changed, reread it and incorporate the latest authored data before proceeding. Avoid repeatedly reporting unchanged or unrelated files.

Preserve human edits to content, positions, dimensions, properties, references and layers, including deletions. Do not restore an earlier snapshot merely because it matches your assumptions, and do not attribute every working-tree change to the developer when another agent or your own work may explain it. Reassess affected runtime dependencies and tests. Resolve straightforward integration changes within the task's scope; ask when competing edits or a gameplay decision cannot be reconciled safely. These checks supplement the game write lock and reread-before-write rules; they do not bypass them or authorize overwriting concurrent edits.

Editor revision checks protect against stale editor saves, but do not replace agent-side checks before writing files. This guidance applies during active work; it promises no notifications or checks while the agent is idle.

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
