import gradient from 'gradient-string';

export function printUsage() {
    process.stdout.write(`ItWorksBut

Usage:
  itworksbut scan [options]
  itworksbut deps [options]
  itworksbut stress [options]

Options:
  --path <path>       Project path to scan. Defaults to current directory.
  --config <path>     Optional itworksbut.config.json path.
  --fail-on <level>   Exit 1 when findings meet or exceed this severity.
                     Levels: critical, high, medium, low, info. Default: low.
  --target <url>      Stress-test target. Defaults to http://localhost:3000.
  --duration <sec>    Stress-test duration. Default: 30, max: 300.
  --arrival-rate <n>  Stress-test arrival rate. Default: 5, max: 50.
  --max-vusers <n>    Stress-test virtual user cap. Default: 50, max: 100.
  --i-own-this        Required to stress-test non-local targets.
  --json              Print machine-readable JSON.
  --sarif             Print SARIF for GitHub Code Scanning.
  --todo              Write an AI-ready todo.md to the scanned project.
  --report            Write a Markdown scan report.md to the current directory.
  --no-color          Disable color styling.
  --no-banner         Disable the intro banner.
  --quiet             Print only the summary.
  --verbose           Include scanner warnings and extra metadata.
  --version, -v       Print the ItWorksBut version.
  --help              Show this help.
`);
}

export function printVersion(version) {
    try {
        process.stdout.write(`${gradient.rainbow(version)}\n`);
    } catch {
        process.stdout.write(`${version}\n`);
    }
}

export function printRuntimeError(error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`ItWorksBut runtime error: ${message}\n`);
}
