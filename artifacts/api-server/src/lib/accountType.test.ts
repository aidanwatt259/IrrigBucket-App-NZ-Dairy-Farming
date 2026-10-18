import test from "node:test";
import assert from "node:assert/strict";

import { parseAccountType, signupAccountType } from "./accountType";

test("parseAccountType accepts only farmer and consultant", () => {
  assert.equal(parseAccountType("farmer"), "farmer");
  assert.equal(parseAccountType("consultant"), "consultant");
  assert.equal(parseAccountType("admin"), null);
  assert.equal(parseAccountType(undefined), null);
  assert.equal(parseAccountType(1), null);
});

test("signupAccountType prefers the request, then metadata, then farmer", () => {
  assert.equal(signupAccountType("consultant", "farmer"), "consultant");
  assert.equal(signupAccountType(undefined, "consultant"), "consultant");
  assert.equal(signupAccountType("bogus", "bogus"), "farmer");
  assert.equal(signupAccountType(undefined, undefined), "farmer");
});
