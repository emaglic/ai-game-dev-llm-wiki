# Default Scaffold

Use this reference when the init-game workflow is creating the first wiki and starter game structure for an uninitialized project.

## Wiki Files

Create only the wiki files that are useful for the user's chosen game. For a normal first initialization, prefer this set:

- `wiki/project-brief.md`: game concept, target platform, audience, controls, and current scope.
- `wiki/game-design.md`: core loop, player actions, win/loss conditions, progression, scoring, enemies, items, levels, and feel goals.
- `wiki/architecture.md`: technology choices, folder structure, major modules, runtime assumptions, and how to run locally.
- `wiki/assets.md`: source assets from root `assets/`, runtime copies in `game/assets/`, licensing/provenance if known, and usage notes.
- `wiki/level-format.md`: JSON structure for level data when the game has levels, maps, waves, rooms, encounters, or scripted scenes.
- `wiki/decisions.md`: dated durable decisions with short rationale.
- `wiki/tasks.md`: current build tasks, open questions, and next useful work.
- `wiki/activity/`: per-session activity logs used for non-blocking coordination between agents.

Keep the initial wiki concise. Empty headings are less useful than short, honest notes about what is known and unknown.

## Coordination Files

Create `wiki/activity/` for per-session activity logs. Keep `.agents/locks/` available for coordination locks, including `.agents/locks/game-write.lock` when an agent is actively editing files under `game/`.

Keep `.agents/runtime/` available for local runtime metadata such as `.agents/runtime/preview-server.json`. Runtime metadata and active lock files should be ignored by git, while `.gitkeep` placeholders may be committed to preserve the template directories.

Do not create an active game write lock during first initialization unless the agent is about to edit game files as part of that same task. Remove the lock when game-code edits are complete.

Do not create a preview server record during first initialization unless an agent actually starts a local preview server.

## Starter Game Files

For a browser-native starter that does not require NodeJS, use ES modules:

```text
game/
|-- index.html
|-- manifest.webmanifest
|-- sw.js
|-- data/
|-- styles/
|   `-- main.css
|-- src/
|   |-- main.js
|   |-- game.js
|   |-- input.js
|   |-- ui.js
|   `-- world.js
|-- vendor/
`-- assets/
```

In `index.html`, load JavaScript with:

```html
<script type="module" src="./src/main.js"></script>
```

In module files, use relative imports:

```js
import { Game } from "./game.js";
```

Document that browser ES modules generally need a static server. Do not require NodeJS. Suggest options such as Python's built-in HTTP server, VS Code Live Server, or any equivalent static server.

Keep loose files in `game/` to a minimum. Entry files such as `index.html`, `manifest.webmanifest`, and `sw.js` may live at the root; JavaScript, styles, runtime assets, level data, and third-party libraries should live in organized subdirectories.

For a 2D game, additionally create `game/game.project.json`, `game/data/settings.json`, `game/data/elements.json`, and individual files under `game/data/levels/`, following [the shared editor contract](../editor/2D/FORMAT.md). This layout is a default, not a path requirement: the manifest resolves paths relative to itself. Load this data in the runtime and verify editor saves affect runtime behavior. Keep the reusable editor under `editor/2D/`; do not copy the verification fixture into a game without adapting it to the chosen design.

When a third-party browser library is selected, prefer downloading or vendoring a browser-compatible copy into `game/vendor/` or `game/lib/` instead of linking to a CDN. Record the library name, version, source URL, and license/provenance notes in `wiki/assets.md` or `wiki/architecture.md`.

## Responsive Viewport Defaults

Design the initial game shell so the game is the primary page experience and uses as much of the available browser viewport as feasible.

Use 16:9 as the default target aspect ratio when a fixed gameplay aspect is helpful. Preserve aspect ratio when scaling, and use letterboxing or pillarboxing on mismatched screens instead of stretching or cropping.

Menus, HUD, buttons, and gameplay-critical UI should remain visible, reachable, and usable on desktop, tablet, and mobile. If the user's game concept suggests a portrait, square, ultrawide, or otherwise specialized format, propose that aspect ratio and let the user guide the choice.

## Iframe Compatibility

When practical, design the game shell so it can also run inside an iframe. This is a nice-to-have compatibility goal and should not make the standalone game feel less like a polished full-viewport app.

Prefer sizing from the game's own root container instead of assuming top-level page dimensions. Avoid relying on parent-page scripts or cross-origin parent access. Handle fullscreen restrictions gracefully when embedded.

## Input Defaults

For most games, include a browser Gamepad API input path in addition to keyboard, mouse, pointer, or touch controls as appropriate.

Use an Xbox-style controller as the default layout model. Typical defaults are left stick or D-pad for movement/navigation, A for confirm/jump/interact/primary action, B for cancel/back/secondary action, X/Y for extra actions, shoulder buttons/triggers for modifiers or genre-specific actions, and Start/Menu for pause.

If the game concept is a poor fit for gamepad controls, ask the human developer whether and how gamepad support should work before adding it.

Document the chosen control scheme in the wiki and, when useful, in the game's controls/settings UI.

When gamepad-style controls make sense, include a virtual gamepad for touch devices. It should be enabled by default only on likely mobile/tablet touch devices, disabled by default on desktop, and controlled by a settings menu toggle.

Use common mobile game conventions for the default virtual layout: movement on the left thumb area, action buttons on the right thumb area, and pause/settings reachable without covering important gameplay or HUD information.

## Settings Menu Defaults

Playable starters should include an in-game settings menu by default. Prefer a small gear icon button with an accessible label/title.

Include fullscreen and virtual gamepad controls by default when applicable. Fullscreen should degrade gracefully when the browser does not support it or restricts it.

## Preview Server

When asked to run, play, test, or preview the game, agents should serve `game/` locally and report the URL. They should reuse an existing valid preview server recorded in `.agents/runtime/preview-server.json` instead of opening a new port on each run.

If no valid server is running, start one rooted at `game/`, preferring Python or another non-Node static server when available. Record the root, URL, port, start time, and command in `.agents/runtime/preview-server.json`.

## PWA Defaults

Include a minimal PWA scaffold when it is useful and low-risk:

- `manifest.webmanifest` with the game name, display mode, theme colors, and icons if available.
- `sw.js` for basic offline caching only after there are stable assets to cache.
- A note in `wiki/architecture.md` explaining the current PWA status.

Do not overbuild service worker caching during the first pass if the game structure is still likely to change.

## Reinitialization Behavior

If the user runs `/init-game` again after initialization:

- Do not overwrite wiki pages or game files.
- Summarize existing pages and major game files.
- Ask what they want to change.
- Apply targeted edits only after the user names the desired change or confirms a proposed change.

