# Using the canvas

This guide covers the current Genie editor: editable designs, external presets and media, narration, captions, animation, and local exports. The main navigation is **Canvases**, **Publish**, **Schedule**, and **Setting**.

Jump to [presets](#use-presets-and-templates), [narration and captions](#add-narration-and-matching-captions), [animation](#animate-and-time-the-scene), [export](#export-the-finished-result), [backups](#save-recover-and-move-your-work), or [troubleshooting](#troubleshooting).

## Start with a complete workflow

1. In **Setting → Assets**, choose the extracted asset pack folder containing `manifest.json`. This supplies templates, illustrations, and animation clips. You can also build a design using Elements and your own uploads.
2. Open **Canvases → New Canvas**, then name it in the header.
3. Open **Templates**, search for a layout, preview it, and choose **Add frame**. Alternatively, choose a frame format in **Elements**.
4. Edit text, replace artwork, and arrange the layers. Keep each slide or video scene inside its own frame.
5. Save a checkpoint with **Versions → Save current version** before substantial changes.
6. For a narrated video, select the frame, open **Narration**, write the script, select the billing account, and generate the voice and optional matching captions. Review the result before generating again.
7. Open **Animation** and **Timeline** to set duration, layer timing, and transitions. Play each scene and inspect the complete sequence in Export.
8. Choose **Export**: PNG/JPG for still designs or MP4 for animation with frame audio and captions. Select and order the frames you want.
9. Use **Canvas settings → Export backup** to keep an editable JSON copy. Use Publish separately when you are ready to submit media to a social provider.

## Understand canvases, pages, frames, and layers

| Item   | What it owns                                                               | How to use it                                                                                                                                       |
| ------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas | Pages, canvas assets, and saved versions                                   | One design project or campaign. Open it from Canvases.                                                                                              |
| Page   | Its own document and frames                                                | A separate working area, such as an alternative layout or another deliverable. Switch with the numbered page buttons; **Add page** creates another. |
| Frame  | Design layers, scene settings, narration draft, audio tracks, and captions | One carousel slide, still image, or video scene.                                                                                                    |
| Layer  | Text, a shape, image, line, or video                                       | Select it on the canvas or in Layers to edit it.                                                                                                    |

Exports work with frames on the **current page**. To make a video sequence or carousel export, put its frames on the same page. Export other pages separately. Artwork outside a frame is workspace content and is not part of that frame's export.

Dragging a frame label moves its children with it. Duplicate a frame when you want another complete scene, including its narration and audio. Deleting a frame also deletes its children. Frame locking and visibility apply to its children; children remain clipped to their frame even when they extend beyond its edges.

## Find your way around

| Area            | Controls                                                     |
| --------------- | ------------------------------------------------------------ |
| Header          | Canvas name, Versions, Zen mode, Canvas settings, Export     |
| Page rail       | Switch pages or add a page                                   |
| Left library    | Elements, Equation, Templates, Assets                        |
| Canvas toolbar  | Undo, Redo, Timeline; zoom controls sit beside the canvas    |
| Right inspector | Properties, Narration, Animation, Layers                     |
| Timeline        | Playhead, scene preview, layer clips, audio and caption rows |

Use **Fit frame** to focus your current frame and **Fit all** to see the page's frames together. Space plays/pauses; Shift+Space-drag or middle-drag pans; Ctrl/Cmd-wheel zooms. Zen mode hides surrounding editing panels; exit it to return to the full workspace. Drag the inspector edge to resize it.

## Build and edit a design

**Elements** offers Post 4:5 (1122 × 1402), Story 9:16 (940 × 1672), Square (1080 × 1080), and Wide 16:9 (1280 × 720) frames. Change dimensions in Properties when needed. These are the app's starting sizes; check the destination's requirements before delivery.

Add editable text, shapes, lines, image slots, or a video. Drag elements from the library or use its buttons. Dropped text, images, and copied elements can be placed directly on the canvas. A drop inside an unlocked frame belongs to that frame.

Open **Equation** for searchable LaTeX examples, physics/learning diagrams, and 23 editable 3D illustrations. Select a 3D card, then use Properties to change its parameters, rotate the preview, and adjust zoom, formulas, and dimensions. Animated illustrations follow the timeline and exports. See the [3D illustration catalog](science.md#3d-illustrations).

Select a layer to change **Position & size**, appearance, and arrangement. Drag to move, use the handles to resize, and use the upper rotation handle to rotate. Shift constrains transforms; Alt resizes around the center; Ctrl/Cmd temporarily disables canvas snapping during a drag. Escape cancels an active transform.

Double-click text to edit it. Properties controls font, size, weight, alignment, spacing, fill, outline, and shadow. Text styles include Classic, Outline, Shadow, and Highlight. Use the selected-word highlight controls when you need different colors within one text layer. Nunito and Baloo 2 are bundled; additional Google Fonts need a connection when first loaded. Check line breaks after changing font or frame size.

Use **Layers** for items covered by other artwork or marked hidden/locked. Shift-click selects multiple layers; Alt-click on the canvas cycles through overlapping unlocked elements. Group related items, use alignment controls, and reorder layers with Arrange or by dragging layer rows. The frontmost siblings appear first in Layers.

Changing stack order keeps a layer in its frame. Use **Properties → Arrange → Move to frame** to change its parent explicitly. A deliberate drag into another frame also reparents it; a drop onto empty workspace retains the current parent.

## Use presets and templates

The editor calls reusable frame presets **Templates**. The supplied Siswa Juara pack currently contains 136 templates across Classic, Essentials, Studio, Math & Physics, SD & SMP, STEM SD–SMA, and the standard frame. Another pack may have a different catalog.

1. Connect the pack in **Setting → Assets**. Desktop remembers the folder in local `config.json`; browser folder selections last for the session. In development, a prepared local pack connects automatically.
2. Open **Templates**. Search names, topics, or tags; combine use case, collection, and format filters. Use cases include Cover, List, Content, Image, Question, Answer, Explanation, and Closing.
3. Preview a template. **Add frame** creates another frame; **Replace selected frame** replaces the selected frame's design layers and applies the template's dimensions and scene settings. Save a version before replacing a scene you have already edited.
4. Review the result in context. Templates keep text, panels, ornaments, and artwork as separate layers. **Compare original reference** is no longer offered: the reconstructed reference conversions were removed after visible seams were found across characters and background panels.

The catalog is metadata only. Visible previews load as needed; full template JSON, shared branding, and required artwork load on selection. Templates and media stay outside the app bundle in the external pack. If indispensable artwork is unavailable, applying the template fails before changing your canvas. Some optional image slots may remain empty for your own uploads.

Use the favorite button to bookmark templates locally. **Remove from library** hides a supplied template locally; choose the **Removed** collection to restore it. This does not delete pack files or change designs already placed on a canvas.

### Save, import, and export your own templates

Select a populated frame and choose **Templates → Save frame**, then enter a name and use case. It appears in **My templates** and remains local. **Import JSON** adds supported preset JSON to that library; **Export template JSON** saves the loaded design with its resolved artwork embedded.

A saved frame template contains its dimensions, background, design layers, scene settings, and layer animations. It does **not** include the frame's narration draft, audio tracks, captions, or caption style. Duplicate the frame to reuse a complete narrated scene, or use a canvas JSON backup to move it between installations.

Replacing a frame's template retains that frame's existing narration and captions. Recheck their timing against the new scene duration and layout, especially after changing the default caption position or size.

### Keep branding and subtitles clear

Supplied templates place the Siswa Juara logo at top left and `@siswajuaraofficial` at top right, as separate editable layers. Only those two brand marks occupy the top strip. Series badges, page numbers, text, artwork, and diagrams fit below it. Footer pills, website text, social icons, and dividers are removed from new template insertions to leave room for subtitles.

The same layout rule fits content above the default bottom caption band in portrait, story, square, and landscape frames, while keeping full background surfaces intact. Custom caption sizes, positions, and offsets may need manual adjustment. Existing saved canvases retain their layers and local edits; opening a canvas does not migrate its design. Portable saved/imported templates keep embedded branding when their pack is disconnected.

For creating pack files, see [preset authoring](../design-references/README.md). Keep `design-references/`: preparation, cutouts, text fitting, and validation use its source files.

## Place illustrations, images, and video

**Assets** has three sources: **Library** for the connected external pack, **My assets** for the canvas's stored assets, and **On canvas** for media already used in the design. Search by name or subject and filter pack categories.

Drag an asset to place it. Alternatively, click it and then click the canvas; Escape cancels pending placement. To replace an image while preserving its geometry, select one unlocked image slot before choosing an image, or drop the image onto the slot. Properties also offers image upload/replacement and library browsing.

Image identifiers can find matching library artwork. Edit **Identifier** or use **Use matching asset** in Properties. Matching uses subject, color, and facing; inspect the result before relying on it. Existing embedded artwork remains intact when reopening a design.

Import local video through **Elements → Video** or drop a supported file. In Properties, set the source start time and looping. **Green screen → Remove background** provides key color and edge controls; use the clip's actual background color and inspect edges over the final design background.

Video visuals play muted. To include their original sound, use **Narration → Music → Extract audio from …**; this adds a separate voice track. Review its start/end when you later move or trim the video layer. Prepared animation packs may contain silent clips, so extraction cannot create missing source sound.

Placed media embeds into the local document. Moving or disconnecting a pack does not break those saved elements. Use **Change folder** when a pack moves and **Refresh** on desktop after updating it; disconnecting removes the connection without deleting pack files. See [asset pack setup](../asset-packs/README.md).

## Add narration and matching captions

Narration belongs to the selected frame. Select its frame or a layer inside it, then open the right inspector's **Narration** tab. The tab is disabled without a frame. Clicking a narration/audio row in Timeline also opens the panel.

### Connect a voice account

Open **Setting → Audio**, add an ElevenLabs account name and API key, and enable it. **Refresh credits** reads the provider's actual account allowance and usage. If the key lacks permission to read credits, follow the returned permission message. Keys remain in local `config.json` and are excluded from canvas exports.

Return to the frame and choose **Voice account** and **Narration voice** (Default/Story/News, Male/Female; older drafts may still use Roger). The account selector chooses the billed account. **Check rotation** in Setting checks account selection and credits without generating speech; narration generation uses the account you explicitly choose in its panel. Soniox is reserved in configuration and is not a current narration option.

### Generate and review a voice clip

1. Write the **Script**, up to 5,000 characters. The draft saves with the frame; editing it does not regenerate existing audio. Write what should be spoken, rather than duplicating every visible label.
2. Confirm the **Voice account**. Enable **Matching captions** if you want editable subtitle cues from the generated speech timings.
3. Choose caption **Style** if needed: Classic, Bold yellow, or Dark box; set Top/Middle/Bottom, size, text color, and background. These settings apply to the frame's captions.
4. Click **Generate narration**. This sends the script to ElevenLabs and uses credits. Keep the page open until it finishes.
5. Listen using Timeline playback. Check wording, pronunciation, pacing, volume, and where the final word ends. Review generated captions before export.

Generation adds a voice clip at time zero and extends the frame when needed, up to the scene limit. Matching captions add editable cues; they are not ordinary text layers. The toggle controls caption creation for the next generation and does not hide or delete existing cues.

Generating again **adds another voice clip and more cues**. Remove or mute the previous clip and delete unwanted cues when replacing a take, or both takes can play together. Deleting a voice clip does not delete its captions. Changing caption style or correcting cue text needs no new generation.

Credits shown after a request are provider observations, not a fixed price estimate. Refresh them in Setting when needed. If a request is interrupted or its result is uncertain, check the provider history before submitting another paid request.

### Use your own recording or background music

Open **Narration → Music → Import audio**. The importer accepts MP3, WAV, M4A, OGG, and FLAC when the runtime can decode them; MP3 or WAV is a useful fallback. Imports initially use the Background music role, 20% volume, looping, and short fades. For a recording, change its role to **Voiceover** and turn off Loop. A Sound effect role is also available.

The expanded Music section provides full controls for every track, including generated voice clips:

| Control            | Meaning                                                    |
| ------------------ | ---------------------------------------------------------- |
| Start / End        | Placement in seconds within this frame                     |
| Trim source        | Seconds skipped at the beginning of the original recording |
| Volume / Mute      | Playback and export level; mute preserves the saved track  |
| Fade in / Fade out | Fade lengths in seconds                                    |
| Loop               | Repeat the remaining source between Start and End          |

Start moves the track in the scene; Trim source chooses where its source audio begins. Extending End does not stretch a recording or create additional speech. If a track extends beyond the frame duration, use **Extend frame to …** or increase scene duration in Animation. Keep music low enough to hear narration clearly and listen where adjacent scenes overlap.

**Export audio mix** saves the current frame's audible track mix as WAV. It works locally without a voice account. Audio tracks are frame-specific; add music to each scene where it should play.

### Edit, import, or transcribe captions

Expand **Captions** to edit cue text and Start/End values, preview a cue with its numbered button, delete it, or **Add caption at playhead**. Cue times are relative to this frame, beginning at zero. A cue whose end exceeds the current duration can extend the frame. Check that adjacent cues do not overlap unintentionally.

Under **Files & transcription**:

- **Import SRT** adds cues to the current frame; it does not replace existing cues. Remove an older set before importing a replacement.
- **Export SRT** saves the frame's captions and timings. SRT carries text and timing, not Genie's caption colors or placement.
- **Transcribe [track name]** sends that audio to ElevenLabs, uses credits, and adds editable cues. Choose the voice account, turn Loop off for that track, and set a two- or three-letter language code such as `id` or `en`, or leave it blank for automatic detection. Timings are mapped to the track's trim and placement.

After moving or trimming audio, recheck caption timings; the cues are separate saved data. Captions preview with scene playback and burn into MP4 output. To include captions in a still image, seek to an active cue and enable **Capture animation** during image export.

## Animate and time the scene

Select the **frame** and open **Animation** for scene Duration, Camera, and the outgoing Transition. Select an individual **layer** for its visibility interval, entrance, exit, continuous motion, text reveal, and keyframes. Supplied templates can be static or animated; inspect their settings instead of assuming every template has the same duration or motion.

Open **Timeline**, then play or scrub the scene. Layer clips can move and trim; diamonds are keyframes. Use the magnet to snap to the frame grid and nearby timing boundaries, or hold Alt during a timeline drag to move freely. Audio and caption rows open Narration for their detailed edits.

Choose **Edit canvas** when you want to return to the original editable layout. A layer can seem absent in animation preview simply because the playhead is outside its visibility interval. **Reduce animations in preview**, playback speed, and the preview range affect inspection; they do not change authored MP4 motion or restrict the exported sequence.

Set enough duration for the voice to finish and the final caption to be read. Transitions overlap scenes and shorten the sequence: two six-second scenes with a 0.5-second crossfade total 11.5 seconds. Speech near both scene edges can overlap too. Use a cut or move speech away from transition edges when needed. Reordering in Export determines the delivered scene order; dragging frames around the workspace is layout positioning.

See [animation and export reference](animation.md) for keyframes, effect composition, timeline shortcuts, and document fields.

## Export the finished result

Open **Export**, select frames from the current page, and use the ordering controls to arrange delivery. The dialog takes a snapshot when opened; close and reopen it after editing the canvas.

| Format | Result                                                                                               | Settings                                                      |
| ------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| PNG    | One image, or an ordered ZIP for multiple frames                                                     | 1×/2×/3× scale; optional transparent background               |
| JPG    | One image, or an ordered ZIP for multiple frames                                                     | Scale and image quality; transparent areas flatten onto white |
| MP4    | Selected frames as one H.264 sequence, with audible frame tracks mixed as AAC and captions burned in | Longest-side resolution, 24/30/60 fps, Standard/High quality  |

Still exports normally capture the original design, with any captions active at time zero. For a timed state, seek in Timeline before opening Export and enable **Capture animation at …**. PNG transparency removes the frame background; opaque shapes inside the design remain visible.

For MP4, preview the complete sequence with sound. Different aspect ratios fit inside the first selected frame's aspect ratio without cropping. Resolution is a maximum longest side; smaller original artwork is not enlarged except for rounding to codec-compatible dimensions. A 3840px setting cannot create detail missing from the source design.

Export waits for fonts and media. H.264 encoding must be available for the chosen settings; audible exports also require AAC support. Follow the error if the runtime cannot encode the selection, or try a lower resolution. Video export does not call a generation or publishing provider.

Desktop exports open the operating system's Save dialog; browser exports download locally. Check the completion message, which reports saved output, cancellation, or a write error. Exporting files does not publish them. For the separate provider submission flow, see [publishing and scheduling](social.md).

## Save, recover, and move your work

Edits save to the local library: SQLite on desktop and IndexedDB in the browser. Page and navigation changes preserve document edits. Undo/Redo applies to the current page editing session and resets when switching pages.

Use **Versions → Save current version** for a checkpoint of every page and frame in the canvas. The latest 20 versions are retained. Restoring first saves the current state, then restores that checkpoint. Versions stay local and are separate from Undo.

**Canvas settings → Export backup** saves the workspace's canvases, pages, versions, and embedded media as editable JSON. **Import backup** replaces the workspace; export your current workspace before importing another. The **Backup** button in Canvases also exports the complete workspace. Workspace JSON does not include provider keys, the external pack catalog, or the separate personal-template library; export personal templates individually or use a desktop library backup.

In **Setting → Storage**, **Save now / retry** flushes pending writes and **Create library backup** creates a desktop database snapshot, including personal templates and other local records. Keep independent backups before clearing browser data or moving installations. Follow [storage and recovery](storage.md) for locations and database restoration.

## Keyboard reference

These canvas shortcuts apply when focus is outside a text field. Use Ctrl on Windows/Linux and Cmd on macOS.

| Action                                  | Shortcut                                         |
| --------------------------------------- | ------------------------------------------------ |
| Play/pause                              | Space                                            |
| Pan / zoom                              | Shift+Space-drag or middle-drag / Ctrl/Cmd-wheel |
| Export                                  | Ctrl/Cmd-E                                       |
| Fit frame / 100%                        | Ctrl/Cmd+0 / Ctrl/Cmd+1                          |
| Nudge / nudge 10px                      | Arrow / Shift+Arrow                              |
| Multi-select / cycle overlapping layers | Shift-click / Alt-click                          |
| Copy / cut / paste / duplicate          | Ctrl/Cmd+C / X / V / D                           |
| Group / ungroup                         | Ctrl/Cmd+G / Ctrl/Cmd+Shift+G                    |
| Forward / backward                      | Ctrl/Cmd+] / Ctrl/Cmd+[                          |
| Front / back                            | Add Shift to the ordering shortcuts              |
| Undo / redo                             | Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y      |
| Delete / cancel active action           | Delete or Backspace / Escape                     |

When timeline tracks have focus, Space plays/pauses, arrows step the playhead, Shift+arrows step a second, Home/End jump, I/O set the preview range, and K adds a keyframe. A focused layer clip uses arrows to move selected clips instead. See [timeline controls](animation.md#timeline-and-inspector).

## Troubleshooting

| Symptom                                         | What to check                                                                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Templates are empty                             | Connect a pack containing template files. A media-only pack can supply illustrations without templates. Browser selections must be reconnected after reload.                         |
| Template cannot load or reports a size mismatch | Refresh/reconnect the prepared pack. Pack authors should rerun `presets:index` after manual JSON edits and regenerate previews after layout changes.                                 |
| Narration is disabled                           | Select a frame. Add and enable an ElevenLabs account, select it in Narration, and enter a nonempty script.                                                                           |
| Script changed but voice did not                | Draft edits do not change generated recordings. Generate a new take, then remove unwanted older clips and cues.                                                                      |
| Voice plays twice                               | Check for multiple generated voice tracks and overlapping tracks/scenes. Mute or delete the older take.                                                                              |
| Video has no sound                              | Add/extract its source audio as a frame track; check Mute, Volume, Start/End, source trim, and frame duration. Silent source clips have no extractable sound.                        |
| Captions are missing or doubled                 | Check cue times at the playhead, duplicate imported/generated cues, and whether the selected frame has the expected cues. Matching captions does not toggle existing cue visibility. |
| Layer is invisible or cannot be edited          | Check Layers visibility/lock, parent frame, clipping, and animation visibility at the current playhead; return to Edit canvas.                                                       |
| Export differs from the latest edits            | Reopen Export to refresh its document snapshot; check selected frames, order, and Capture animation.                                                                                 |
| Media/font export error                         | Reconnect needed files, allow the selected font to load, or embed local media. Remote images require access and CORS permission.                                                     |
| Save failed                                     | Use Setting → Storage → Save now / retry; keep an exported backup and follow the reported storage error.                                                                             |

## Practical limits

| Item                        | Current limit                                          |
| --------------------------- | ------------------------------------------------------ |
| Narration script            | 5,000 characters per frame draft                       |
| Audio import                | 25 MB per file; decoded source duration up to one hour |
| Audio tracks / caption cues | 32 tracks / 2,000 cues per frame                       |
| SRT import                  | 2 MB; cue times within ten minutes                     |
| Local video import          | 64 MB per file; runtime must decode the format         |
| Scene / complete MP4        | 0.1–600 seconds per scene / ten minutes per export     |
| Keyframes                   | 100 per layer                                          |
| Still image                 | 64 megapixels and 16,384 pixels per side               |
| Image ZIP / estimated MP4   | 256 MB per export                                      |

Large embedded media increases canvas and backup size. Keep editable JSON or library backups as well as final delivery files.

## Generate frames with AI

Choose **Generate** beside Export. Writing uses **Beam Free via OpenCode**. Install OpenCode 2 and connect OpenCode Go. With no service URL configured, Genie starts or reuses the local service when you generate. **Setting → AI generation** (also available in the dialog) supports an optional service URL, token, model override, and an explicit **Load models** check. Credentials stay in local config.json. See [AI setup and generation contract](ai-generation.md).

Write a creative brief and adjust each scene’s purpose, tone, length, and direction, with up to 10 scenes. OpenCode composes every scene from a blank frame using editable text, shapes, existing illustrations/animation clips, and typed teaching diagrams. The logo remains at top left, the username at top right, and captions below the content. There is no generation template picker. A connected asset pack is optional; only selected media is loaded and embedded.

New sequences include a closing scene. OpenCode designs its recap and CTA to match the topic; its visible destination must remain **siswajuara.com**. Remove/re-add it with the scene controls if needed.

**Generate frames** produces the story device, visual direction, scene compositions, choreography, narration scripts, and post details. Approve **Story**, compare the sample stills in **Look**, then review every scene in **Storyboard**. Edit layers, placement, diagrams, assets, transitions, timing, and copy before approving. **Animate** enables motion preview and adding frames; edits return to Storyboard review. Local preflight checks text fitting/overlap, bounds, and media loading before approval. No speech calls or canvas changes happen during review.

Optional voice generation uses the chosen ElevenLabs account and default/per-scene voices; matching captions come from speech timings. ElevenLabs character costs are shown only when reported by the provider. OpenCode’s current one-shot response supplies text, so Genie does not estimate writing token usage.

Narration that runs longer extends the frame and its scene-spanning content animations. Previously saved narrated frames with an empty animation tail are repaired when opened. Short-lived overlays keep their shorter timing. If speech generation fails, the review stays open; explicit retry reuses completed audio, or choose **Add without audio** to keep scripts for later.

Generated post details and frame IDs are saved in page metadata. Publish fills an empty composer from these details; **Use generated post details** copies them into an existing composer. Existing composer edits stay in place until you choose that action.

For educational material, describe the subject and learner level in the brief. Generate can compose editable learning/physics diagrams and LaTeX directly into any scene. **Elements → Learning diagram** also supplies geometry, numbers/data, and Indonesian-language diagrams for manual editing. See [the learning guide](learning.md).
