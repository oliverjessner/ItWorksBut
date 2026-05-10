const INSTALL_SCRIPTS = ["preinstall", "install", "postinstall"];

export default {
  id: "dependencies.install-scripts-risk",
  title: "Install lifecycle scripts should be reviewed",
  category: "dependencies",
  severity: "medium",
  tags: ["dependencies", "supply-chain", "npm"],
  run: async (context) => {
    const scripts = context.packageJson?.scripts || {};
    return INSTALL_SCRIPTS.filter((scriptName) => scripts[scriptName]).map((scriptName) => ({
      message: `package.json defines an npm ${scriptName} lifecycle script. This can run during dependency installation.`,
      file: "package.json",
      recommendation: "Review whether the install-time script is necessary. In CI, prefer npm ci and consider --ignore-scripts where appropriate.",
      metadata: { scriptName }
    }));
  }
};
