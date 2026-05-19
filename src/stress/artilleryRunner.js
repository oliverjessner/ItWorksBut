import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { fileExists } from "../utils/fs.js";

const execFileAsync = promisify(execFile);
const TOOL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function runArtillery(config, options = {}) {
  if (options.execute) return await options.execute(config, options);

  const rootPath = options.rootPath || process.cwd();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "itworksbut-stress-"));
  const configPath = path.join(tempDir, "artillery-config.json");
  const outputPath = path.join(tempDir, "artillery-report.json");
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const { command, args } = await resolveArtilleryCommand(rootPath, configPath, outputPath);
  const timeout = Math.max(90_000, ((options.duration || 30) + 60) * 1000);

  try {
    const result = await execFileAsync(command, args, {
      cwd: rootPath,
      timeout,
      maxBuffer: 10 * 1024 * 1024
    });
    return {
      ok: true,
      command,
      args,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      exitCode: 0,
      report: await readJsonFile(outputPath)
    };
  } catch (error) {
    return {
      ok: false,
      command,
      args,
      stdout: error?.stdout || "",
      stderr: error?.stderr || error?.message || "",
      exitCode: error?.code ?? null,
      signal: error?.signal,
      report: await readJsonFile(outputPath)
    };
  }
}

async function resolveArtilleryCommand(rootPath, configPath, outputPath) {
  const binaryName = process.platform === "win32" ? "artillery.cmd" : "artillery";
  const toolBin = path.join(TOOL_ROOT, "node_modules", ".bin", binaryName);
  if (await fileExists(toolBin)) {
    return {
      command: toolBin,
      args: ["run", configPath, "--output", outputPath]
    };
  }

  const projectBin = path.join(rootPath, "node_modules", ".bin", binaryName);
  if (await fileExists(projectBin)) {
    return {
      command: projectBin,
      args: ["run", configPath, "--output", outputPath]
    };
  }

  return {
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    args: ["exec", "--yes", "artillery", "--", "run", configPath, "--output", outputPath]
  };
}

async function readJsonFile(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}
