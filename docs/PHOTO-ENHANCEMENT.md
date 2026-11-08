# Original photos and room previews

The owner clarified on November 8 that artwork must be displayed as the original
photo, with realistic interior previews. Automatic color enhancement is disabled
for new uploads. Existing enhanced derivatives are retained but the preserved
original is preferred in every customer/admin display and the Meta feed.

In `/studio` → **Add artwork**, upload the photo, enter title, materials,
dimensions and price (default USD 100), then save. Publishing is checked by
default. Blank descriptions are filled with factual material/size/year text in
all six languages. Buyers see the original first and can choose three interiors.

Cloudinary stores JPEG/PNG/WebP originals up to 10 MB via signed direct browser
uploads. Server-side receipt verification and an existence check prevent saving
an unverified upload through that flow. The signed request does not include any
AI enhancement or color processing. Originals are not deleted automatically.
Without Cloudinary, local photo uploads up to 3 MB still work.

Room backgrounds are generated once with the built-in image-generation tool and
saved under `public/rooms/`. The app overlays the real photo in code; it does not
ask AI to repaint or reconstruct the artwork. Entered dimensions determine
approximate display size; perspective is front-on and the original aspect ratio
is preserved. The preview explains that the room, frame and scale are
illustrative. Sculptures remain original-photo-only until a dedicated sculpture
placement treatment is implemented.

There is no per-upload AI charge for room previews. Normal image hosting,
transformation and bandwidth limits still apply to Cloudinary and Vercel. No
paid add-on or paid subscription was purchased.

The Cloudinary variables are already configured in Preview, Production and
Development. Future configuration changes use Vercel environment settings,
never client source code. See `docs/ROOM-ASSETS.md` for asset prompts/provenance.
