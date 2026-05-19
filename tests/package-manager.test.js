import assert from "node:assert/strict";
import { test } from "node:test";
import { detectOutdatedPackageManager } from "../src/utils/packageManager.js";

test("outdated package manager detection uses npm for package-lock.json", () => {
  const result = detectOutdatedPackageManager({
    packageJson: {},
    files: ["package.json", "package-lock.json"]
  });

  assert.equal(result.manager, "npm");
  assert.equal(result.command, "npm");
});

test("outdated package manager detection uses pnpm for pnpm-lock.yaml", () => {
  const result = detectOutdatedPackageManager({
    packageJson: {},
    files: ["package.json", "package-lock.json", "pnpm-lock.yaml"]
  });

  assert.equal(result.manager, "pnpm");
  assert.equal(result.command, "pnpm");
});

test("outdated package manager detection uses yarn for yarn.lock", () => {
  const result = detectOutdatedPackageManager({
    packageJson: {},
    files: ["package.json", "yarn.lock", "package-lock.json"]
  });

  assert.equal(result.manager, "yarn");
  assert.equal(result.command, "yarn");
});

test("outdated package manager detection falls back to npm with only package.json", () => {
  const result = detectOutdatedPackageManager({
    packageJson: {},
    files: ["package.json"]
  });

  assert.equal(result.manager, "npm");
  assert.equal(result.command, "npm");
});

test("outdated package manager detection skips without package.json", () => {
  const result = detectOutdatedPackageManager({
    packageJson: null,
    files: ["package-lock.json"]
  });

  assert.equal(result.status, "skip");
  assert.equal(result.manager, null);
  assert.equal(result.summary, "skipped, no package.json found");
});
