export function printUsage() {
  process.stdout.write(`ItWorksBut

Usage:
  itworksbut scan [options]
  node ./bin/itworksbut.js scan [options]

Options:
  --path <path>       Project path to scan. Defaults to current directory.
  --config <path>     Optional itworksbut.config.json path.
  --fail-on <level>   Exit 1 when findings meet or exceed this severity.
                     Levels: critical, high, medium, low, info. Default: low.
  --json              Print machine-readable JSON.
  --sarif             Print SARIF for GitHub Code Scanning.
  --no-color          Disable color styling.
  --no-banner         Disable the intro banner.
  --no-spinner        Disable scan spinner.
  --compact           Print one-line findings.
  --quiet             Print only the summary.
  --theme <theme>     Console theme: default, toxic, mono.
  --verbose           Include scanner warnings and extra metadata.
  --help              Show this help.
`);
}

export function printRuntimeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ItWorksBut runtime error: ${message}\n`);
}
