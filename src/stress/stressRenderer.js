import { getChalk } from "../cli/terminal.js";

export function reportStressConsole(result, options = {}) {
  const colors = getChalk(options);
  const details = result.details || {};

  if (!options.quiet) {
    process.stdout.write(`${colors.bold("ItWorksBut Stress")}\n\n`);
    process.stdout.write("Only run this against systems you own or are explicitly authorized to test.\n\n");
    process.stdout.write(`Target: ${details.target}\n`);
    process.stdout.write(`Duration: ${details.duration}s\n`);
    process.stdout.write(`Arrival rate: ${details.arrivalRate} req/s\n`);
    process.stdout.write(`Max virtual users: ${details.maxVusers}\n\n`);

    writeDiscovery(details, colors);
    writeEndpoints(details, colors);
  }

  writeSummary(result, colors);
}

function writeDiscovery(details, colors) {
  const found = details.endpointsFound || 0;
  const safe = details.safeEndpoints || 0;
  const skipped = details.skippedEndpoints?.length || 0;
  const unsafe = details.skippedEndpoints?.filter((endpoint) => endpoint.reason === "unsafe method").length || 0;
  const dynamic = details.skippedEndpoints?.filter((endpoint) => endpoint.reason === "dynamic route requires parameter").length || 0;

  process.stdout.write(`${colors.green("✓")} Endpoint discovery: ${found} ${found === 1 ? "endpoint" : "endpoints"} found\n`);
  process.stdout.write(`${colors.green("✓")} Safe endpoints: ${safe} GET/HEAD ${safe === 1 ? "endpoint" : "endpoints"} selected\n`);
  if (skipped > 0) {
    process.stdout.write(`- Skipped: ${unsafe} unsafe methods, ${dynamic} dynamic routes\n`);
  }
  process.stdout.write("\n");
}

function writeEndpoints(details, colors) {
  const testedEndpoints = details.testedEndpoints || [];
  if (testedEndpoints.length === 0) {
    process.stdout.write("Running Artillery: skipped\n\n");
    return;
  }

  process.stdout.write("Running Artillery: complete\n\n");
  for (const endpoint of testedEndpoints) {
    const symbol = endpoint.status === "pass" ? colors.green("✓") : endpoint.status === "warn" ? colors.yellow("⚠") : colors.red("✕");
    process.stdout.write(`${symbol} ${endpoint.method} ${endpoint.path}\n`);
    process.stdout.write(`  p95: ${formatMs(endpoint.p95)}\n`);
    process.stdout.write(`  p99: ${formatMs(endpoint.p99)}\n`);
    process.stdout.write(`  errors: ${endpoint.errors}\n`);
    process.stdout.write(`  error rate: ${formatPercent(endpoint.errorRate)}\n\n`);
  }
}

function writeSummary(result, colors) {
  const details = result.details || {};
  const warnings = details.warnings || 0;
  const failed = details.failed || 0;
  const tested = details.testedEndpoints?.length || 0;
  const skipped = details.skippedEndpoints?.length || 0;

  process.stdout.write("Summary:\n");
  process.stdout.write(`${colors.green("✓")} Tested endpoints: ${tested}\n`);
  process.stdout.write(`${colors.yellow("⚠")} Warnings: ${warnings}\n`);
  process.stdout.write(`${colors.red("✕")} Failed: ${failed}\n`);
  process.stdout.write(`- Skipped: ${skipped}\n`);
  process.stdout.write(`- Status: ${result.status}\n`);
  process.stdout.write(`- ${result.summary}\n`);
  if (details.artilleryError) {
    process.stdout.write(`- Artillery error: ${details.artilleryError}\n`);
  }
}

function formatMs(value) {
  return value === null || value === undefined ? "n/a" : `${Math.round(value)} ms`;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(Number.isInteger(value) ? 0 : 2).replace(/\.00$/, "")}%`;
}
