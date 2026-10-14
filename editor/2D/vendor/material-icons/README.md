# Google Material Icons

This directory vendors 27 unmodified 24px baseline SVGs from Google's official [Material Design Icons repository](https://github.com/google/material-design-icons), pinned to commit `49d4db35df873165d6bd6ba09b063c7dafbac2f4`. Exact download URLs are recorded in `provenance.json`. Google distributes these under Apache-2.0; the upstream license is included as `LICENSE`.

`icons.css` is a first-party wrapper using SVG alpha masks and `currentColor`, with no font, CDN or npm dependency. In HTML, use `<span class="material-icon icon-save" aria-hidden="true"></span>` beside a visible label. In JavaScript, use `icon('save')` from `src/icons.mjs`. For icon-only buttons retain a descriptive accessible label and tooltip.

To extend this subset, download another SVG from the same pinned upstream revision, add its CSS class and record its source in `provenance.json`. Keep the upstream license and SVGs intact. The included artwork is by Google; the wrapper is maintained by this template.
