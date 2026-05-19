const DEFAULT_THRESHOLDS = {
  p95WarnMs: 500,
  p95FailMs: 2000,
  p99WarnMs: 1500,
  errorRateWarn: 0,
  errorRateFail: 10
};

export function parseArtilleryResult(artilleryResult, endpoints, options = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds || {}) };

  if (!artilleryResult?.report) {
    return {
      status: "fail",
      summary: "Artillery did not produce a parseable report.",
      testedEndpoints: endpoints.map((endpoint) => ({
        method: endpoint.method,
        path: endpoint.path,
        status: "fail",
        requests: 0,
        p95: null,
        p99: null,
        errors: 1,
        errorRate: 100
      })),
      warnings: 0,
      failed: endpoints.length,
      error: trimText(artilleryResult?.stderr || artilleryResult?.stdout || "Artillery failed.")
    };
  }

  const aggregate = getAggregate(artilleryResult.report);
  const counters = aggregate.counters || {};
  const summaries = aggregate.summaries || {};
  const fallbackRequests = countRequests(counters);
  const fallbackErrors = countErrors(counters);

  const testedEndpoints = endpoints.map((endpoint) => {
    const summary = findEndpointSummary(summaries, endpoint) || summaries["http.response_time"] || {};
    const requests = countEndpointRequests(counters, endpoint) ?? fallbackRequests;
    const errors = countEndpointErrors(counters, endpoint) ?? fallbackErrors;
    const errorRate = requests > 0 ? round((errors / requests) * 100, 2) : (errors > 0 ? 100 : 0);
    const p95 = numeric(summary.p95);
    const p99 = numeric(summary.p99);
    const status = classifyEndpoint({ p95, p99, errorRate, errors }, thresholds);

    return {
      method: endpoint.method,
      path: endpoint.path,
      status,
      requests,
      p95,
      p99,
      errors,
      errorRate
    };
  });

  const warnings = testedEndpoints.filter((endpoint) => endpoint.status === "warn").length;
  const failed = testedEndpoints.filter((endpoint) => endpoint.status === "fail").length;
  const status = !artilleryResult.ok || failed > 0 ? "fail" : warnings > 0 ? "warn" : "pass";
  const summary = summarize(testedEndpoints.length, warnings, failed, artilleryResult);

  return {
    status,
    summary,
    testedEndpoints,
    warnings,
    failed,
    error: artilleryResult.ok ? undefined : trimText(artilleryResult.stderr || artilleryResult.stdout)
  };
}

function getAggregate(report) {
  if (report?.aggregate) return report.aggregate;
  if (Array.isArray(report?.intermediate) && report.intermediate.length > 0) {
    return report.intermediate[report.intermediate.length - 1] || {};
  }
  return report || {};
}

function findEndpointSummary(summaries, endpoint) {
  const methodPath = `${endpoint.method} ${endpoint.path}`;
  const candidates = Object.entries(summaries);
  const match = candidates.find(([key]) => key.includes(methodPath));
  if (match) return match[1];

  const pathMatch = candidates.find(([key]) => key.includes(endpoint.path));
  return pathMatch ? pathMatch[1] : null;
}

function countRequests(counters) {
  if (Number.isFinite(counters["http.requests"])) return counters["http.requests"];
  if (Number.isFinite(counters["http.responses"])) return counters["http.responses"];

  return Object.entries(counters)
    .filter(([key]) => /^http\.codes\.\d+$/.test(key))
    .reduce((total, [, value]) => total + numeric(value), 0);
}

function countErrors(counters) {
  const explicit = Object.entries(counters)
    .filter(([key]) => key.startsWith("http.errors"))
    .reduce((total, [, value]) => total + numeric(value), 0);
  const statusErrors = Object.entries(counters)
    .filter(([key]) => /^http\.codes\.[45]\d\d$/.test(key))
    .reduce((total, [, value]) => total + numeric(value), 0);

  return explicit + statusErrors;
}

function countEndpointRequests(counters, endpoint) {
  return countEndpointMetric(counters, endpoint, ["requests", "responses"]);
}

function countEndpointErrors(counters, endpoint) {
  return countEndpointMetric(counters, endpoint, ["errors"]);
}

function countEndpointMetric(counters, endpoint, names) {
  const methodPath = `${endpoint.method} ${endpoint.path}`;
  const matches = Object.entries(counters).filter(([key]) => {
    return key.includes(methodPath) && names.some((name) => key.toLowerCase().includes(name));
  });
  if (!matches.length) return null;
  return matches.reduce((total, [, value]) => total + numeric(value), 0);
}

function classifyEndpoint({ p95, p99, errorRate, errors }, thresholds) {
  if (errorRate >= thresholds.errorRateFail || p95 >= thresholds.p95FailMs) return "fail";
  if (errorRate > thresholds.errorRateWarn || errors > 0 || p95 > thresholds.p95WarnMs || p99 > thresholds.p99WarnMs) {
    return "warn";
  }
  return "pass";
}

function summarize(tested, warnings, failed, artilleryResult) {
  if (!artilleryResult.ok) return `Artillery failed after testing ${tested} ${tested === 1 ? "endpoint" : "endpoints"}.`;
  return `${tested} ${tested === 1 ? "endpoint" : "endpoints"} tested, ${warnings} ${warnings === 1 ? "warning" : "warnings"}, ${failed} failed`;
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function trimText(value) {
  const normalized = String(value || "").trim();
  return normalized.length > 1000 ? `${normalized.slice(0, 1000)}...` : normalized;
}
