import assert from "node:assert/strict";
import { test } from "node:test";
import { createArtilleryConfig } from "../src/stress/stressConfig.js";

test("stress config includes target, duration, arrival rate, and max virtual users", () => {
  const config = createArtilleryConfig({
    target: "http://localhost:3000",
    duration: 30,
    arrivalRate: 5,
    maxVusers: 50,
    endpoints: [{ method: "GET", path: "/api/health" }]
  });

  assert.equal(config.config.target, "http://localhost:3000");
  assert.deepEqual(config.config.phases[0], {
    duration: 30,
    arrivalRate: 5,
    maxVusers: 50
  });
});

test("stress config includes only provided safe GET and HEAD endpoints", () => {
  const config = createArtilleryConfig({
    target: "http://localhost:3000",
    duration: 30,
    arrivalRate: 5,
    maxVusers: 50,
    endpoints: [
      { method: "GET", path: "/api/health" },
      { method: "HEAD", path: "/api/ping" }
    ]
  });

  assert.deepEqual(config.scenarios[0].flow, [
    { get: { url: "/api/health" } },
    { head: { url: "/api/ping" } }
  ]);
  assert.equal(JSON.stringify(config).includes("/api/users"), false);
  assert.equal(JSON.stringify(config).includes(":id"), false);
});
