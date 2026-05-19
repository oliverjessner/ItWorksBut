export function detectOutdatedPackageManager({ packageJson, files = [] } = {}) {
  if (!packageJson) {
    return {
      status: "skip",
      manager: null,
      summary: "skipped, no package.json found"
    };
  }

  if (files.includes("pnpm-lock.yaml")) return packageManager("pnpm");
  if (files.includes("yarn.lock")) return packageManager("yarn");
  if (files.includes("package-lock.json")) return packageManager("npm");
  return packageManager("npm");
}

export function getOutdatedCommand(manager) {
  if (manager === "pnpm") return { command: "pnpm", args: ["outdated", "--json"] };
  if (manager === "yarn") return { command: "yarn", args: ["outdated", "--json"] };
  return { command: "npm", args: ["outdated", "--json"] };
}

function packageManager(manager) {
  return {
    status: "run",
    manager,
    ...getOutdatedCommand(manager)
  };
}
