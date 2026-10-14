# Migrate an existing game to the current template

Use this workflow for `/migrate-game`, `$migrate-game`, or requests to integrate an existing game and wiki with an updated template. Outside native skill support, the command is a plain-text trigger. This is migration, not game initialization: do not run `/init-game`, regenerate the scaffold, reset the wiki, or substitute the editor fixture for the existing game.

## Establish preparation

Rely on the human developer to describe how the project was prepared. Unless already supplied in the invocation or current conversation, ask:

- Have you copied the existing project's `game/` and `wiki/` directories into this updated template clone, or updated the template in the existing game repository?
- Would you like instructions for preparing the project before migration?

Wait for required preparation information before starting migration changes. Do not infer copying history or template compatibility from directory presence. If the developer requests preparation instructions, explain this route:

1. Preserve the old project and any uncommitted work. Clone the desired updated template into a separate directory.
2. Copy the existing project's complete `game/` and `wiki/` contents into the corresponding folders in the new clone. Include runtime assets and game data; preserve existing wiki pages. Do not copy the old `.git` directory or overwrite the updated template's agent instructions and workflows.
3. Check for dependencies outside those folders (such as source assets or build configuration) and bring over the project-specific files needed by the game deliberately. Do not replace current template infrastructure wholesale.
4. Return to the new clone and invoke this workflow, stating that preparation is complete.

Updating the template within an existing game repository is also a valid starting point; no copying is required. If preparation is incomplete, provide the requested guidance and wait for confirmation that it is ready. Do not clone, merge repositories or copy source projects on the developer's behalf without authorization for those operations.

## Inspect and identify compatibility gaps

Read the current repository's `AGENTS.md` and [shared guidelines](../.agents/project-guidelines.md). Inspect relevant existing wiki design, architecture, controls, assets, data-format and activity pages, plus the actual game implementation and working tree. Follow the current template instructions when old wiki workflow notes conflict, while preserving the game's established design decisions. Follow normal activity logging, optimistic documentation checks and game write locking for migration work.

Determine the game's dimension/technology from its implementation and wiki. For a 2D game, read the current [format contract](../editor/2D/FORMAT.md), [usage guide](../editor/2D/README.md) and [maintenance guide](../editor/2D/MAINTAINING.md). For other games, assess applicable template conventions without forcing the 2D contract or inventing a supported 3D editor.

Compare observed behavior with the current template requirements. Explain the concrete gaps and intended changes briefly, then proceed with necessary reversible integration work. Distinguish serialized/runtime requirements from editor-only UI and browser preferences; a template update does not automatically require gameplay changes. Do not add template-version records, migration tracking files or provider-specific memory systems.

If files are missing despite reported readiness, explain what is missing and ask for the necessary source/context rather than initializing replacements. If the game is already compatible, report the checks supporting that conclusion and avoid unnecessary edits. Running this workflow repeatedly should preserve compatible work, not repeat conversions or continually redesign the project.

## Integrate the existing game

Preserve gameplay, art direction, authored levels, assets, IDs, references and unknown extension fields. Make targeted compatibility changes instead of replacing working architecture solely to match a starter scaffold. Do not erase unrelated working-tree changes or modify source assets in root `assets/`.

For 2D editor integration:

- Load the manifest and resolve settings, catalog, levels and assets relative to it. The runtime consumes the same JSON that the editor edits; eliminate conflicting hardcoded copies while preserving existing content and mechanics.
- Inspect actual document versions. Use the current migration tooling only when needed. For legacy v1 cell levels, stop the editor save server and ensure other writers are idle, acquire the game write lock, dry-run the documented conversion, then apply with preserved backups. Do not overwrite backups or silently reinterpret unsupported structures. Update runtime interpretation before playing converted data. Use the versions documented in FORMAT.md rather than assuming all documents share a version.
- Interpret v2 tiles in whole world pixels with independent width/height; support overlap and boundary overhang. Snap spacing is an editor aid, not a coordinate multiplier or tile-size definition.
- Derive world/camera boundaries from editable level dimensions. Anchored resizing translates content, including declared world positions and locked layers, without scaling/deleting it. Declare world/local position semantics and document runtime handling of out-of-bounds content.
- Honor camera center/zoom, reference viewport and catalog defaults. Camera handle resizing edits existing center/zoom and preserves viewport aspect ratio. Layer array order determines drawing order; editable names are labels, so use stable IDs/kinds in runtime logic.
- Declare useful typed controls, artwork/source frames and accurate collision geometry matching gameplay. Keep object references valid, including cross-level destinations. Preserve existing custom extensions and behavior; extend the shared editor only for demonstrated integration needs, following its maintenance/version rules and notifying the developer of significant changes.
- Keep grid linking/color/opacity, overlays and panel layout editor-local. These UI conveniences do not require gameplay fields.

Do not stall for repeated approval on routine work covered by the migration request. Ask when a missing design decision materially changes gameplay or an action is destructive/outside the authorized scope. Keep unaffected integration work moving while resolving uncertainties.

## Update the existing wiki and verify

Revise relevant wiki pages in place to explain the resulting architecture, data formats, editing workflow, runtime interpretation and migration decisions. Preserve still-valid design/history and remove or correct outdated guidance. Do not create a second wiki or rewrite every page merely because the template changed. Follow shared activity-log requirements without adding a separate version-tracking system.

Run appropriate existing checks and exercise the actual game. Verify editor load, representative edits, save and reload against this game's manifest, then confirm the real runtime reflects edited positions, dimensions and camera settings. Use temporary project copies or restore test changes so verification does not leave arbitrary edits in authored levels. Check references/assets and representative gameplay for regressions. The fixture runtime preview is not evidence that the actual game works.

If runtime dependencies or browser tooling prevent a check, state precisely what remains unverified; do not claim full compatibility on static inspection alone. Release any lock acquired by this migration and handle preview server state under shared guidelines. Do not clear another session's locks or terminate unrelated servers.

Finish with a concise summary of migrated areas, wiki changes, verification, remaining incompatibilities and a suggested commit message when changes exist. Recommend `/self-review` after meaningful migration without running it automatically. Do not commit or publish unless requested.
