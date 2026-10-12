# Game Dev Template

This repo is a starter workspace for AI-assisted browser game development.

The goal is to give coding agents durable project context through a local wiki while keeping the runnable game, human-provided assets, and temporary handoff files clearly separated.

## Folders

- `assets/`: source assets supplied by the human developer. Agents should read from this folder but should not modify or link to these files directly from the game.
- `game/`: the runnable browser game. Agents write HTML, CSS, JavaScript, copied runtime assets, and game data here.
- `wiki/`: durable project memory for game design, architecture, decisions, plans, asset notes, and level/data formats.
- `temp/`: ephemeral files shared with agents, such as screenshots or throwaway notes.
- `.codex/skills/init-game/`: the repo-scoped Codex skill for initializing or revising a game project.
- `.agents/`: shared agent-facing project conventions.

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
