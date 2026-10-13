# Project data contract: manifest/settings/catalog v1, levels v2

Manifest, settings and catalog documents have `version: 1`; level documents have `version: 2`. The [JSON Schemas](schemas/) use draft 2020-12, with `additionalProperties: true` to preserve extensions. `src/model.mjs` is the browser/runtime validator and serializer; the save server validates schemas and semantic properties/references independently. Unsupported document versions, layer kinds or property types reject instead of being dropped. Known field types and catalog constraints must validate; unknown fields are round-tripped. Use `extensions` for namespaced game metadata where practical.

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

### Artwork and interaction shapes

Optional catalog `visual` and `collision` fields describe artwork and interaction geometry in world pixels. Visible elements should use actual runtime artwork; agents recommend a representative frame and `size` for new placements. Existing placed dimensions remain authoritative.

```json
{
  "id":"player", "kind":"object", "size":{"width":24,"height":40},
  "visual":{"asset":"player-sheet.png", "frame":{"x":64,"y":0,"width":32,"height":48},
            "fit":"contain", "bounds":{"x":-0.25,"y":-0.2,"width":1.5,"height":1.2}},
  "collision":{"shape":"rectangle"}, "properties":{}
}
```

`frame` is an optional source-pixel crop with nonnegative integer `x,y` and positive integer `width,height`. Omit it for a whole image. `visual.asset` resolves inside the manifest's assets directory; legacy `asset` remains supported. The existing `sprite` asset property can override the filename (using the same crop). Loaded image dimensions are checked against the source crop; invalid crops report errors and use a fallback shape. List images in `assetFiles` for asset-selector choices.

`fit` defaults to `contain`, centering art while preserving aspect ratio; `stretch` explicitly fills its destination. Optional `bounds` defines art placement relative to the object rectangle, with default `{x:0,y:0,width:1,height:1}`; negative offsets/oversized bounds support art extending beyond its collider. These are dimensionless proportions, not source pixels. Images preserve their transparency. Pixel-art rendering disables smoothing. Palette thumbnails use the same representative artwork.

`collision.shape` defaults to `rectangle`; `ellipse` fills the object's bounding rectangle. `polygon` requires at least three normalized points in 0..1, for example `{"shape":"polygon","points":[{"x":0,"y":1},{"x":1,"y":1},{"x":0.5,"y":0}]}`. Closed polygons use even-odd filling/picking. The object's top-left position and width/height define the actual interaction bounds; moving/resizing transforms the shape. Selection, erase, and reference picking use this shape. Resize handles act on its bounding rectangle. Sprite transparency is not automatically interpreted as a collider.

For invisible triggers/teleport areas, set `visual.editorOnly: true`. The editor shows a translucent labeled collision shape with a dashed outline, while the fixture runtime hides that visualization. Visible sprites show their collision outline when selected; elements without artwork use their collision shape as the labeled fallback. Games must implement the declared collision geometry and any property-derived size changes consistently; the editor does not execute collision behavior. Unsupported shape kinds are rejected, requiring an explicit extension for more specialized geometry.

```json
{
  "version": 2, "id":"room-a", "width":800, "height":480, "grid":32,
  "tileSize":{"width":32,"height":32},
  "settings":{"camera":{"x":400,"y":240}, "cameraZoom":1},
  "layers":[
    {"id":"floor", "kind":"tile", "visible":true, "locked":false, "opacity":1,
     "tiles":[{"x":5,"y":7,"width":32,"height":32,"type":"floor-tile"}]},
    {"id":"actors", "kind":"object", "visible":true, "locked":false, "opacity":1,
     "objects":[{"id":"portal-a", "type":"teleporter", "x":128,"y":96,
                 "width":40,"height":40,"properties":{"destination":null}}]}
  ]
}
```

Level dimensions are positive world pixels; grid spacing is a positive integer pixel count. **Tiles use whole-pixel top-left x/y and explicit positive integer width/height**, not cell indices. Draw a tile directly at `(tile.x, tile.y)` with its own dimensions. Negative positions, boundary overhang and overlap are supported. Within a layer, later records draw on top; picking uses the topmost actual collision shape. Exact duplicate origins are invalid. Painting at an existing origin changes the type and preserves dimensions/extensions; erasing removes whole records. Tile defaults are in `tileSize: {width,height}` (positive integers), with optional catalog `size` overriding defaults for new placements. Existing tiles retain their explicit sizes.

Grid X/Y is optional metadata `extensions.editor2D.grid: {x:16,y:24}`, falling back to level `grid` for both axes. It controls grid lines and placement/movement snapping only. With Snap disabled, tile placement/movement rounds to whole pixels. Painting snaps origins down to the grid; dragging rounds the desired origin to the nearest grid line. Rectangle fill repeats stamps at tile-size intervals from its starting origin, avoiding a tile for every pixel of an unsnapped drag. Right-drag erasing uses swept collision geometry, including off-grid/overlapping tiles. Picking/erasing do not infer cell occupancy. Runtime spatial indexing may use any bucket size independently of these stored coordinates.

Level settings exposes top-level width/height and a 3x3 anchor. **Apply resize** is one undoable transaction. Anchor factors are 0 (left/top), 0.5 (center), or 1 (right/bottom). Translation is `dx = Math.round((newWidth-oldWidth)*anchorX)` and similarly for Y; rounding follows JavaScript (.5 toward positive infinity). Tiles, objects, the camera and declared world-position properties move by the same integer pixel offset across all layers, including locked/hidden layers. No 32px/64px increments are required. Centering an odd size change is approximate within half a pixel, with the actual integer offset displayed before applying. Sizes and references stay unchanged. Shrinking preserves out-of-bounds content and warns without blocking saving.

Typed positions marked `space: "world"` translate with the room, including defaults materialized into placed values when necessary. `space: "local"` denotes vectors/offsets; unmarked position properties remain unchanged for compatibility. Specialized coordinates inside unknown extensions need an explicit resize extension. The runtime must read dimensions and pixel positions directly and document handling of overlaps/out-of-bounds content.

## Migrating cell-based levels

The old level v1 schema is retained as `schemas/level-v1.schema.json` exclusively for explicit migration. `migrate_levels.py --project PATH` is a dry run; add `--apply` to convert each v1 tile's `(x,y)` to `(x*oldGrid,y*oldGrid)` and set its width/height to oldGrid. Set level version to 2 and add tileSize. Manifest/settings/catalog remain v1, preserving paths, IDs, references, property values and extension data. The script validates the full converted project, stages writes and keeps `.json.v1.bak` originals; it refuses backup collisions and rolls back ordinary write failures. As with saves, this is not a crash-safe database transaction. Fractional legacy tile sizes or conflicting reserved fields require manual conversion. Running again does not multiply coordinates again. The editor/server reject v1 levels instead of silently converting on load/save. Update runtime coordinate interpretation before playing converted data.

Objects use world-pixel top-left `x,y` and positive `width,height`. IDs are unique within their level and stay stable when moving/resizing/undoing/exporting. New objects receive UUID-backed IDs. Catalog kind must match layer kind. Layer IDs are unique per level; array order is drawing order, first to last. `visible`, `locked` and `opacity` (0..1) are authoring/render metadata; games should explicitly document how they interpret visibility/opacity. Locking only restricts authoring.

Per-level settings use `catalog.levelProperties`, with the same controls and validation as element properties. Camera is an optional convention: declare `camera` as a position and `cameraZoom` as a positive number. The reference viewport comes from global settings. `camera` is the view **center**, and visible size is `(viewport.width / cameraZoom, viewport.height / cameraZoom)`. Navigation pan/zoom is editor-local and is never serialized. Other level settings are open to each game; the camera is not an exhaustive list.

References explicitly contain level ID and object ID. Cross-level targets are validated against all manifest levels. Deletion can break a reference; it never silently retargets it. Repair or undo before saving. Runtime interpretation of links, sizes, asset anchors and units must agree with the editor contract.

## Extensions

For unusual controls, import `customControls` from `src/controls.mjs` and register a DOM factory under a definition's `control` name. The factory receives `{definition,value,onChange,project}` and returns an element; call `onChange` with a value matching the existing typed definition. Unregistered controls fall back to the standard typed control. New serialized types need validators/schemas and a compatibility plan, not only a UI widget.

For new visualizations, extend `src/render.mjs` and validate/document the overlay metadata in the browser model and server schemas. For additional tools, keep one gesture one history transaction, honor locking, and preserve unknown fields. Browser modules are reusable by a game's runtime but their paths must be explicit; alternatively implement the documented format independently. The fixture preview is a concrete consumer.

Before significant schema/tool/control/save changes, agents notify the human developer of intended behavior and compatibility impact. A breaking format requires a new version and an explicit migration path; do not silently rewrite unsupported documents. Routine fixes/minor additions can proceed normally. Verify serialization, constraints, references, history, server confinement and saved data loading in the actual runtime.
