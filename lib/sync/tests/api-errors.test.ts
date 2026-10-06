import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ApiError,
  ResponseParseError,
  isTransientApiError,
  isServerWakingError,
} from "../../api-client-react/src/custom-fetch.ts";

export function apiError(status: number, code?: string) {
  return new ApiError(new Response(null, { status }), code ? { code } : null, {
    method: "GET",
    url: "/api/reports",
  });
}

for (const status of [429, 500, 502, 503, 504, 599]) {
  test(`HTTP ${status} is transient`, () => {
    assert.equal(isTransientApiError(apiError(status)), true);
  });
}

for (const code of ["DB_NOT_READY", "SYNC_UNAVAILABLE"]) {
  test(`503 ${code} is transient and indicates server waking`, () => {
    const error = apiError(503, code);
    assert.equal(isTransientApiError(error), true);
    assert.equal(isServerWakingError(error), true);
  });
}

for (const status of [400, 401, 403, 404, 409, 422]) {
  test(`HTTP ${status} is not transient`, () => {
    assert.equal(isTransientApiError(apiError(status)), false);
    assert.equal(isServerWakingError(apiError(status)), false);
  });
}

test("network failures retry, but unrelated and malformed errors do not", () => {
  assert.equal(isTransientApiError(new TypeError("Failed to fetch")), true);
  const parseError = new ResponseParseError(
    new Response("invalid"), "invalid", new SyntaxError(),
    { method: "GET", url: "/api/reports" },
  );
  for (const error of [parseError, new Error("failure"), new SyntaxError(), null,
    undefined, "DB_NOT_READY", { status: 503 }, { name: "TypeError" }]) {
    assert.equal(isTransientApiError(error), false);
    assert.equal(isServerWakingError(error), false);
  }
  for (const error of [apiError(429), apiError(500), new TypeError()]) {
    assert.equal(isServerWakingError(error), false);
  }
});
