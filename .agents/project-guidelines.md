# Agent Project Guidelines

This repository is a reusable template for AI-assisted browser game development.

Agents should treat root-level directories as having distinct ownership:

- `assets/` is the human developer's source asset inbox. Read from it, but do not mutate it.
- `game/` is where agents create and maintain the runnable browser game.
- `wiki/` is durable project memory for design, architecture, plans, decisions, and useful implementation context.
- `temp/` is ephemeral. Copy any durable insight from temp files into `wiki/` before relying on it long-term.

Prefer browser-native ES modules for the initial project so NodeJS is not required. Use NodeJS-based tooling only when the user asks for it or the game has outgrown the no-build setup.

Before making game changes, inspect the relevant wiki pages. After making durable design or architecture decisions, update the wiki.

When using a root asset in the game, copy it into `game/assets/` or an appropriate subdirectory under `game/`; link runtime code only to the copied asset.

Use a modular file structure under `game/` and avoid placing all gameplay logic into one large file.

Include a fullscreen option in playable game builds unless the user asks otherwise.
