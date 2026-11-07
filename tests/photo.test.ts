import { test } from "node:test";
import assert from "node:assert/strict";
import {
  photoConfigured,
  photoSignature,
  photoUrls,
  isPhotoUrl,
} from "../src/lib/photo.ts";

test("photo receipts reject forged uploads and URLs outside our cloud", () => {
  const keys = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];
  const previous = keys.map((k) => process.env[k]);
  try {
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    assert.equal(photoConfigured(), true);
    const receipt = {
      public_id: "larkovart/12345678-1234-1234-1234-123456789abc",
      version: 123,
      signature: "",
    };
    receipt.signature = photoSignature({
      public_id: receipt.public_id,
      version: "123",
    });
    const urls = photoUrls(receipt);
    assert.ok(isPhotoUrl(urls.image));
    assert.ok(isPhotoUrl(urls.originalImage));
    assert.ok(urls.image.includes("e_enhance"));
    assert.ok(!urls.originalImage.includes("e_enhance"));
    assert.throws(() => photoUrls({ ...receipt, version: 124 }));
    assert.throws(() => photoUrls({ ...receipt, public_id: "other/asset" }));
    assert.throws(() => photoUrls({ ...receipt, signature: "bad" }));
    assert.equal(
      isPhotoUrl(urls.image.replace("test-cloud", "other-cloud")),
      false,
    );
    assert.equal(isPhotoUrl(urls.image + "?redirect=bad"), false);
    assert.equal(isPhotoUrl("https://example.com/picture.jpg"), false);
    delete process.env.CLOUDINARY_API_SECRET;
    assert.equal(photoConfigured(), false);
    assert.throws(() => photoUrls(receipt));
  } finally {
    keys.forEach((k, i) => {
      if (previous[i] === undefined) delete process.env[k];
      else process.env[k] = previous[i];
    });
  }
});
