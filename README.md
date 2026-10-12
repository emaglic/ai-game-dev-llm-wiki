# Game Dev Template

This repo is a starter workspace for AI-assisted browser game development.

The goal is to give coding agents durable project context through a local wiki while keeping the runnable game, human-provided assets, and temporary handoff files clearly separated.

## Folders

- `assets/`: source assets supplied by the human developer. Agents should read from this folder but should not modify or link to these files directly from the game.
- `game/`: the runnable browser game. Agents write HTML, CSS, JavaScript, copied runtime assets, and game data here.
- `wiki/`: durable project memory for game design, architecture, decisions, plans, asset notes, and level/data formats.
- `wiki/activity/`: per-session agent activity logs for non-blocking coordination.
- `temp/`: ephemeral files shared with agents, such as screenshots or throwaway notes.
- `.codex/skills/init-game/`: the repo-scoped Codex skill for initializing or revising a game project.
- `.agents/`: shared agent-facing project conventions.
- `.agents/locks/`: coordination locks for agent work, including game-code write locks.
- `.agents/runtime/`: ignored runtime state, such as the current local preview server.

## Initializing A Game

Use `/init-game` or `$init-game` with Codex to start a new game in this template.

On first use, the skill should ask about the game concept, target style, controls, visuals, and any assets to consider. It can then scaffold concise wiki pages and starter files under `game/`.

If `/init-game` is run again after the project has already been initialized, the skill should not overwrite the existing wiki or game scaffold. It should summarize what exists and ask what you want to change.

## Browser-First Development

This template does not require NodeJS by default.

Initial games should prefer browser-native ES modules:

```html
<script type="module" src="./src/main.js"></script>
```

JavaScript modules can import each other with relative paths:

```js
import { Game } from "./game.js";
```

Because browser modules usually need to be served over HTTP, run the game with any simple static server. NodeJS is optional. Python's built-in server, VS Code Live Server, or another static server is enough for the no-build starting point.

NodeJS may become useful later for bundling, TypeScript, asset pipelines, or packaging the game as a desktop executable with Electron.

## Game File Organization

Game files should be organized into directories under `game/` rather than scattered as loose files. The exact structure can fit the game, but common directories include:

- `src/` or `js/` for first-party JavaScript.
- `styles/` or `css/` for stylesheets.
- `assets/` for runtime asset copies.
- `data/` for levels and other JSON/data files.
- `vendor/` or `lib/` for third-party browser libraries.

Root-level files such as `index.html`, `manifest.webmanifest`, and `sw.js` are fine when needed.

When a third-party library like Three.js, PixiJS, or a physics engine is used, agents should prefer downloading or vendoring a browser-compatible copy into `game/vendor/` or `game/lib/` so the game ships with its dependencies. CDN links should only be used when you explicitly choose that tradeoff.

## Running The Game

You can ask Codex to run, play, or preview the game. Agents should serve the `game/` directory with a local static server and give you the localhost URL.

Agents should reuse an existing preview server when one is already running instead of starting a new server every time. Runtime server state belongs in `.agents/runtime/preview-server.json`, which is ignored by git.

The default preference is a non-Node static server, such as Python's built-in HTTP server, because NodeJS is not required by this template.


## Concurrent Agent Sessions

This template supports multiple agent sessions working in the same repository.

For wiki and documentation work, agents use optimistic coordination: they keep per-session logs in `wiki/activity/`, check recent activity before starting, and reread files before writing if the OS last modified timestamp changed since they last read them.

For game-code work, agents use a stronger lock: `.agents/locks/game-write.lock`. If that lock exists, another agent should not edit `game/`. If the lock looks stale, the agent should report its age and contents, then ask before clearing or overriding it.

## Asset Flow

Human-supplied assets begin in root `assets/`.

When an agent uses an asset, it should copy that file into `game/assets/` or a suitable subfolder under `game/`, then reference the copied file from game code.

This keeps the original source assets separate from the game's runtime assets.

## Wiki Expectations

The wiki should stay concise and durable. Good wiki material includes:

- Game concept and scope.
- Core mechanics and controls.
- Architecture and file responsibilities.
- Asset usage notes.
- Level or data formats.
- Durable decisions and rationale.
- Current tasks and open questions.

Temporary debugging notes, raw command output, and one-off observations should not be added unless they become useful project knowledge.
