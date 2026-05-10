const REQUIRED_ENTRIES = [
  "node_modules/",
  ".env",
  ".env.*",
  "dist/",
  "build/",
  ".next/",
  "coverage/",
  "*.log",
  "*.sqlite",
  "*.db",
  ".DS_Store"
];

export default {
  id: "git.gitignore-incomplete",
  title: ".gitignore should cover common generated and secret files",
  category: "git",
  severity: "medium",
  tags: ["git", "repo-hygiene", "secrets"],
  run: async (context) => {
    const content = await context.readFileSafe(".gitignore");
    if (!content) return [];

    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"));

    const missing = REQUIRED_ENTRIES.filter((entry) => !hasEquivalentEntry(lines, entry));
    if (missing.length === 0) return [];

    return [
      {
        message: `.gitignore appears to be missing common entries: ${missing.join(", ")}.`,
        file: ".gitignore",
        recommendation: "Add the missing ignore patterns so local secrets, dependencies, logs, databases, and build output are not committed.",
        metadata: { missing }
      }
    ];
  }
};

function hasEquivalentEntry(lines, entry) {
  const variants = new Set([entry, entry.replace(/\/$/, ""), entry.endsWith("/") ? `${entry}**` : entry]);
  return lines.some((line) => variants.has(line));
}
