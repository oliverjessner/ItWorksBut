#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const defaultTapPath = path.resolve(repoRoot, "..", "homebrew-tap");

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const packageJson = JSON.parse(await fsp.readFile(path.join(repoRoot, "package.json"), "utf8"));
  const packageName = packageJson.name;
  const version = packageJson.version;
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "itworksbut-brew-"));

  try {
    const packInfo = npmPack(tmpDir);
    const tarballPath = path.join(tmpDir, packInfo.filename);
    const sha256 = await sha256File(tarballPath);
    const formula = renderFormula({
      packageName,
      version,
      sha256,
      homepage: options.homepage || "https://github.com/oliverjessner/ItWorksBut"
    });

    if (options.print || options.dryRun) {
      process.stdout.write(formula);
      if (!formula.endsWith("\n")) process.stdout.write("\n");
    }

    if (options.print) return;

    const tapPath = path.resolve(options.tapPath || process.env.HOMEBREW_TAP_PATH || defaultTapPath);
    const formulaPath = path.join(tapPath, "Formula", "itworksbut.rb");

    if (options.dryRun) {
      process.stderr.write(`\nDry run. Formula target would be: ${formulaPath}\n`);
      return;
    }

    await ensureTapPath(tapPath);
    await fsp.mkdir(path.dirname(formulaPath), { recursive: true });
    await fsp.writeFile(formulaPath, formula);
    process.stdout.write(`Wrote ${formulaPath}\n`);

    if (options.commit || options.push) {
      run("git", ["add", "Formula/itworksbut.rb"], { cwd: tapPath });
      run("git", ["commit", "-m", `itworksbut ${version}`], { cwd: tapPath });
      process.stdout.write(`Committed Formula/itworksbut.rb in ${tapPath}\n`);
    }

    if (options.push) {
      run("git", ["push"], { cwd: tapPath });
      process.stdout.write("Pushed tap commit.\n");
    }
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const options = {
    tapPath: undefined,
    homepage: undefined,
    commit: false,
    push: false,
    print: false,
    dryRun: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--commit") options.commit = true;
    else if (arg === "--push") {
      options.push = true;
      options.commit = true;
    } else if (arg === "--print") options.print = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--tap-path") options.tapPath = readValue(argv, ++index, "--tap-path");
    else if (arg === "--homepage") options.homepage = readValue(argv, ++index, "--homepage");
    else if (arg.startsWith("--tap-path=")) options.tapPath = arg.slice("--tap-path=".length);
    else if (arg.startsWith("--homepage=")) options.homepage = arg.slice("--homepage=".length);
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

function npmPack(tmpDir) {
  const output = run("npm", ["pack", "--json", "--pack-destination", tmpDir], { cwd: repoRoot });
  const parsed = JSON.parse(output);
  if (!Array.isArray(parsed) || !parsed[0]?.filename) {
    throw new Error("npm pack did not return tarball metadata.");
  }
  return parsed[0];
}

async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

async function ensureTapPath(tapPath) {
  const gitDir = path.join(tapPath, ".git");
  if (!fs.existsSync(gitDir)) {
    throw new Error(`Homebrew tap path is not a git checkout: ${tapPath}`);
  }
}

function renderFormula({ packageName, version, sha256, homepage }) {
  const tarballName = `${packageName}-${version}.tgz`;
  const url = `https://registry.npmjs.org/${packageName}/-/${tarballName}`;

  return `class Itworksbut < Formula
  desc "Static CI scanner for JavaScript vibe-coding project risks"
  homepage "${homepage}"
  url "${url}"
  sha256 "${sha256}"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec/"bin/itworksbut"
  end

  test do
    assert_match "ItWorksBut", shell_output("#{bin}/itworksbut --help")
  end
end
`;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"]
  });
}

function printUsage() {
  process.stdout.write(`Publish the ItWorksBut Homebrew formula.

Usage:
  node ./scripts/publish-brew.js [options]

Options:
  --tap-path <path>   Local checkout of oliverjessner/homebrew-tap.
                     Defaults to ../homebrew-tap or HOMEBREW_TAP_PATH.
  --homepage <url>    Formula homepage. Defaults to the ItWorksBut GitHub repo.
  --print             Print the generated formula to stdout and do not write.
  --dry-run           Print formula and target path without writing.
  --commit            Commit Formula/itworksbut.rb in the tap checkout.
  --push              Commit and push the tap checkout.
  --help              Show this help.

Release order:
  1. npm publish
  2. node ./scripts/publish-brew.js --tap-path ../homebrew-tap --commit
  3. cd ../homebrew-tap && git push
`);
}

main().catch((error) => {
  process.stderr.write(`publish-brew failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
