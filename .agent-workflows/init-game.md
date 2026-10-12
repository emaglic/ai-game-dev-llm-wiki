# Init Game Workflow

Use this workflow when the user types `/init-game`, `init-game`, `$init-game`, or asks to initialize, reinitialize, or revise the game project scaffold.

This workflow is provider-neutral. Outside Codex, `/init-game` is a plain-text workflow trigger, not a native command or skill. Do not create provider-specific commands, skills, memory files, or workflow systems unless the user explicitly asks for that provider integration.

This repository is a template for AI-assisted browser game development. Its default contract is:

- `assets/`: human-provided source assets. Do not modify these files.
- `game/`: agent-authored runnable game files.
- `game/assets/`: runtime copies of any assets selected from root `assets/`.
- `wiki/`: durable project memory for design, architecture, decisions, plans, and implementation notes.
- `temp/`: ephemeral handoff files. Do not link to these from durable wiki pages unless the useful information has been copied into `wiki/`.
- `wiki/activity/`: per-session activity logs for non-blocking coordination between agents.
- `.agents/`: shared agent-facing conventions for this template.
- `.agents/locks/`: coordination locks, including the game write lock.
- `.agents/runtime/`: ignored runtime state, including local preview server metadata.

## Concurrency Protocol

Use optimistic coordination for wiki and documentation work, and an exclusive lock for game-code writes.

- Before substantial work, check recent session logs in `wiki/activity/`.
- Keep a per-session activity log in `wiki/activity/` noting the task, files read, files planned for edit, files changed, and handoff notes.
- When editing wiki or documentation files, record each file's OS last modified timestamp when read. Before writing, check whether it changed. If it changed, reread and merge your changes into the latest version.
- Before editing anything under `game/`, acquire `.agents/locks/game-write.lock` using an atomic create operation that fails if the file already exists. Do not overwrite an existing lock.
- While the game write lock exists, other agents may inspect `game/` but must not edit files under it.
- If the game write lock exists, read it and check its age. Treat locks younger than 2 hours as active unless the user says otherwise.
- If the lock is older than 2 hours or appears abandoned, report the lock details and ask the user for permission before clearing, replacing, bypassing, or editing under `game/`.
- Release the game write lock after completing or pausing game-code edits.
- Even while holding the lock, reread any game file whose OS last modified timestamp changed since you last read it.

## Local Preview Server

When the user asks to run, play, test, or preview the game, serve the `game/` directory with a local static server and tell the user the localhost URL. After meaningful game changes, start or reuse a preview server when useful so the user can test the latest build.

Do not start a new server if a suitable preview server is already running. Check `.agents/runtime/preview-server.json` first. If it exists, verify that the recorded URL still responds and points at this repo's `game/` directory. Reuse a valid server and report its URL.

If no valid preview server is running, start one rooted at `game/`. Prefer a non-Node static server, such as Python's built-in HTTP server, because this template does not require NodeJS. If the preferred port is busy, choose another available localhost port and record it.

Write runtime server state to `.agents/runtime/preview-server.json`; this file is ignored by git. Include the root, URL, port, start time, and command. Provide a clickable localhost URL to the user. Only launch the default browser when the user asks for it or grants permission.

## Repeated Invocation Guard

Before scaffolding anything, inspect the existing project state. Treat the project as already initialized if any of these are true:

- `wiki/project-brief.md` exists.
- `wiki/game-design.md` exists.
- `wiki/architecture.md` exists.
- `game/index.html` exists.
- The `wiki/` or `game/` directory contains meaningful existing files.

If the project is already initialized, do not recreate or overwrite the scaffold. Instead:

1. Briefly summarize what already exists.
2. Ask the user one concise question about what they want to change about the project structure, game concept, wiki, or starter implementation.
3. Preserve existing files and work with them unless the user explicitly asks for a specific replacement.

Only perform a fresh scaffold when the project is clearly uninitialized or the user explicitly confirms that they want to reset or replace specific files.

## First-Time Initialization

When the project is uninitialized, ask for the minimum information needed to start:

- Game concept or genre.
- 2D, 3D, or undecided.
- Target input style, such as keyboard, mouse, touch, gamepad, or mixed. Assume gamepad support by default for most games unless the concept clearly does not fit it.
- Visual direction, if known.
- Any supplied assets the user wants considered.

Then scaffold the wiki and starter files using [default-scaffold.md](default-scaffold.md).

Use plain browser-native ES modules by default. Do not require NodeJS, Vite, npm, or a bundler for the initial project. If modular JavaScript is used, load it from HTML with `type="module"` and note that the game should be served from a static local server rather than opened with `file://`.

Use third-party libraries when they materially help the game:

- Prefer Three.js for 3D browser games.
- Prefer PixiJS or a similar rendering library for substantial 2D canvas games.
- Prefer a proven physics library when gameplay needs nontrivial physics.

When a third-party browser library is used, prefer downloading or vendoring a browser-compatible copy into `game/vendor/` or `game/lib/` so the game ships with its dependencies. Avoid relying on CDN-hosted scripts for the committed game unless the user explicitly chooses that tradeoff. Record the library name, version, source URL, and license/provenance notes in the wiki.

If the chosen library requires package tooling, explain the tradeoff before adding that dependency. Prefer checked-in browser-compatible library files for the initial scaffold when licensing permits.

## Wiki Maintenance

During initialization and later project work, update the wiki only for durable context:

- Game design decisions.
- Architecture and file responsibilities.
- Asset usage and provenance.
- Level/data formats.
- Known constraints and open questions.
- Meaningful implementation decisions.

Do not dump transient debugging notes, command output, or temporary file paths into the wiki.

## Responsive Game Viewport

The game should be the primary page experience and should use as much of the browser viewport as is feasible. Avoid creating a small fixed-size canvas or game panel centered on an otherwise empty page unless the user explicitly asks for that style.

Plan gameplay, menus, HUD, and input for desktop, tablet, and mobile. Fullscreen mode should use the full available screen.

Use 16:9 as the default target aspect ratio when a fixed gameplay aspect is useful, but do not treat it as mandatory. If the game is naturally portrait, square, ultrawide, or otherwise format-specific, propose a more suitable aspect ratio such as 9:16 and let the human developer guide the choice.

Do not squash, stretch, or crop gameplay to fill the screen. Scale the game as large as possible while preserving aspect ratio, using letterboxing or pillarboxing when the viewport does not match the target ratio.

Menus, HUD, buttons, and gameplay-critical UI must remain visible, reachable, and usable within the available viewport.

## Iframe Compatibility

When practical, make games friendly to iframe embedding for sites such as itch.io or a human developer's website. Treat this as a secondary compatibility goal, not something that should weaken the primary native-ish full-viewport game experience.

Prefer sizing the game from its own root container when reasonable so it adapts inside an iframe as well as in the top-level browser window. Do not depend on parent-page scripts or cross-origin parent access.

Handle iframe limitations gracefully. Fullscreen may require iframe permissions or may be blocked by the browser. Menus, HUD, touch controls, and gameplay should remain reachable within the iframe bounds when embedded at practical sizes.

## Input And Gamepad Support

Include gamepad support by default for most games, using the browser Gamepad API and an Xbox-style controller layout as the baseline.

Choose mappings that fit the game, but use these defaults as a starting point:

- Left stick or D-pad: movement, cursor movement, or menu navigation.
- A: confirm, jump, interact, or primary action.
- B: cancel, back, dodge, or secondary action.
- X and Y: additional actions when useful.
- Shoulder buttons and triggers: modifiers, aim, dash, inventory, weapon swap, or other genre-specific actions.
- Start/Menu: pause or open the in-game menu.

Gamepad support should usually be additive alongside keyboard, mouse, pointer, and touch controls as appropriate. Do not assume a gamepad is connected; handle connection, disconnection, and absent gamepads gracefully.

If the game is touch-first, pointer-heavy, typing-heavy, drawing-based, menu-heavy, or otherwise a poor fit for gamepad controls, ask the human developer whether and how gamepad support should work instead of forcing a weak mapping.

Document the control scheme in the wiki and expose it in the game's controls/settings UI when useful.

When gamepad-style controls make sense, include a virtual gamepad for touch devices by default. Enable it by default only on likely mobile/tablet touch devices, and disable it by default on desktop. Provide a settings menu toggle so the user can show or hide it.

Choose the virtual gamepad layout based on the game using common mobile conventions: movement on the left thumb area, actions on the right thumb area, and pause/settings reachable without covering critical gameplay. Virtual controls must not hide important HUD, menus, or gameplay information.

If the game is a poor fit for physical gamepad support, apply the same caution to the virtual gamepad. Ask the human developer whether and how virtual controls should work instead of forcing them.

## Settings Menu

Playable games should include an in-game settings menu by default. The settings entry point should be visible but unobtrusive, preferably a gear icon button with an accessible label/title.

The default settings menu should include:

- Fullscreen toggle/action where the browser supports it.
- Virtual gamepad toggle when virtual controls are applicable.

Handle unsupported or restricted fullscreen behavior gracefully, especially on mobile browsers.

## Game Scaffold Preferences

Prefer a scalable file layout under `game/` instead of a single large HTML file. A typical browser-native starter might include:

- `game/index.html`
- `game/manifest.webmanifest`
- `game/sw.js`
- `game/styles/main.css`
- `game/src/main.js`
- `game/src/game.js`
- `game/src/input.js`
- `game/src/world.js`
- `game/src/ui.js`
- `game/assets/`
- `game/data/`
- `game/vendor/`

Adjust the structure to match the actual game. Keep loose files in `game/` to a minimum; entrypoint/runtime files such as `index.html`, `manifest.webmanifest`, and `sw.js` are fine, but JavaScript, CSS, assets, data, and vendored libraries should live in organized subdirectories.

Add a fullscreen control by default unless there is a strong reason not to.

Design level-based games around JSON level data when reasonable so a future level editor can import and export the same format.

