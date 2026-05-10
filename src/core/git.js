import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { normalizeRelativePath } from "../utils/path.js";

const execFileAsync = promisify(execFile);

export async function collectGitInfo(rootPath) {
  const gitAvailable = await isInsideGitWorkTree(rootPath);
  if (!gitAvailable) {
    return {
      available: false,
      trackedFiles: [],
      ignoredFiles: [],
      ignoredTrackedFiles: [],
      statusShort: []
    };
  }

  const [trackedFiles, ignoredFiles, ignoredTrackedFiles, statusShort] = await Promise.all([
    gitLsFiles(rootPath, []),
    gitLsFiles(rootPath, ["--others", "-i", "--exclude-standard"]),
    gitLsFiles(rootPath, ["-ci", "--exclude-standard"]),
    gitStatusShort(rootPath)
  ]);

  return {
    available: true,
    trackedFiles,
    ignoredFiles,
    ignoredTrackedFiles,
    statusShort
  };
}

export async function checkIgnored(rootPath, files) {
  const ignored = new Set();
  const candidates = files.filter(Boolean);
  for (let index = 0; index < candidates.length; index += 100) {
    const chunk = candidates.slice(index, index + 100);
    const result = await runGit(rootPath, ["check-ignore", "--no-index", "-z", "--", ...chunk], [0, 1]);
    if (result.stdout) {
      for (const file of parseNullSeparated(result.stdout)) ignored.add(file);
    }
  }
  return [...ignored];
}

async function isInsideGitWorkTree(rootPath) {
  const result = await runGit(rootPath, ["rev-parse", "--is-inside-work-tree"], [0, 128]);
  return result.exitCode === 0 && result.stdout.trim() === "true";
}

async function gitLsFiles(rootPath, args) {
  const result = await runGit(rootPath, ["ls-files", "-z", ...args], [0]);
  return parseNullSeparated(result.stdout);
}

async function gitStatusShort(rootPath) {
  const result = await runGit(rootPath, ["status", "--short"], [0]);
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

async function runGit(rootPath, args, allowedExitCodes) {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd: rootPath,
      encoding: "buffer",
      maxBuffer: 10 * 1024 * 1024
    });
    return { exitCode: 0, stdout: stdout.toString("utf8"), stderr: stderr.toString("utf8") };
  } catch (error) {
    const exitCode = typeof error.code === "number" ? error.code : 1;
    if (allowedExitCodes.includes(exitCode)) {
      return {
        exitCode,
        stdout: Buffer.isBuffer(error.stdout) ? error.stdout.toString("utf8") : String(error.stdout || ""),
        stderr: Buffer.isBuffer(error.stderr) ? error.stderr.toString("utf8") : String(error.stderr || "")
      };
    }
    return { exitCode, stdout: "", stderr: error.message };
  }
}

function parseNullSeparated(output) {
  return output
    .split("\0")
    .filter(Boolean)
    .map((file) => normalizeRelativePath(file));
}
