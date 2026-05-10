export default {
  id: "dependencies.audit-script-missing",
  title: "Dependency security audit should be available",
  category: "dependencies",
  severity: "low",
  tags: ["dependencies", "supply-chain", "ci"],
  run: async (context) => {
    if (!context.packageJson) return [];
    const scripts = context.packageJson.scripts || {};
    const hasAudit = Object.entries(scripts).some(([name, command]) => {
      return /\b(audit|security|sca|snyk|semgrep)\b/i.test(name) || /\b(npm|pnpm|yarn)\s+audit\b|snyk|semgrep/i.test(String(command));
    });
    if (hasAudit) return [];

    return [
      {
        message: "package.json does not appear to define an audit or security script.",
        file: "package.json",
        recommendation: "Add an npm audit or equivalent SCA/security script and run it in CI."
      }
    ];
  }
};
