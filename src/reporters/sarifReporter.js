const SARIF_VERSION = "2.1.0";

export function reportSarif(result) {
  const rules = buildRules(result.findings);

  return {
    version: SARIF_VERSION,
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "ItWorksBut",
            informationUri: "https://github.com/itworksbut/itworksbut",
            rules
          }
        },
        results: result.findings.map(toSarifResult),
        invocations: [
          {
            executionSuccessful: true,
            toolExecutionNotifications: result.warnings.map((warning) => ({
              level: "warning",
              message: { text: `[${warning.checkId}] ${warning.message}` }
            }))
          }
        ]
      }
    ]
  };
}

function buildRules(findings) {
  const byId = new Map();
  for (const finding of findings) {
    if (byId.has(finding.checkId)) continue;
    byId.set(finding.checkId, {
      id: finding.checkId,
      name: finding.checkId,
      shortDescription: { text: finding.title },
      fullDescription: { text: finding.message },
      help: { text: finding.recommendation || finding.title },
      properties: {
        category: finding.category,
        tags: finding.tags || [],
        precision: finding.heuristic ? "low" : "medium"
      }
    });
  }
  return [...byId.values()];
}

function toSarifResult(finding) {
  return {
    ruleId: finding.checkId,
    level: sarifLevel(finding.severity),
    message: { text: finding.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: finding.file || "." },
          region: {
            startLine: finding.line || 1,
            startColumn: finding.column || 1
          }
        }
      }
    ],
    properties: {
      severity: finding.severity,
      category: finding.category,
      recommendation: finding.recommendation,
      heuristic: finding.heuristic
    }
  };
}

function sarifLevel(severity) {
  if (severity === "critical" || severity === "high") return "error";
  if (severity === "medium" || severity === "low") return "warning";
  return "note";
}
