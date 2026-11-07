# Photo upload and automatic publishing

The private `/studio` admin accepts a photo, title, medium, dimensions, year and
price (default USD 100). Publishing is checked by default; uncheck it to save a
draft. Descriptions can be left blank: factual title/material/size/year text is
filled automatically for all six languages. No AI text subscription is required.

## Connect once

1. Create a free Image and Video API account at https://cloudinary.com/users/register.
2. In Vercel → larkovart-dev → Settings → Environment Variables, add
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` from
   Cloudinary → Settings → API Keys. Select Preview; mark the secret Sensitive.
3. Tell the developer when saved. Redeploy and verify a real upload before claiming connected.

Never paste the secret into chat. Production needs the same variables when the
storefront is ready to launch there.

## Behavior and cost

Cloudinary's free API plan currently includes 25 shared monthly credits, no card
required. One credit covers 1,000 standard transformations OR 1 GB storage OR
1 GB image bandwidth. AI `e_enhance` adds 100 transformation units per new
derivative, in addition to normal processing. Thus 25 credits are NOT 25,000
AI enhancements; fewer than 250/month would fit even before storage and delivery.
No paid add-on or paid plan is subscribed by this integration. Monitor account
usage; free capacity is finite.

Signed direct browser uploads accept JPEG/PNG/WebP up to 10 MB, preserving the
original at Cloudinary. AI enhancement adjusts exposure, color and white balance;
it does not request generative repainting, background replacement or restoration.
Color appearance can still change. A link to the unedited original is displayed
on the artwork page in the selected language.

Eager processing completes before the admin receives the enhanced preview.
The save API verifies the provider receipt signature, constructs URLs only for
the configured cloud and checks the processed image exists before saving.
Failed processing cannot publish through this flow. Repeated save attempts retain
the same listing ID. Sold/reserved inventory is protected by the existing upsert.
Uploading a photo without saving still consumes provider storage/processing;
there is no automatic deletion of originals.

Without credentials, the admin clearly shows enhancement is disconnected and
allows original-photo uploads up to 3 MB. These are not described as enhanced.

Sources checked November 7, 2026:

- https://cloudinary.com/pricing
- https://cloudinary.com/documentation/transformation_reference#e_enhance
- https://cloudinary.com/documentation/transformation_counts
- https://cloudinary.com/documentation/image_upload_api_reference
