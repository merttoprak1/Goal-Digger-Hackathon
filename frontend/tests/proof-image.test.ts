import { test } from "node:test";
import assert from "node:assert/strict";
import { validateImageSelection } from "../app/lib/proof-image.ts";

test("accepts supported images within the byte and pixel limits", () => {
  assert.equal(validateImageSelection({ type: "image/jpeg", size: 1024, width: 6000, height: 6000 }), undefined);
  assert.equal(validateImageSelection({ type: "image/png", size: 5 * 1024 * 1024, width: 1, height: 1 }), undefined);
  assert.equal(validateImageSelection({ type: "image/webp", size: 10, width: 100, height: 100 }), undefined);
});

test("rejects unsupported MIME type, oversized file, and oversized dimensions", () => {
  assert.throws(() => validateImageSelection({ type: "image/svg+xml", size: 10, width: 1, height: 1 }), /JPEG, PNG, or WebP/i);
  assert.throws(() => validateImageSelection({ type: "image/png", size: 5 * 1024 * 1024 + 1, width: 1, height: 1 }), /5 MiB/i);
  assert.throws(() => validateImageSelection({ type: "image/png", size: 10, width: 7000, height: 6000 }), /40 megapixels/i);
});
