import { matchesAnyGlob } from "../../utils/path.js";
import { isEnvExampleFile } from "../helpers.js";

const RISKY_TRACKED_PATTERNS = [
  ".env",
  ".env.*",
  "node_modules/**",
  "dist/**",
  "build/**",
  ".next/**",
  "coverage/**",
  "*.sqlite",
  "*.db",
  "*.log"
];

export default {
  id: "git.ignored-files-tracked",
  title: "Ignored files should not be tracked by git",
  category: "git",
  severity: "high",
  tags: ["git", "repo-hygiene", "secrets"],
  run: async (context) => {
    if (!context.gitAvailable) return [];

    const candidates = new Set(context.gitIgnoredTrackedFiles || []);
    for (const file of context.gitTrackedFiles) {
      if (isEnvExampleFile(file)) continue;
      if (matchesAnyGlob(file, RISKY_TRACKED_PATTERNS)) candidates.add(file);
    }

    return [...candidates].slice(0, 50).map((file) => ({
      message: `${file} appears to be tracked even though it matches an ignore or high-risk generated-file pattern.`,
      file,
      recommendation: "Remove generated or local-only files from git with git rm --cached, then commit the corrected .gitignore."
    }));
  }
};
