export default {
  id: "git.gitignore-missing",
  title: ".gitignore should exist",
  category: "git",
  severity: "medium",
  tags: ["git", "repo-hygiene"],
  run: async (context) => {
    if (await context.fileExists(".gitignore")) return [];
    return [
      {
        message: "The repository appears to be missing a .gitignore file.",
        recommendation: "Add a .gitignore that excludes dependencies, build output, local env files, logs, and local databases."
      }
    ];
  }
};
