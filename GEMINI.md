# Gemini Instructions

This repository is a template for AI-assisted browser game development.

Before making changes, read [`.agents/project-guidelines.md`](.agents/project-guidelines.md). It is the canonical shared instruction file for agents working in this repo.

For durable project context, read the relevant files in `wiki/` before changing the game. Update the wiki when you make durable design, architecture, asset, or workflow decisions.

If the user asks `/init-game`, `init-game`, or asks to initialize or reconfigure the project, follow [`.agent-workflows/init-game.md`](.agent-workflows/init-game.md). Treat `/init-game` as a plain-text workflow trigger in Gemini unless the user explicitly asks for a native Gemini command.

Do not create provider-specific commands, skills, memory files, or workflow systems unless the user explicitly asks for that provider integration.

