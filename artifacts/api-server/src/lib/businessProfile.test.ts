import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_LOGO_CHARS,
  normalizeProfile,
  profileFromColumns,
  profileToColumns,
} from "./businessProfile";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

test("normalizeProfile trims, collapses whitespace and blanks to null", () => {
  const result = normalizeProfile({
    businessName: "  AgWater   Consulting ",
    contactName: "",
    phone: null,
    email: "jo@agwater.nz",
    website: "agwater.nz",
    logo: PNG,
  });
  assert.ok(result.ok);
  assert.deepEqual(result.profile, {
    businessName: "AgWater Consulting",
    contactName: null,
    phone: null,
    email: "jo@agwater.nz",
    website: "agwater.nz",
    logo: PNG,
  });
});

test("normalizeProfile rejects bad input", () => {
  assert.equal(normalizeProfile(null).ok, false);
  assert.equal(normalizeProfile({ businessName: 42 }).ok, false);
  assert.equal(normalizeProfile({ businessName: "x".repeat(121) }).ok, false);
  assert.equal(normalizeProfile({ email: "not-an-email" }).ok, false);
  assert.equal(normalizeProfile({ logo: "https://evil.example/pixel.gif" }).ok, false);
  assert.equal(normalizeProfile({ logo: "data:image/svg+xml;base64,PHN2Zz4=" }).ok, false);
  assert.equal(normalizeProfile({ logo: `data:image/png;base64,${"A".repeat(MAX_LOGO_CHARS)}` }).ok, false);
});

test("an empty object is a valid, empty profile", () => {
  const result = normalizeProfile({});
  assert.ok(result.ok);
  assert.deepEqual(result.profile, {
    businessName: null,
    contactName: null,
    phone: null,
    email: null,
    website: null,
    logo: null,
  });
});

test("column mapping round-trips", () => {
  const profile = {
    businessName: "AgWater",
    contactName: "Jo",
    phone: "027",
    email: "jo@agwater.nz",
    website: null,
    logo: PNG,
  };
  assert.deepEqual(profileFromColumns(profileToColumns(profile)), profile);
  assert.equal(profileFromColumns(null).businessName, null);
  assert.equal(profileFromColumns({}).logo, null);
});
