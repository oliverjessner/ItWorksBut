import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brewScriptPath = path.join(repoRoot, "scripts/publish-brew.js");
const publishScriptPath = path.join(repoRoot, "scripts/publish.js");
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));

test("brew publish script prints a Homebrew formula", () => {
  const output = execFileSync(process.execPath, [brewScriptPath, "--print"], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  assert.match(output, /class Itworksbut < Formula/);
  assert.match(output, new RegExp(`url "https://registry\\.npmjs\\.org/itworksbut/-/itworksbut-${escapeRegExp(packageJson.version)}\\.tgz"`));
  assert.match(output, /sha256 "[a-f0-9]{64}"/);
  assert.match(output, /bin\.install_symlink libexec\/"bin\/itworksbut"/);
});

test("publish script documents the one-command release flow", () => {
  const output = execFileSync(process.execPath, [publishScriptPath, "--help"], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  assert.match(output, /npm run publish/);
  assert.match(output, /npm whoami/);
  assert.match(output, /npm publish --ignore-scripts --access public/);
  assert.match(output, /Commit and push the Homebrew tap/);
});

function escapeRegExp(value) {
  return String(value).replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
