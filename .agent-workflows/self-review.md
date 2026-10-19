# Self Review Workflow

Use this workflow when the user types `/self-review`, `self-review`, `$self-review`, asks for a project/game review, or accepts an agent's recommendation to run a review.

This workflow is provider-neutral. Outside Codex, `/self-review` is a plain-text workflow trigger, not a native command or skill. Do not create provider-specific commands, skills, memory files, or workflow systems unless the user explicitly asks for that provider integration.

## When To Recommend

After meaningful feature work, refactors, visual/input changes, game scaffold changes, dependency changes, or before the human developer commits, recommend running `/self-review`.

Before running it, ask the human developer whether they want the review. In 1-2 sentences, explain that the review checks whether the implementation matches the request, looks for code or behavior risks, and verifies the project's native-ish browser game standards. In 1-2 sentences, explain why it is being recommended at that moment.

Do not run the review automatically unless the user has already asked for it or has explicitly agreed to the recommendation.

## Review Method

Prefer an independent review pass. In Codex, use a sub-agent when available and appropriate. In other providers, perform a distinct review pass with a code-review mindset.

Review the actual files and current project state. Do not rely only on the previous agent's summary.

Check relevant wiki pages, shared agent guidelines, and the user request. Inspect the game files, dependency usage, and any changed documentation.

If running tests, linters, or a local preview is useful and available, do so. If you cannot run them, state that clearly.

## Review Checklist

Evaluate whether the work:

- Satisfies the human developer's request.
- Avoids obvious bugs, regressions, broken imports, missing files, stale assumptions, or dead UI.
- Keeps `game/` organized into appropriate subdirectories.
- Vendors third-party browser libraries into `game/vendor/` or `game/lib/` when applicable, instead of depending on CDN-hosted scripts unless explicitly chosen.
- Preserves the full-viewport, native-ish game/app feel.
- Scales responsively across desktop, tablet, and mobile.
- Preserves aspect ratio without squashing, stretching, or cropping gameplay.
- Keeps gameplay, menus, HUD, settings, and controls visible, reachable, and usable.
- Includes a settings menu by default for playable games.
- Provides fullscreen behavior where supported and handles limitations gracefully.
- Keeps menus within the viewport using tabs/pages/submenus instead of long scrolling lists where practical, while preserving readability and access at small sizes or larger text.
- Ships a suitable icon library locally with its license, without remote font/style dependencies, and uses icons/text appropriately with accessible names for icon-only controls.
- Plans asset preloading and lifetime to suit the game's scale: required assets ready before use, useful loading feedback/recovery, stage-aware loading and safe release of unused resources without artificial delays.
- Includes physical gamepad support by default when the game concept fits it.
- Makes the full game and every menu/dialog usable with only a gamepad, with visible focus and consistent confirm/back behavior.
- Supports multiple gamepads for local multiplayer when applicable, with explicit player assignments and joining/leaving/disconnection recovery.
- Gives Player 1 access to shared menus and personal choices while other players independently control their own choices, with clear per-player focus and no input leaking between players or shared controls.
- Usually provides a local multiplayer lobby for joining/leaving, required selections, and readiness, while allowing a more suitable flow for games that do not need one.
- Includes mobile/tablet virtual gamepad support when gamepad-style controls fit, with a settings toggle and a physical-controller-inspired layout adapted for touch (left stick and right circular/diamond buttons where appropriate).
- Avoids forcing gamepad or virtual controls onto game concepts where they do not make sense.
- Remains iframe-friendly when practical without weakening the standalone native-ish experience.
- Updates durable wiki context for meaningful game design, architecture, asset, control, or workflow decisions during actual game development; template-only maintenance does not read/populate the wiki or create game activity logs.
- Respects concurrency rules, including activity logs, reread-before-write behavior, and game write locks.
- Leaves no stale active lock files, preview-server records, or activity logs that do not belong in the template or current project state.

## Review Output

Use a code-review style response:

- Lead with findings, ordered by severity.
- Include file and line references when possible.
- Keep summaries brief and secondary.
- Call out missing tests or verification gaps.
- If no issues are found, say so clearly and mention any residual risk.

When a finding is about project goals rather than a code defect, label it clearly, for example `Template goal` or `UX standard`.

