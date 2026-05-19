import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { detectOutdatedPackageManager, getOutdatedCommand } from "../../utils/packageManager.js";

const execFileAsync = promisify(execFile);
const CHECK_ID = "dependencies.outdated-packages";
const CHECK_TITLE = "Outdated packages";
const COMMAND_TIMEOUT_MS = 30_000;
const COMMAND_MAX_BUFFER = 10 * 1024 * 1024;

export default {
  id: CHECK_ID,
  title: CHECK_TITLE,
  category: "dependencies",
  severity: "info",
  tags: ["dependencies", "maintenance"],
  run: async (context) => {
    const result = await runOutdatedPackagesCheck(context);
    return { findings: [], result };
  }
};

export async function runOutdatedPackagesCheck(context, options = {}) {
  const detected = detectOutdatedPackageManager({
    packageJson: context.packageJson,
    files: context.allFiles
  });

  if (detected.status === "skip") {
    return checkResult({
      status: "skip",
      summary: detected.summary,
      metadata: { reason: "missing-package-json" }
    });
  }

  const commandResult = await runOutdatedCommand(detected.manager, context.rootPath, options);
  if (isMissingCommand(commandResult)) {
    return checkResult({
      status: "fail",
      summary: `${detected.manager} is not installed or could not be found.`,
      details: [
        {
          message: `${detected.manager} is not installed or could not be found.`,
          command: renderCommand(commandResult),
          exitCode: commandResult.exitCode
        }
      ],
      metadata: { packageManager: detected.manager }
    });
  }

  const parsed = parseOutdatedOutput(detected.manager, commandResult.stdout, context.packageJson);
  if (!parsed.ok) {
    if (!hasCommandFailure(commandResult) && isEmptyOutput(commandResult.stdout)) {
      return checkResult({
        status: "pass",
        summary: "all dependencies are up to date",
        details: [],
        metadata: { packageManager: detected.manager }
      });
    }

    return checkResult({
      status: "fail",
      summary: `${detected.manager} outdated returned output that could not be parsed.`,
      details: [
        {
          message: parsed.error,
          command: renderCommand(commandResult),
          exitCode: commandResult.exitCode,
          stderr: trimText(commandResult.stderr)
        }
      ],
      metadata: { packageManager: detected.manager }
    });
  }

  if ((hasCommandFailure(commandResult) || hasEmptyExitOneFailure(commandResult)) && parsed.packages.length === 0) {
    return checkResult({
      status: "fail",
      summary: `${detected.manager} outdated failed.`,
      details: [
        {
          message: trimText(commandResult.stderr) || "Command exited with code " + commandResult.exitCode + ".",
          command: renderCommand(commandResult),
          exitCode: commandResult.exitCode
        }
      ],
      metadata: { packageManager: detected.manager }
    });
  }

  if (parsed.packages.length === 0) {
    return checkResult({
      status: "pass",
      summary: "all dependencies are up to date",
      details: [],
      metadata: { packageManager: detected.manager }
    });
  }

  return checkResult({
    status: "warn",
    summary: `${parsed.packages.length} ${parsed.packages.length === 1 ? "package" : "packages"} outdated`,
    details: parsed.packages,
    metadata: { packageManager: detected.manager }
  });
}

export async function runOutdatedCommand(manager, rootPath, options = {}) {
  const runCommand = options.runCommand || execCommand;
  const { command, args } = getOutdatedCommand(manager);
  return await runCommand(command, args, { cwd: rootPath });
}

export function parseOutdatedOutput(manager, stdout, packageJson = {}) {
  const output = String(stdout || "").trim();
  if (!output) return { ok: true, packages: [] };

  try {
    if (manager === "yarn") {
      return { ok: true, packages: parseYarnOutput(output, packageJson) };
    }

    const parsed = JSON.parse(output);
    return { ok: true, packages: normalizeOutdatedData(parsed, packageJson) };
  } catch (error) {
    return {
      ok: false,
      packages: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function normalizeOutdatedData(data, packageJson = {}) {
  if (!data || typeof data !== "object") return [];

  if (Array.isArray(data)) {
    return data
      .map((entry) => normalizePackageEntry(entry.name || entry.package, entry, packageJson))
      .filter(Boolean);
  }

  return Object.entries(data)
    .map(([name, entry]) => normalizePackageEntry(name, entry, packageJson))
    .filter(Boolean);
}

async function execCommand(command, args, options) {
  try {
    const result = await execFileAsync(command, args, {
      cwd: options.cwd,
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: COMMAND_MAX_BUFFER
    });
    return {
      command,
      args,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      exitCode: 0
    };
  } catch (error) {
    return {
      command,
      args,
      stdout: error?.stdout || "",
      stderr: error?.stderr || error?.message || "",
      exitCode: error?.code ?? null,
      signal: error?.signal,
      error
    };
  }
}

function parseYarnOutput(output, packageJson) {
  const directJson = tryJson(output);
  if (directJson.ok) {
    if (directJson.value?.type === "table") return parseYarnTable(directJson.value.data, packageJson);
    return normalizeOutdatedData(directJson.value, packageJson);
  }

  const records = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => tryJson(line))
    .filter((record) => record.ok)
    .map((record) => record.value);

  const tableRecord = records.find((record) => record?.type === "table" && record.data);
  if (tableRecord) return parseYarnTable(tableRecord.data, packageJson);

  const packageRecords = records
    .filter((record) => record?.data && typeof record.data === "object")
    .map((record) => record.data);
  if (packageRecords.length > 0) return normalizeOutdatedData(packageRecords, packageJson);

  throw new Error("No parseable Yarn outdated JSON records were found.");
}

function parseYarnTable(data, packageJson) {
  const head = Array.isArray(data?.head) ? data.head.map((value) => String(value).toLowerCase()) : [];
  const body = Array.isArray(data?.body) ? data.body : [];

  return body.map((row) => {
    const entry = {
      name: row[indexOf(head, "package", 0)],
      current: row[indexOf(head, "current", 1)],
      wanted: row[indexOf(head, "wanted", 2)],
      latest: row[indexOf(head, "latest", 3)],
      type: row[indexOf(head, "package type", 4)]
    };
    return normalizePackageEntry(entry.name, entry, packageJson);
  }).filter(Boolean);
}

function normalizePackageEntry(name, entry, packageJson) {
  if (!name || !entry || typeof entry !== "object") return null;

  const current = stringValue(entry.current ?? entry.installed ?? entry.version);
  const wanted = stringValue(entry.wanted ?? entry.latest);
  const latest = stringValue(entry.latest ?? entry.wanted);

  if (!current && !wanted && !latest) return null;

  return {
    name: String(name),
    current: current || "unknown",
    wanted: wanted || "unknown",
    latest: latest || "unknown",
    type: stringValue(entry.type ?? entry.dependencyType ?? entry.packageType) || inferDependencyType(name, packageJson)
  };
}

function inferDependencyType(name, packageJson = {}) {
  if (Object.hasOwn(packageJson.dependencies || {}, name)) return "dependencies";
  if (Object.hasOwn(packageJson.devDependencies || {}, name)) return "devDependencies";
  if (Object.hasOwn(packageJson.peerDependencies || {}, name)) return "peerDependencies";
  if (Object.hasOwn(packageJson.optionalDependencies || {}, name)) return "optionalDependencies";
  return "dependencies";
}

function checkResult(result) {
  return {
    id: CHECK_ID,
    title: CHECK_TITLE,
    category: "dependencies",
    details: [],
    ...result
  };
}

function hasCommandFailure(result) {
  return result.exitCode !== 0 && result.exitCode !== 1;
}

function hasEmptyExitOneFailure(result) {
  return result.exitCode === 1 && isEmptyOutput(result.stdout) && !isEmptyOutput(result.stderr);
}

function isMissingCommand(result) {
  return result.exitCode === "ENOENT" || result.error?.code === "ENOENT";
}

function isEmptyOutput(value) {
  return String(value || "").trim() === "";
}

function renderCommand(result) {
  return [result.command, ...(result.args || [])].filter(Boolean).join(" ");
}

function trimText(value) {
  const normalized = String(value || "").trim();
  return normalized.length > 1000 ? `${normalized.slice(0, 1000)}...` : normalized;
}

function tryJson(value) {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false, value: null };
  }
}

function indexOf(head, name, fallback) {
  const index = head.indexOf(name);
  return index === -1 ? fallback : index;
}

function stringValue(value) {
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}
