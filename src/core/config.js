import path from "node:path";
import { fileExists, readJsonSafe } from "../utils/fs.js";

export const SEVERITIES = ["critical", "high", "medium", "low", "info"];

export const DEFAULT_IGNORE = [
  "node_modules/**",
  "dist/**",
  "build/**",
  ".next/**",
  ".nuxt/**",
  "coverage/**",
  ".git/**",
  "target/**",
  "src-tauri/target/**",
  "out/**",
  "release/**",
  ".vite/**"
];

export async function loadConfig(rootPath, configPath, overrides = {}) {
  const resolvedConfigPath = configPath
    ? path.resolve(rootPath, configPath)
    : path.join(rootPath, "itworksbut.config.json");

  let userConfig = {};
  if (await fileExists(resolvedConfigPath)) {
    userConfig = await readJsonSafe(resolvedConfigPath);
    if (!userConfig || typeof userConfig !== "object" || Array.isArray(userConfig)) {
      throw new Error(`Invalid config JSON: ${resolvedConfigPath}`);
    }
  }

  const failOn = normalizeSeverity(overrides.failOn || userConfig.failOn || "high");

  return {
    ignore: [...DEFAULT_IGNORE, ...(Array.isArray(userConfig.ignore) ? userConfig.ignore : [])],
    failOn,
    checks: userConfig.checks && typeof userConfig.checks === "object" ? userConfig.checks : {},
    configPath: await fileExists(resolvedConfigPath) ? resolvedConfigPath : null
  };
}

export function normalizeSeverity(value) {
  if (!value) return "high";
  const normalized = String(value).toLowerCase();
  if (!SEVERITIES.includes(normalized)) {
    throw new Error(`Invalid severity "${value}". Expected one of: ${SEVERITIES.join(", ")}`);
  }
  return normalized;
}
