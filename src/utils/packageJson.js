import path from "node:path";
import { readJsonSafe } from "./fs.js";

export async function readPackageJson(rootPath) {
  return await readJsonSafe(path.join(rootPath, "package.json"));
}

export function getAllDependencies(packageJson = {}) {
  return {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {}),
    ...(packageJson.peerDependencies || {}),
    ...(packageJson.optionalDependencies || {})
  };
}

export function hasDependency(packageJson, name) {
  return Object.hasOwn(getAllDependencies(packageJson), name);
}

export function hasDevDependency(packageJson, name) {
  return Object.hasOwn(packageJson?.devDependencies || {}, name);
}

export function detectPackageManager(packageJson, files) {
  if (packageJson?.packageManager) return packageJson.packageManager.split("@")[0];
  if (files.includes("pnpm-lock.yaml")) return "pnpm";
  if (files.includes("yarn.lock")) return "yarn";
  if (files.includes("package-lock.json")) return "npm";
  return "npm";
}
