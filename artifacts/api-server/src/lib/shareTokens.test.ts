import assert from "node:assert/strict";
import { test } from "node:test";

import { generateShareToken, isShareToken, shareUrl } from "./shareTokens";

test("generated tokens are URL-safe and unique", () => {
  const a = generateShareToken();
  const b = generateShareToken();
  assert.equal(a.length, 24);
  assert.notEqual(a, b);
  assert.ok(isShareToken(a));
});

test("isShareToken rejects junk", () => {
  assert.equal(isShareToken(""), false);
  assert.equal(isShareToken("short"), false);
  assert.equal(isShareToken("has space in it xxxxxxx"), false);
  assert.equal(isShareToken("../../etc/passwd-xxxxxxx"), false);
  assert.equal(isShareToken(42), false);
});

test("shareUrl joins without double slashes", () => {
  assert.equal(shareUrl("https://app.example.nz/", "abc"), "https://app.example.nz/r/abc");
  assert.equal(shareUrl("https://app.example.nz", "abc"), "https://app.example.nz/r/abc");
});
