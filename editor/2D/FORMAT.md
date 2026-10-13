# Project data contract v1

Every document has `version: 1`. The [JSON Schemas](schemas/) use draft 2020-12, with `additionalProperties: true` to preserve extensions. `src/model.mjs` is the browser/runtime validator and serializer; the save server validates schemas and semantic properties/references independently. Unsupported document versions, layer kinds or property types reject instead of being dropped. Known field types and catalog constraints must validate; unknown fields are round-tripped. Use `extensions` for namespaced game metadata where practical.

## Manifest

```json
{
  "version": 1,
  "settings": "data/settings.json",
  "catalog": "data/elements.json",
  "assets": "assets/",
  "assetFiles": ["crate.svg"],
  "levels": [{"id": "room-a", "label": "Room A", "path": "data/levels/room-a.json"}]
}
```

Settings, catalog, level paths and the assets directory resolve against the **manifest URL**, not the editor URL or working directory. Asset filenames resolve against `assets` (use a trailing `/`). List asset choices in `assetFiles`; the editor loads these images and catalog images and reports failures. IDs are nonempty, unique strings. The local server mounts the selected manifest's directory at `/project/` and restricts its data paths to that directory. Different games may use different layouts. Manifest changes require an on-disk edit and reload; the save API never accepts new paths from an edited bundle.

## Settings and catalog

Settings contain `viewport: {width,height}` (positive logical world-pixel dimensions), `properties` (definitions), and `values` (global editable values). The catalog contains `levelProperties` and `elements`. Each element has `id`, `kind: "tile" | "object"`, `properties`, optional `label`, `color: "#rrggbb"`, `asset`, `size: {width,height}`, and `resizable`. A catalog describes what can be authored, not physics, AI, trigger execution or other gameplay rules.

Examples of property definitions:

```json
{
  "speed": {"type":"number", "label":"Speed", "default":120, "min":0, "max":600, "step":5, "help":"World pixels per second; interpreted by the runtime."},
  "enabled": {"type":"boolean", "default":true},
  "mode": {"type":"enum", "options":["idle","patrol"], "default":"idle"},
  "tint": {"type":"color", "default":"#56cbb6"},
  "sprite": {"type":"asset", "default":"crate.svg"},
  "anchor": {"type":"position", "default":{"x":128,"y":128}},
  "radius": {"type":"number", "control":"slider", "min":0, "max":256, "step":1, "default":64, "overlay":{"kind":"radius","color":"#98fff1"}},
  "destination": {"type":"objectRef", "default":null, "targets":["teleporter"], "overlay":{"kind":"connection"}}
}
```

Supported types: `number`, `integer`, `boolean`, `string`, `enum`, `color`, `asset`, `position`, `objectRef`. Common metadata: `label`, `help`, `default`, `required`, `control`. Numeric constraints: `min`, `max`, positive `step` (input increment; validation checks bounds and integer type, not floating-point step divisibility). Strings support `maxLength`. Enums use nonempty string `options`. Colors are six-digit hex. Assets are filenames from the manifest; an empty string means no image. Positions are `{x,y}` in world pixels. Object references are `null` or `{level,object}`; `targets` limits catalog type IDs. An empty/omitted target list allows any object type.

Absent properties use declared defaults in controls/validation. Defaults are inserted into newly placed objects; viewing an existing object does not rewrite absent data. A runtime should apply defaults when reading values. Null only substitutes for a default if the property actually permits null (`objectRef`). Undeclared values are retained and are owned by the game.

`overlay` kinds are `radius` (numeric property, world pixels, object center), `box` (position property with optional constant positive width/height), and `connection` (object reference). Color is optional. In-level references draw lines; cross-level ones draw labels. Broken references are reported. Overlays are editor feedback and don't execute game logic.

## Levels, layers and objects

```json
{
  "version": 1, "id":"room-a", "width":800, "height":480, "grid":32,
  "settings":{"camera":{"x":400,"y":240}, "cameraZoom":1},
  "layers":[
    {"id":"floor", "kind":"tile", "visible":true, "locked":false, "opacity":1,
     "tiles":[{"x":0,"y":0,"type":"floor-tile"}]},
    {"id":"actors", "kind":"object", "visible":true, "locked":false, "opacity":1,
     "objects":[{"id":"portal-a", "type":"teleporter", "x":128,"y":96,
                 "width":40,"height":40,"properties":{"destination":null}}]}
  ]
}
```

Dimensions/grid are positive world pixels. Tile coordinates are integer **cell indices**; render at `(x * grid, y * grid)` with cell size `grid`. Tile arrays are sparse, one tile per cell per layer. Painting changes a tile's type without dropping its extension fields; erasing intentionally removes the whole tile. The interactive paint tools clip to the room. Existing out-of-room data is preserved.

Objects use world-pixel top-left `x,y` and positive `width,height`. IDs are unique within their level and stay stable when moving/resizing/undoing/exporting. New objects receive UUID-backed IDs. Catalog kind must match layer kind. Layer IDs are unique per level; array order is drawing order, first to last. `visible`, `locked` and `opacity` (0..1) are authoring/render metadata; games should explicitly document how they interpret visibility/opacity. Locking only restricts authoring.

Per-level settings use `catalog.levelProperties`, with the same controls and validation as element properties. Camera is an optional convention: declare `camera` as a position and `cameraZoom` as a positive number. The reference viewport comes from global settings. `camera` is the view **center**, and visible size is `(viewport.width / cameraZoom, viewport.height / cameraZoom)`. Navigation pan/zoom is editor-local and is never serialized. Other level settings are open to each game; the camera is not an exhaustive list.

References explicitly contain level ID and object ID. Cross-level targets are validated against all manifest levels. Deletion can break a reference; it never silently retargets it. Repair or undo before saving. Runtime interpretation of links, sizes, asset anchors and units must agree with the editor contract.

## Extensions

For unusual controls, import `customControls` from `src/controls.mjs` and register a DOM factory under a definition's `control` name. The factory receives `{definition,value,onChange,project}` and returns an element; call `onChange` with a value matching the existing typed definition. Unregistered controls fall back to the standard typed control. New serialized types need validators/schemas and a compatibility plan, not only a UI widget.

For new visualizations, extend `src/render.mjs` and validate/document the overlay metadata in the browser model and server schemas. For additional tools, keep one gesture one history transaction, honor locking, and preserve unknown fields. Browser modules are reusable by a game's runtime but their paths must be explicit; alternatively implement the documented format independently. The fixture preview is a concrete consumer.

Before significant schema/tool/control/save changes, agents notify the human developer of intended behavior and compatibility impact. A breaking format requires a new version and an explicit migration path; do not silently rewrite unsupported documents. Routine fixes/minor additions can proceed normally. Verify serialization, constraints, references, history, server confinement and saved data loading in the actual runtime.
