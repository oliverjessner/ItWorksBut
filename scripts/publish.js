#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const defaultTapPath = path.resolve(repoRoot, "..", "homebrew-tap");

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const tapPath = path.resolve(options.tapPath || process.env.HOMEBREW_TAP_PATH || defaultTapPath);

  if (!options.skipChecks) {
    step("test", "npm", ["test"]);
    step("build", "npm", ["run", "build"]);
    step("audit", "npm", ["audit", "--audit-level=high"]);
    step("self scan", "node", ["./bin/itworksbut.js", "scan", "--config", "itworksbut.self.config.json", "--no-banner", "--no-spinner", "--no-color", "--fail-on", "high"]);
  }

  if (!options.skipNpm) {
    const npmArgs = ["publish", "--ignore-scripts"];
    if (options.access) npmArgs.push("--access", options.access);
    if (options.tag) npmArgs.push("--tag", options.tag);
    if (options.dryRun) npmArgs.push("--dry-run");

    // package.json intentionally has an npm script named "publish".
    // --ignore-scripts prevents npm's publish lifecycle from re-entering this file.
    step(options.dryRun ? "npm publish dry run" : "npm publish", "npm", npmArgs);
  }

  if (!options.skipBrew) {
    const brewArgs = ["./scripts/publish-brew.js", "--tap-path", tapPath];
    if (options.dryRun) brewArgs.push("--dry-run");
    else brewArgs.push(options.noPush ? "--commit" : "--push");

    step(options.dryRun ? "brew formula dry run" : "brew formula", "node", brewArgs);
  }

  process.stdout.write(options.dryRun ? "\nDry run complete. Nothing was published.\n" : "\nPublished npm package and Homebrew tap.\n");
}

function parseArgs(argv) {
  const options = {
    tapPath: undefined,
    dryRun: false,
    noPush: false,
    skipChecks: false,
    skipNpm: false,
    skipBrew: false,
    access: "public",
    tag: undefined,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--no-push") options.noPush = true;
    else if (arg === "--skip-checks") options.skipChecks = true;
    else if (arg === "--skip-npm") options.skipNpm = true;
    else if (arg === "--skip-brew") options.skipBrew = true;
    else if (arg === "--tap-path") options.tapPath = readValue(argv, ++index, "--tap-path");
    else if (arg === "--access") options.access = readValue(argv, ++index, "--access");
    else if (arg === "--tag") options.tag = readValue(argv, ++index, "--tag");
    else if (arg.startsWith("--tap-path=")) options.tapPath = arg.slice("--tap-path=".length);
    else if (arg.startsWith("--access=")) options.access = arg.slice("--access=".length);
    else if (arg.startsWith("--tag=")) options.tag = arg.slice("--tag=".length);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function readValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function step(label, command, args) {
  process.stdout.write(`\n==> ${label}\n`);
  execFileSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit"
  });
}

function printUsage() {
  process.stdout.write(`Publish ItWorksBut to npm and Homebrew.

Usage:
  npm run publish
  npm run publish -- --dry-run

Default release flow:
  1. npm test
  2. npm run build
  3. npm audit --audit-level=high
  4. node ./bin/itworksbut.js scan --config itworksbut.self.config.json --fail-on high
  5. npm publish --ignore-scripts --access public
  6. Generate Formula/itworksbut.rb in the Homebrew tap
  7. Commit and push the Homebrew tap

Options:
  --dry-run          Run checks, npm publish --dry-run, and print the brew formula.
  --tap-path <path>  Local checkout of oliverjessner/homebrew-tap.
                    Defaults to ../homebrew-tap or HOMEBREW_TAP_PATH.
  --no-push          Commit the Homebrew formula but do not push the tap.
  --skip-checks      Skip test/build/audit/self-scan.
  --skip-npm         Skip npm publish.
  --skip-brew        Skip Homebrew formula update.
  --access <value>   npm publish access. Default: public.
  --tag <value>      npm dist-tag, for example beta.
  --help             Show this help.
`);
}

main();
