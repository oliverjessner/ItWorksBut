import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { loadConfig } from "../src/core/config.js";

test("default scan profile fails on low severity", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "itworksbut-config-"));

  const config = await loadConfig(root);

  assert.equal(config.failOn, "low");
  assert.deepEqual(config.checks, {});
});
