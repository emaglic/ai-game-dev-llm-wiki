# Agent Instructions

This repository is a template for AI-assisted browser game development.

Before making changes, read [`.agents/project-guidelines.md`](.agents/project-guidelines.md). It is the canonical shared instruction file for agents working in this repo.

When the task involves initializing or revising a game project, follow [`.agent-workflows/init-game.md`](.agent-workflows/init-game.md). In Codex, `/init-game` may invoke the repo-scoped skill at [`.codex/skills/init-game/SKILL.md`](.codex/skills/init-game/SKILL.md), which points to the same shared workflow.

When the task involves reviewing recent work, follow [`.agent-workflows/self-review.md`](.agent-workflows/self-review.md). In Codex, `/self-review` may invoke the repo-scoped skill at [`.codex/skills/self-review/SKILL.md`](.codex/skills/self-review/SKILL.md), which points to the same shared workflow.

For durable project context, read the relevant files in `wiki/` before changing the game. Update the wiki when you make durable design, architecture, asset, or workflow decisions.

Do not create provider-specific commands, skills, memory files, or workflow systems unless the user explicitly asks for that provider integration.

