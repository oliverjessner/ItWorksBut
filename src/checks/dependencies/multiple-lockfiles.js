const LOCKFILES = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"];

export default {
  id: "dependencies.multiple-lockfiles",
  title: "Only one JavaScript package lockfile should be committed",
  category: "dependencies",
  severity: "medium",
  tags: ["dependencies", "reproducibility", "ci"],
  run: async (context) => {
    const present = LOCKFILES.filter((file) => context.allFiles.includes(file));
    if (present.length <= 1) return [];

    return [
      {
        message: `Multiple package lockfiles were found: ${present.join(", ")}.`,
        recommendation: "Keep the lockfile for the package manager used by the project and remove the others.",
        metadata: { lockfiles: present }
      }
    ];
  }
};
