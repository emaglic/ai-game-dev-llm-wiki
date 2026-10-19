# UI/UX Review Workflow

Use this workflow when the human developer invokes `/ui-ux-review`, `$ui-ux-review`, or requests a focused UI/UX review. Outside providers with native skill support, the command is a plain-text trigger for this shared workflow.

## Choose one review target

Review either the **game** or the **editor**, never both in the same pass. Use the target explicitly provided in the current request or an unambiguous reply to a pending scope question. If the target is missing, ambiguous, or includes both, ask which one to review and wait for the answer before inspecting either interface. Do not infer the target from recent work. If multiple editors exist and the intended editor is unclear, clarify which editor.

## Review method

Read the shared project guidelines and the chosen target's relevant documentation. For a game, use relevant wiki design and control decisions to understand its genre, audience and supported inputs. For an editor, use its usage and maintenance guides; template-only reviews do not read/populate the game wiki or initialize a game.

For 2D editor reviews, use [Editor UI conventions](../editor/2D/MAINTAINING.md#editor-ui-conventions) as the shared design baseline. Assess how additions fit existing visual and functional patterns. Honor explicit developer-directed overrides and documented game-specific choices; do not recommend reverting them merely to enforce uniformity. Explain any remaining concrete usability problem separately from preference or convention. Keep the baseline in the maintenance guide rather than duplicating it in this workflow.

Review usability and presentation only. Inspect code to understand layouts, controls, states and interaction flows, but do not perform a general code audit or duplicate `/self-review`. Include implementation defects only when they cause a concrete UI/UX problem. Keep the interface unchanged unless the developer separately requests implementation; review invocation authorizes analysis and suggestions, not fixes.

When browser tools are available, inspect the rendered interface and exercise representative tasks, including selection, navigation, editing or gameplay, feedback and recovery. Check supported viewport sizes and input methods rather than assuming desktop tooling must behave like a touch-first game. Reuse appropriate local preview servers under the shared guidelines. Use temporary data or in-memory example edits for editor experiments; do not save over the human developer's project. Clearly state when conclusions come from code or screenshots without interactive verification.

Compare with relevant established games or level editors when it helps explain a specific interaction. Choose comparisons by genre, task and intended users; do not copy another product's design wholesale. Browse official documentation or other direct evidence for concrete product comparisons and current guidance, cite the sources, and distinguish documented convention from your judgment. Research is optional when the local evidence is sufficient. Do not describe a preference as a universal best practice.

## Decision criteria

- **Labels and icons:** Decide per control whether icon-only, text-only or icon-plus-text fits its purpose, familiarity, frequency, available space and cost of misunderstanding. Icon-only buttons can reduce visual footprint and are appropriate when recognizable, consistently used and supported by meaningful tooltips and accessible names. Do not routinely add text to every button or replace every label with an icon. Assess whether each icon actually conveys the action or state. Check tooltip availability for supported keyboard/touch interaction; tooltips should aid discovery rather than carry essential instructions that users cannot otherwise reach.
- **Color and state:** Assess contrast, hierarchy, palette coherence and the meaning of colors for selection, modes, warnings and disabled controls. Check hover, focus, pressed, selected, locked and error states for clear distinctions. Avoid relying on color alone. Preserve intentional art direction unless it creates a demonstrated usability problem.
- **Consistency:** Compare spacing, typography, icon style, control sizes, terminology and visual states within the selected product. Check that similar actions behave similarly: activation, dragging, shortcuts, snapping, persistence, cancellation and undo. Different behavior can be appropriate when the tasks differ; explain the user impact before recommending uniformity.
- **Workflow and feedback:** Consider common tasks, discoverability, grouping, mode awareness, unnecessary steps, empty/loading/error states, progress and success feedback, destructive actions and recovery. Favor changes that reduce real confusion or effort without cluttering the interface or obstructing frequent users.
- **Layout and access:** Check hierarchy, panel/tab organization, scrolling, target sizes, focus visibility, keyboard reachability and supported assistive/input methods. Controls and feedback should remain reachable at supported sizes without covering essential content. For games, consider HUD readability, gameplay visibility, menus, settings, fullscreen and supported controller/touch flows. For editors, prioritize usable workspace and precise authoring workflows.

For game reviews, also apply the shared [console-style menu](../.agents/project-guidelines.md#console-style-menus-and-icons) and [local multiplayer](../.agents/project-guidelines.md#local-multiplayer-and-controller-ownership) baselines. Check viewport-contained organization, complete controller-only flows where supported, and familiar touch-controller layouts adapted to the game. For local multiplayer, assess independent player focus/choices, Player 1's personal and shared controls, lobby joining/leaving/readiness where useful, and disconnection recovery. Assess loading feedback and transitions against the [asset loading guidance](../.agents/project-guidelines.md#asset-loading-and-lifetime). These game requirements do not impose controller navigation or console-style layouts on the editor.

## Report

State the selected target and lead with prioritized findings. For each finding give the observed behavior or location, the affected task/user, why it matters, and a concrete improvement with relevant tradeoffs. Link source files/lines where useful and cite external comparisons when used.

Separate demonstrated usability problems from optional polish or subjective preferences. Explain recommendations in the context of this product, avoiding generic redesign checklists, arbitrary findings quotas and unsolicited code refactors. Mention effective existing choices when useful to preserve them. If no meaningful problems are found, say so rather than inventing improvements.

Briefly describe what was inspected or exercised and any verification gaps. End with a short suggested order of improvements when findings warrant it. Do not implement changes or expand the review to the other target without a separate request.
