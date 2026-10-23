---
name: genie-create-carousel
description: Create or revise an editable carousel as multiple ordered frames on one canvas page, preserving frame membership, layer order, brand assets, and the existing canvas JSON schema.
---

Read `CANVAS.md`, `canvas.schema.json`, and the current `canvas.json`. For Siswa Juara educational copy, read `../genie-create-idea/references/editorial.md`. Respect the supplied topic, slide count, audience, and existing style. If unspecified, five slides at 1080 × 1350 are a usable disclosed starting point; keep existing dimensions when revising a carousel.

In Discuss mode, provide slide copy and layout guidance without editing files. In Draw mode, implement the carousel in canvas.json, rather than only describing it. This app has one conversation owning one canvas, with pages and multiple frames per page. The bridge exposes the active page only. A carousel is ONE active page with MULTIPLE `t: "frame"` elements, not separate canvas files, projects, or pages.

Layout requirements:

- Place frames in reading order from left to right with a visible gutter, e.g. 80 canvas units. Append new frames beyond existing bounds unless replacing or editing was requested. Name frames with an ordinal and a short slide title.
- Give every object a stable, unique `id`; every child has `fid` equal to its frame's id. Coordinates are absolute: a child at a 64-unit inset has x = frame.x + 64 and y = frame.y + 64. Frames have no fid. Keep each child's bounds inside its frame.
- Put a frame before its children in the elements array, with decorative backgrounds before foreground content. Do not move an element outside its frame merely to send it backward. Preserve stable IDs, grouping, existing frames, and unrelated elements when revising.
- Keep all dimensions positive, fonts legible, line heights and text boxes large enough, with consistent margins and contrast. Use an actual available font; reuse current document typography when possible. Match the requested language. Include the real slide copy, not generic placeholders when content is known.
- Use a clear sequence: specific opening, distinct teaching points or worked example, useful conclusion, one relevant CTA. Do not force every slide into the same layout. Preserve and reuse available real logos/embedded images instead of inventing branding. A semantic image identifier is not an image; give it an actual permitted src or leave a clearly labelled image slot.
- Image identifiers follow searchable-name-color-facing. Reuse provided images or create files inside this workspace and use relative paths; the bridge embeds supported local images. Do not reference inaccessible developer-machine assets or huge unbounded images.

Before finishing, parse the JSON, check unique IDs, valid frame references, absolute child bounds, consistent slide dimensions, sensible layer order, text length, and independently checked exercise answers. Preserve version:1 and unrelated metadata, updating metadata.updatedAt to an ISO timestamp. Avoid dumping the JSON into chat. Summarize the slide count, dimensions, content, and any unresolved asset needs; the app handles applying the result and keeping versions.
