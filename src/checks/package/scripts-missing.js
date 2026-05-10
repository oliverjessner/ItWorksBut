const REQUIRED_GROUPS = [
  { label: "test", names: ["test"] },
  { label: "lint", names: ["lint"] },
  { label: "build", names: ["build"] },
  { label: "start or dev", names: ["start", "dev"] },
  { label: "check", names: ["check"] }
];

export default {
  id: "package.scripts-missing",
  title: "package.json should expose standard project scripts",
  category: "package",
  severity: "low",
  tags: ["node", "ci", "developer-experience"],
  run: async (context) => {
    if (!context.packageJson) return [];
    const scripts = context.packageJson.scripts || {};
    const missing = REQUIRED_GROUPS.filter((group) => !group.names.some((name) => scripts[name])).map((group) => group.label);
    if (missing.length === 0) return [];

    return [
      {
        message: `package.json appears to be missing standard scripts: ${missing.join(", ")}.`,
        file: "package.json",
        recommendation: "Add predictable scripts so contributors and CI can run tests, linting, builds, startup, and aggregate checks consistently.",
        metadata: { missing }
      }
    ];
  }
};
