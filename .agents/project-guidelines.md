# Agent Project Guidelines

This repository is a reusable template for AI-assisted browser game development.

This is the canonical shared instruction file for agents. Provider-specific entry files such as `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` should point here instead of duplicating these rules.

Provider-neutral workflows live in `.agent-workflows/`. Treat workflow names such as `/init-game` as plain-text triggers outside providers that natively support them. Do not create provider-specific commands, skills, memory files, or workflow systems unless the user explicitly asks for that provider integration.

Agents should treat root-level directories as having distinct ownership:

- `assets/` is the human developer's source asset inbox. Read from it, but do not mutate it.
- `game/` is where agents create and maintain the runnable browser game.
- `wiki/` is durable project memory for design, architecture, plans, decisions, and useful implementation context.
- `temp/` is ephemeral. Copy any durable insight from temp files into `wiki/` before relying on it long-term.

Prefer browser-native ES modules for the initial project so NodeJS is not required. Use NodeJS-based tooling only when the user asks for it or the game has outgrown the no-build setup.

Before making game changes, inspect the relevant wiki pages. After making durable design or architecture decisions, update the wiki.

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
