---
name: init-game
description: Initialize or revise this repo's browser-game wiki, starter game scaffold, and agent workflow when the user asks to start or reconfigure a game project.
---

# Init Game

This is the Codex adapter for the provider-neutral init-game workflow.

Use this skill when the user invokes `/init-game`, `$init-game`, `init-game`, or asks to initialize, reinitialize, or revise the game project scaffold for this repository.

Read and follow [../../../.agent-workflows/init-game.md](../../../.agent-workflows/init-game.md). That workflow is the shared source of truth for Codex, Claude, Gemini, and other agents. Do not duplicate or fork the workflow into another provider-specific command or skill unless the user explicitly asks for that integration.

When the workflow needs the default scaffold details, read [../../../.agent-workflows/default-scaffold.md](../../../.agent-workflows/default-scaffold.md).
