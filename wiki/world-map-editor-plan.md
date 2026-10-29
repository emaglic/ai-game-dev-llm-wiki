# World map editor implementation plan

Status: Planned; implementation has not started.

This is a template-editor feature plan, explicitly requested for the wiki. It does not initialize a game or the rest of the wiki. Update this document as stages are completed, recording verification and any changed decisions. Creating this plan does not authorize implementing every stage immediately.

## Goal

Provide a designer-facing overview of interconnected levels, with named maps for overworlds, interiors, castles, dungeons and other groupings. Designers can arrange simplified level representations without editing level objects, tiles or layers in the overview.

## Agreed direction and proposed defaults

- A toolbar icon switches to a dedicated world-map workspace that hides both sidebars and the level canvas. Returning restores the previous workspace rather than overwriting saved panel preferences.
- Named maps support create, select, rename and delete. Existing levels can be added, removed from a map, and dragged into position. Removing a card or map never deletes level files or gameplay connections.
- A level may appear in multiple maps; use stable level IDs, independent map IDs and independent map-space coordinates.
- Cards show a simplified, read-only representation. Double-click or an accessible Open level action opens the actual level editor.
- Connections reflect authored destinations. Card placement is a visual reference, not runtime world positioning or a command to change travel behavior.
- New levels may receive suggested positions from connections. Never silently rearrange manually positioned cards; provide an explicit arrangement action.
- Keep implementation browser-native, modular and compatible with existing supported projects. Reuse local icons, controls and interaction conventions.

These defaults guide design; unresolved details below must be settled before their implementation stage.

## Stage 1: UX and data contract

- [ ] Review the proposed editor workspace with a focused UI/UX pass before implementation.
- [ ] Specify toolbar entry/exit, map selector, map-management actions, add-level picker, card selection, pan/zoom, fit, keyboard access and empty states.
- [ ] Specify restoration of level, selection, navigation and sidebar layout on returning to level editing. Resolve active gesture cancellation and save/reload behavior across modes.
- [ ] Decide persisted storage for shared map names, membership and positions; prefer versioned editor metadata over browser-only storage. Check existing manifest/settings extension and save paths before choosing a location.
- [ ] Define map IDs, stable level references, layout coordinates, supported metadata version and handling of missing/removed levels and unknown extension fields.
- [ ] Decide undo scope for map edits and local preferences for map navigation/active view. Persisted arrangements must participate in dirty tracking, save and bundle round trips.
- [ ] Document compatibility and any required validator/server updates. Do not assume a new standalone file can be saved by the existing confined save API.

Done when: interaction and storage decisions are documented, reviewed with the developer, and have concrete acceptance scenarios. No runtime or structural schema change is assumed in advance.

## Stage 2: Named maps and draggable level cards

Depends on Stage 1.

- [ ] Implement a dedicated world workspace and reliable return to level editing.
- [ ] Add named-map creation, selection, rename and removal with clear destructive-action wording.
- [ ] Add/remove existing levels with search and missing-level feedback. Do not create or delete level files here.
- [ ] Render inexpensive placeholder cards with level names and dimensions; choose readable card sizing independently of runtime units.
- [ ] Support selection, dragging, pan/zoom, Fit map and Open level without allowing level-content editing.
- [ ] Persist map edits through the agreed contract and support undo/redo and canceled drags.
- [ ] Verify map/level switching, empty maps, duplicate names policy, multiple-map membership, reload, export/import and read-only example restrictions.

Done when: a designer can create an overworld and dungeon map, arrange existing levels independently, save/reload them, open a level and return without losing either layout or level-editor state.

## Stage 3: Simplified previews and performance

Depends on Stage 2.

- [ ] Generate small thumbnails lazily for visible/near-visible cards; use placeholders until ready.
- [ ] Reuse rendering semantics for layer order, backgrounds/parallax and camera composition. Decide full-level versus camera-based framing and treatment of invisible editor-only regions.
- [ ] Bound thumbnail resolution, cache memory and work per frame. Avoid continuously rendering every level or creating full-resolution offscreen canvases for large levels.
- [ ] Invalidate affected previews after authored changes, asset changes and reload; handle missing assets and canceled/outdated rendering work.
- [ ] Measure representative projects with many levels, unusually large levels and repeated assets; record actual timings and memory limits.

Done when: cards provide useful visual recognition and world navigation stays responsive within recorded budgets.

Architecture note: the current project loader loads level JSON together. Lazy thumbnail rendering does not mean lazy JSON loading. If measured project scale requires loading level documents on demand, propose that as a separately scoped loader/save/reference-validation change before implementation.

## Stage 4: Detected connection overlays

Depends on Stage 2; thumbnails may be developed independently.

- [ ] Inspect declared object-reference properties rather than hardcoding teleporter type names. Distinguish gameplay transitions from other references; not every object reference is travel.
- [ ] Define optional declarative connection semantics when needed, including directional travel, neighboring rooms, portals and interiors. Document validator compatibility if extending definitions.
- [ ] Resolve source and destination IDs, same-level links, one-way and reciprocal links, missing targets, multiple exits and destinations outside the current map.
- [ ] Draw directional lines with readable selection/highlight behavior and source/destination labels. Reduce clutter without implying unverified connections.
- [ ] Expose connection details and navigation to endpoints; keep gameplay destinations read-only in this view initially.
- [ ] Test references with custom type names, multiple maps and invalid/deleted targets.

Done when: designers can trace existing travel connections accurately without the overview inventing links or changing runtime data.

## Stage 5: Placement suggestions and explicit arrangement

Depends on Stage 4.

- [ ] Infer tentative relative direction from source/destination positions normalized to each level's dimensions, where connection semantics support spatial adjacency.
- [ ] Handle interior/portal links, central exits, conflicting directions, cycles and multiple connections with uncertainty rather than forced spatial claims.
- [ ] Suggest placement for newly added cards and provide an explicit Arrange selected levels action.
- [ ] Preserve manual positions unless the designer explicitly includes them in an arrangement. Decide whether explicit pinning is necessary.
- [ ] Keep suggestions separate from applied layout; applying an arrangement is one undoable operation.
- [ ] Test left/right/top/bottom adjacency, differing level sizes, ambiguous links, disconnected groups and map-specific arrangements.

Done when: suggestions reduce manual placement while preserving designer control and making uncertain relationships understandable.

## Stage 6: Integration, accessibility and release review

- [ ] Verify full workflows across map editing and level editing, including canceled gestures, dirty state, undo/redo, save conflicts, import/export and project replacement.
- [ ] Verify keyboard access, focus restoration, readable labels, zoomed text and smaller desktop workspaces.
- [ ] Verify map metadata cannot alter runtime coordinates, collisions, layer data or destinations; existing supported projects still load without map metadata.
- [ ] Run relevant JavaScript, Python and Chromium checks; extend coverage where new persistence or interaction contracts require it.
- [ ] Update editor README, FORMAT and MAINTAINING documentation and relevant shared integration guidance.
- [ ] Request self-review and focused editor UI/UX review; resolve findings and record any verification limitations.
- [ ] Walk through a representative overworld/interior/dungeon project with the developer.

Done when: all accepted stages and release checks are complete, limitations are documented, and the developer has reviewed the result.

## Decisions to settle

1. Persisted metadata location and versioning, consistent with the existing save API.
2. Whether map names must be unique, how missing levels appear, and default membership for new levels.
3. Card sizing and thumbnail framing; these must not imply runtime scale or adjacency.
4. How catalog definitions identify travel references without assuming a genre.
5. Connection presentation across separate maps and handling of multiple cards for a level.
6. Undo/history behavior across workspaces and whether manual-placement protection needs an explicit pin.
7. Representative performance targets and whether future lazy document loading is justified.

## Progress and handoff

Next step: Stage 1 UX and data-contract design. No world-map code has been implemented. Start future work by reading this plan, the current editor docs and current project state; implement and verify one agreed stage at a time. Mark items complete only with evidence, and record changed decisions here.
