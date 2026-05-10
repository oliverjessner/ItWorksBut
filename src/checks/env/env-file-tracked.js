import { isEnvExampleFile, isEnvFile } from "../helpers.js";

export default {
  id: "env.env-file-tracked",
  title: "Environment files must not be tracked",
  category: "env",
  severity: "critical",
  tags: ["secrets", "git", "node"],
  run: async (context) => {
    if (!context.gitAvailable) return [];

    return context.gitTrackedFiles
      .filter((file) => isEnvFile(file) && !isEnvExampleFile(file))
      .map((file) => ({
        message: `${file} appears to be tracked by git. Secrets may be exposed.`,
        file,
        recommendation: "Remove it from git with git rm --cached, rotate any exposed secrets, and commit .env.example instead."
      }));
  }
};
