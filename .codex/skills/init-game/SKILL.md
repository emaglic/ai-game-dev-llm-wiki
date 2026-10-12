---
name: init-game
description: Initialize or revise this repo's browser-game wiki, starter game scaffold, and agent workflow when the user asks to start or reconfigure a game project.
---

# Init Game

Use this skill when the user invokes `/init-game`, `$init-game`, or asks to initialize, reinitialize, or revise the game project scaffold for this repository.

This repository is a template for AI-assisted browser game development. Its default contract is:

- `assets/`: human-provided source assets. Do not modify these files.
- `game/`: agent-authored runnable game files.
- `game/assets/`: runtime copies of any assets selected from root `assets/`.
- `wiki/`: durable project memory for design, architecture, decisions, plans, and implementation notes.
- `temp/`: ephemeral handoff files. Do not link to these from durable wiki pages unless the useful information has been copied into `wiki/`.
- `.agents/`: shared agent-facing conventions for this template.

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
- Target input style, such as keyboard, mouse, touch, gamepad, or mixed.
- Visual direction, if known.
- Any supplied assets the user wants considered.

Then scaffold the wiki and starter files using [references/default-scaffold.md](references/default-scaffold.md).

Use plain browser-native ES modules by default. Do not require NodeJS, Vite, npm, or a bundler for the initial project. If modular JavaScript is used, load it from HTML with `type="module"` and note that the game should be served from a static local server rather than opened with `file://`.

Use third-party libraries when they materially help the game:

- Prefer Three.js for 3D browser games.
- Prefer PixiJS or a similar rendering library for substantial 2D canvas games.
- Prefer a proven physics library when gameplay needs nontrivial physics.

If the chosen library requires package tooling, explain the tradeoff before adding that dependency. Otherwise prefer CDN or checked-in browser-compatible files for the initial scaffold.

## Wiki Maintenance

During initialization and later project work, update the wiki only for durable context:

- Game design decisions.
- Architecture and file responsibilities.
- Asset usage and provenance.
- Level/data formats.
- Known constraints and open questions.
- Meaningful implementation decisions.

Do not dump transient debugging notes, command output, or temporary file paths into the wiki.

## Game Scaffold Preferences

Prefer a scalable file layout under `game/` instead of a single large HTML file. A typical browser-native starter might include:

- `game/index.html`
- `game/styles/main.css`
- `game/src/main.js`
- `game/src/game.js`
- `game/src/input.js`
- `game/src/world.js`
- `game/src/ui.js`
- `game/assets/`

Adjust the structure to match the actual game. Add a fullscreen control by default unless there is a strong reason not to.

Design level-based games around JSON level data when reasonable so a future level editor can import and export the same format.
