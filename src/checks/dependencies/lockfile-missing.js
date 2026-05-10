const LOCKFILES = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"];

export default {
  id: "dependencies.lockfile-missing",
  title: "Package lockfile should be committed",
  category: "dependencies",
  severity: "medium",
  tags: ["dependencies", "reproducibility", "ci"],
  run: async (context) => {
    if (!context.packageJson) return [];
    if (LOCKFILES.some((file) => context.allFiles.includes(file))) return [];

    return [
      {
        message: "package.json exists, but no package-lock.json, pnpm-lock.yaml, or yarn.lock was found.",
        file: "package.json",
        recommendation: "Commit exactly one lockfile so local and CI installs resolve the same dependency graph."
      }
    ];
  }
};
