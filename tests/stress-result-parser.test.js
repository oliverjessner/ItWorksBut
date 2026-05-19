import assert from "node:assert/strict";
import { test } from "node:test";
import { parseArtilleryResult } from "../src/stress/stressResultParser.js";

const endpoints = [{ method: "GET", path: "/api/health" }];

test("stress result parser parses successful Artillery results", () => {
  const parsed = parseArtilleryResult(report({
    counters: {
      "http.requests": 150,
      "http.codes.200": 150
    },
    summaries: {
      "http.response_time": { p95: 42, p99: 80 }
    }
  }), endpoints);

  assert.equal(parsed.status, "pass");
  assert.equal(parsed.testedEndpoints[0].requests, 150);
  assert.equal(parsed.testedEndpoints[0].p95, 42);
  assert.equal(parsed.testedEndpoints[0].errors, 0);
});

test("stress result parser marks slow p95 and p99 as warning", () => {
  const parsed = parseArtilleryResult(report({
    counters: {
      "http.requests": 100,
      "http.codes.200": 100
    },
    summaries: {
      "http.response_time": { p95: 820, p99: 1300 }
    }
  }), endpoints);

  assert.equal(parsed.status, "warn");
  assert.equal(parsed.testedEndpoints[0].status, "warn");
});

test("stress result parser marks high error rates as failure", () => {
  const parsed = parseArtilleryResult(report({
    counters: {
      "http.requests": 100,
      "http.codes.200": 80,
      "http.errors.ETIMEDOUT": 20
    },
    summaries: {
      "http.response_time": { p95: 100, p99: 200 }
    }
  }), endpoints);

  assert.equal(parsed.status, "fail");
  assert.equal(parsed.testedEndpoints[0].status, "fail");
  assert.equal(parsed.testedEndpoints[0].errorRate, 20);
});

test("stress result parser handles Artillery errors robustly", () => {
  const parsed = parseArtilleryResult({
    ok: false,
    stderr: "connection refused",
    report: null
  }, endpoints);

  assert.equal(parsed.status, "fail");
  assert.match(parsed.summary, /parseable report/);
  assert.match(parsed.error, /connection refused/);
});

function report(aggregate) {
  return {
    ok: true,
    report: {
      aggregate
    }
  };
}
