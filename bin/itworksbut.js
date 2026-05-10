#!/usr/bin/env node

import { parseArgs } from "../src/cli/parseArgs.js";
import { printUsage, printRuntimeError } from "../src/cli/output.js";
import { createScanSpinner, printIntro } from "../src/cli/terminal.js";
import { scanProject } from "../src/core/scanner.js";
import { getExitCode } from "../src/core/findings.js";
import { reportConsole } from "../src/reporters/consoleReporter.js";
import { reportJson } from "../src/reporters/jsonReporter.js";
import { reportSarif } from "../src/reporters/sarifReporter.js";

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return 0;
  }

  if (args.command !== "scan") {
    printUsage();
    return 2;
  }

  printIntro(args);

  const spinner = createScanSpinner(args);
  if (spinner) spinner.start();

  let result;
  try {
    result = await scanProject({
      rootPath: args.path,
      configPath: args.config,
      failOn: args.failOn,
      verbose: args.verbose
    });
    if (spinner) spinner.succeed("Scan complete. Now the receipts.");
  } catch (error) {
    if (spinner) spinner.fail("Scan stopped before the receipts were printed.");
    throw error;
  }

  if (args.sarif) {
    process.stdout.write(`${JSON.stringify(reportSarif(result), null, 2)}\n`);
  } else if (args.json) {
    process.stdout.write(`${JSON.stringify(reportJson(result), null, 2)}\n`);
  } else {
    reportConsole(result, args);
  }

  return getExitCode(result.findings, result.config.failOn);
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    printRuntimeError(error);
    process.exitCode = 2;
  });
