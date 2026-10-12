# Default Scaffold

Use this reference when `init-game` is creating the first wiki and starter game structure for an uninitialized project.

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

Do not create an active game write lock during first initialization unless the agent is about to edit game files as part of that same task. Remove the lock when game-code edits are complete.

## Starter Game Files

For a browser-native starter that does not require NodeJS, use ES modules:

```text
game/
|-- index.html
|-- manifest.webmanifest
|-- sw.js
|-- styles/
|   `-- main.css
|-- src/
|   |-- main.js
|   |-- game.js
|   |-- input.js
|   |-- ui.js
|   `-- world.js
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
