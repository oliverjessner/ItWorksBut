import { hasText } from "../helpers.js";

export default {
  id: "node.helmet-missing",
  title: "Express apps should use Helmet or equivalent security headers",
  category: "node",
  severity: "medium",
  tags: ["node", "express", "headers"],
  run: async (context) => {
    const expressDetected = context.hasDependency("express") || (await hasText(context, /\bfrom\s+["']express["']|\brequire\(["']express["']\)/g));
    if (!expressDetected) return [];
    if (context.hasDependency("helmet") || context.hasDevDependency("helmet")) return [];
    if (await hasText(context, /\bhelmet\s*\(/g)) return [];

    return [
      {
        message: "Express appears to be used, but Helmet was not detected.",
        recommendation: "Install and use helmet() early in the middleware stack, or document equivalent security header handling."
      }
    ];
  }
};
