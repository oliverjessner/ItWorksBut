import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(repoRoot, "scripts/publish-brew.js");

test("brew publish script prints a Homebrew formula", () => {
  const output = execFileSync(process.execPath, [scriptPath, "--print"], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  assert.match(output, /class Itworksbut < Formula/);
  assert.match(output, /url "https:\/\/registry\.npmjs\.org\/itworksbut\/-\/itworksbut-0\.1\.0\.tgz"/);
  assert.match(output, /sha256 "[a-f0-9]{64}"/);
  assert.match(output, /bin\.install_symlink libexec\/"bin\/itworksbut"/);
});
