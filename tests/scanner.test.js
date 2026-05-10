import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { scanProject } from "../src/core/scanner.js";

test(".gitignore missing is reported", async () => {
  const root = await fixture();
  await writeJson(root, "package.json", { scripts: {} });

  const result = await scanProject({ rootPath: root });

  assertHasFinding(result, "git.gitignore-missing");
});

test(".env tracked by git is reported", { skip: !gitAvailable() }, async () => {
  const root = await fixture();
  await fs.writeFile(path.join(root, ".env"), "OPENAI_API_KEY=example\n");
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["add", "-f", ".env"], { cwd: root, stdio: "ignore" });

  const result = await scanProject({ rootPath: root });

  assertHasFinding(result, "env.env-file-tracked");
});

test("package lock missing is reported", async () => {
  const root = await fixture();
  await fs.writeFile(path.join(root, ".gitignore"), "node_modules/\n.env\n.env.*\ndist/\nbuild/\n.next/\ncoverage/\n*.log\n*.sqlite\n*.db\n.DS_Store\n");
  await writeJson(root, "package.json", { scripts: { test: "node --test" } });

  const result = await scanProject({ rootPath: root });

  assertHasFinding(result, "dependencies.lockfile-missing");
});

test("express.json without limit is reported", async () => {
  const root = await fixture();
  await writeJson(root, "package.json", { dependencies: { express: "^4.18.0" } });
  const unsafeMiddlewareCall = "express." + "json()";
  await writeFile(root, "server.js", `import express from 'express';\nconst app = express();\napp.use(${unsafeMiddlewareCall});\n`);

  const result = await scanProject({ rootPath: root });

  assertHasFinding(result, "node.express-json-limit-missing");
});

test("raw SQL interpolation is reported", async () => {
  const root = await fixture();
  await writeFile(root, "db.js", "export async function load(db, id) {\n  return db.query(`SELECT * FROM users WHERE id = ${id}`);\n}\n");

  const result = await scanProject({ rootPath: root });

  assertHasFinding(result, "database.raw-sql-interpolation");
});

test("Electron nodeIntegration true is reported", async () => {
  const root = await fixture();
  await writeJson(root, "package.json", { dependencies: { electron: "^30.0.0" } });
  await writeFile(
    root,
    "main.js",
    "const { BrowserWindow } = require('electron');\nnew BrowserWindow({ webPreferences: { nodeIntegration: true, contextIsolation: true } });\n"
  );

  const result = await scanProject({ rootPath: root });

  assertHasFinding(result, "electron.node-integration-enabled");
});

test("Tauri broad allowlist is reported", async () => {
  const root = await fixture();
  await writeJson(root, "src-tauri/tauri.conf.json", {
    tauri: {
      allowlist: {
        all: true
      }
    }
  });

  const result = await scanProject({ rootPath: root });

  assertHasFinding(result, "tauri.dangerous-allowlist-or-capabilities");
});

async function fixture() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "itworksbut-"));
}

async function writeJson(root, relativePath, value) {
  await writeFile(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeFile(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content);
}

function assertHasFinding(result, checkId) {
  assert.equal(
    result.findings.some((finding) => finding.checkId === checkId),
    true,
    `Expected finding ${checkId}. Actual findings: ${result.findings.map((finding) => finding.checkId).join(", ")}`
  );
}

function gitAvailable() {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
