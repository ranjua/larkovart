# Permanent artwork deletion

Studio → Collection → artwork → **Delete artwork**. A confirmation names the
work and makes clear that the catalog entry cannot be restored. Uploaded image
files are retained because other listings/social media can share them.

Deletion requires the existing administrator OTP session and a same-origin
DELETE request. The server checks the current title and all order records in a
write transaction. Any order state, including quote requests, canceled/expired
attempts and old orders beyond the Studio's 100-row display, prevents deletion.
Active reservations also block deletion. Ordered pieces may be unpublished with
**Visible in gallery** instead. Eligibility in the UI is a hint; the server
always checks again when the action runs.

The artwork row and JSON are physically removed. Shared-database favorites/cart
references for that ID are removed in the same transaction. Separate customer
stores can display a missing saved catalog ID as unavailable until removed.
Orders, payment sessions, fulfillment records, other artwork and uploaded source
files are not deleted. Social histories and remote posts are not deleted; existing
availability checks block publication for a missing original.

Only a retired ID and timestamp are kept to prevent cold-start seeding and stale
editors from resurrecting the listing. Database triggers protect ordered works
and ignore inserts using retired IDs, including from older deployments. Current
editors receive HTTP 410 when trying to save a deleted ID. Deletion retries are
idempotent. A new artwork receives a new generated ID.

## Confirmed duplicate removal — 2026-11-09

Deleted `work-21abbe9e-c969-4abc-be16-2f73c3e4be88` (duplicate **Atitlan**) from
the verified development database backing the existing Preview. It had zero
orders. Kept the original `atitlan`, which had two order records. Before/after
row hashes verified that all other artwork, orders, payment sessions and
fulfillment data were unchanged. The hosted catalog now contains five works and
one Atitlan listing. No Cloudinary file was deleted.

## Verification

83 Node tests, TypeScript and the optimized build pass. New tests cover hard
removal, saved-reference cleanup, safe retries, stale saves, cold-start seeding,
legacy upserts, all order states, records beyond the display limit, reservations,
title changes and checkout/deletion races. The isolated browser suite verifies
OTP authorization, CSRF, cancel/confirm, ordered-work disabled controls, hard
removal/404, stale-edit rejection and mobile Studio layout. No provider requests
or real email were sent in these fixtures.
