---
name: self-review
description: Review recent browser-game work for request fit, code risks, and this template's native-ish game quality standards.
---

# Self Review

This is the Codex adapter for the provider-neutral self-review workflow.

Use this skill when the user invokes `/self-review`, `$self-review`, `self-review`, asks for a review, or accepts a recommendation to run the review after meaningful game work.

Read and follow [../../../.agent-workflows/self-review.md](../../../.agent-workflows/self-review.md). That workflow is the shared source of truth for Codex, Claude, Gemini, and other agents. Do not duplicate or fork the workflow into another provider-specific command or skill unless the user explicitly asks for that integration.

When appropriate, run the review as an independent sub-agent pass. Still inspect the actual files and project state rather than relying only on the previous implementation summary.
