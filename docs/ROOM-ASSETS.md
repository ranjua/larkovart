# Room assets and generation prompts

Generated November 8, 2026 with the **built-in image_gen tool** (not CLI or a
runtime paid image-generation API). Saved in this repository:

- `public/rooms/sunlit-living.png` — 1536 × 1024
- `public/rooms/quiet-gallery.png` — 1536 × 1024
- `public/rooms/warm-reading.png` — 1536 × 1024

These are AI-generated photographic interior illustrations, not photographs of
a customer's actual room. The artwork is a separate original-image layer placed
by `src/components/room-scene.tsx`. No artwork was supplied to the image model.
Room previews do not crop or color-correct the artwork; frame and scale are
illustrative. Wall coordinates were checked against the generated images.

## Final prompt: sunlit living

Photorealistic high-end interior architectural photograph, wide landscape 3:2 composition. A beautiful sunlit contemporary living room with pale ivory plaster wall, low sculptural oatmeal sofa across bottom quarter, small travertine table lower right, linen curtains at far left, delicate olive tree at far right, natural oak floor. Straight-on camera perfectly perpendicular to the main wall, no keystone or skew. Large perfectly BLANK unobstructed wall in middle upper area, from x30% to70%, y12% to62%, for a real artwork composited later. No artwork, no frames, no wall decorations, no writing, no people. Luxurious authentic editorial interior photography, subtle natural textures, soft side daylight, physically real furniture, not CGI, not illustration. Save project asset background.

## Final prompt: quiet gallery

Photorealistic architectural photograph of an exquisite contemporary art gallery interior, landscape 3:2 composition, front-on camera perpendicular to main wall. Pale cool off-white gallery wall occupies upper 78%, warm limestone floor bottom, refined dark walnut low gallery bench at lower center, a very subtle architectural doorway far right. Beautiful natural skylight, museum-quality atmosphere, understated luxurious editorial photography. Main wall completely BLANK clear and unobstructed center between x28% and72%, y12% and64% for compositing a real artwork later. No artwork or frames anywhere, no posters, no writing, no people, no CGI look, no illustrations.

## Final prompt: warm reading

Photorealistic luxury editorial architectural photograph, landscape 3:2 composition. Warm sophisticated reading room, straight-on view of a muted warm sand plaster wall with rich walnut cabinetry confined to the far left edge, sculptural dark caramel leather lounge chair bottom left, soft ivory rug and low dark wood table bottom right, branch in ceramic vase far right. Late afternoon warm natural side light. Main central wall fully BLANK between x30% and72%, y10% and65%, no artwork, no frame, no decorations in this area. Camera perpendicular to wall for later flat artwork compositing. Elegant real apartment, refined material detail and realistic photographic texture, no text, no logos, no people, not a rendering.
