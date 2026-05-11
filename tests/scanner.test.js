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

test("secrets in logs are reported without printing secret values", async () => {
  const root = await fixture();
  await writeFile(root, "server.js", "process.env.JWT_SECRET = 'super-private-value';\nconsole.log(process.env.JWT_SECRET);\n");

  const result = await scanProject({ rootPath: root });
  const finding = getFinding(result, "secrets.secrets-in-logs");

  assert.equal(finding.severity, "high");
  assert.equal(finding.metadata.secretType, "JWT_SECRET");
  assert.doesNotMatch(JSON.stringify(finding), /super-private-value/);
});

test("weak JWT secret fallbacks are reported", async () => {
  const root = await fixture();
  await writeFile(
    root,
    "auth.js",
    "import jwt from 'jsonwebtoken';\nconst secret = process.env.JWT_SECRET || 'secret';\nexport function sign(payload) { return jwt.sign(payload, secret); }\n"
  );

  const result = await scanProject({ rootPath: root });

  assertHasFinding(result, "auth.jwt-secret-weak-or-fallback");
});

test("password storage without obvious hashing is reported", async () => {
  const root = await fixture();
  await writeFile(
    root,
    "users.js",
    "export async function register(req, prisma) {\n  return await prisma.user.create({ data: { email: req.body.email, password: req.body.password } });\n}\n"
  );

  const result = await scanProject({ rootPath: root });

  assertHasFinding(result, "auth.password-hashing-missing");
});

test("insecure session cookies are reported", async () => {
  const root = await fixture();
  await writeFile(root, "server.js", "export function login(req, res, token) {\n  res.cookie('session', token);\n}\n");

  const result = await scanProject({ rootPath: root });

  assertHasFinding(result, "cookies.insecure-session-cookie");
});

test("public upload directories are reported", async () => {
  const root = await fixture();
  await writeFile(root, "upload.js", "import multer from 'multer';\nexport const upload = multer({ dest: 'public/uploads' });\n");

  const result = await scanProject({ rootPath: root });

  assertHasFinding(result, "uploads.public-executable-upload");
});

test("webhook signature checks with parsed bodies are reported", async () => {
  const root = await fixture();
  await writeFile(
    root,
    "webhook.js",
    "export function handle(req) {\n  return stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_SECRET_KEY);\n}\n"
  );

  const result = await scanProject({ rootPath: root });

  assertHasFinding(result, "webhooks.missing-raw-body");
});

test("LLM output flowing into command execution is reported", async () => {
  const root = await fixture();
  await writeFile(
    root,
    "agent.js",
    "import { exec } from 'node:child_process';\nexport function run(completion) {\n  const aiOutput = completion.text;\n  exec(aiOutput);\n}\n"
  );

  const result = await scanProject({ rootPath: root });

  assertHasFinding(result, "llm.prompt-injection-risk");
});

test("child processes using request input are reported", async () => {
  const root = await fixture();
  await writeFile(
    root,
    "server.js",
    "import { exec } from 'node:child_process';\nexport function checkout(req) {\n  exec(`git checkout ${req.query.branch}`);\n}\n"
  );

  const result = await scanProject({ rootPath: root });

  assertHasFinding(result, "node.child-process-user-input");
});

test("production source maps are reported when enabled in config", async () => {
  const root = await fixture();
  await writeFile(root, "vite.config.js", "export default { build: { sourcemap: true } };\n");

  const result = await scanProject({ rootPath: root });

  assertHasFinding(result, "frontend.sourcemaps-production");
});

test("debug flags in production config are reported", async () => {
  const root = await fixture();
  await writeFile(root, "config/production.js", "export default { debug: true };\n");

  const result = await scanProject({ rootPath: root });
  const finding = getFinding(result, "config.debug-production");

  assert.equal(finding.severity, "high");
});

test("new checks can be disabled through config", async () => {
  const root = await fixture();
  await writeFile(root, "server.js", "export function login(req, res, token) {\n  res.cookie('session', token);\n}\n");
  await writeJson(root, "itworksbut.config.json", {
    checks: {
      "cookies.insecure-session-cookie": false
    }
  });

  const result = await scanProject({ rootPath: root });

  assert.equal(result.findings.some((finding) => finding.checkId === "cookies.insecure-session-cookie"), false);
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

function getFinding(result, checkId) {
  const finding = result.findings.find((candidate) => candidate.checkId === checkId);
  assert.ok(
    finding,
    `Expected finding ${checkId}. Actual findings: ${result.findings.map((candidate) => candidate.checkId).join(", ")}`
  );
  return finding;
}

function gitAvailable() {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
