import { collectCiFiles } from "../helpers.js";

export default {
  id: "ci.no-ci-config",
  title: "CI configuration should exist",
  category: "ci",
  severity: "medium",
  tags: ["ci", "deployment"],
  run: async (context) => {
    const ciFiles = await collectCiFiles(context);
    if (ciFiles.length > 0) return [];

    return [
      {
        message: "No common CI configuration was found.",
        recommendation: "Add a CI workflow that installs dependencies from the lockfile and runs tests, linting, and builds."
      }
    ];
  }
};
