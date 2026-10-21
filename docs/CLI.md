# CLI documentation

After [installing ItWorksBut](../README.md#install), run commands from the project folder or select one with `--path`.

## Commands

```sh
itworksbut scan
itworksbut deps
itworksbut stress
itworksbut --help
itworksbut --version
```

- `scan` checks the project for common security and hygiene risks. It is also the default when no command is given.
- `deps` runs only dependency checks: lockfile hygiene, install scripts, audit script availability, and outdated packages.
- `stress` discovers API endpoints and runs a controlled load test. Start the target application yourself before running it.

Scans report potential issues and do not automatically fix source files. Review findings before acting on them. The outdated-package check invokes the project's package manager and may access its registry. ItWorksBut does not send telemetry.

## Scan a project

```sh
itworksbut scan --path . --fail-on high
itworksbut deps --path .
```

- `--path <path>` selects the project folder. Default: the current directory.
- `--config <path>` selects a configuration file, resolved relative to the project folder unless absolute. By default, `itworksbut.config.json` is loaded from that folder when present.
- `--fail-on <severity>` sets the threshold for exit code `1`. Values: `critical`, `high`, `medium`, `low`, or `info`. Default: `low`.

Checks are enabled by default. Generated folders such as `node_modules`, `dist`, `build`, `coverage`, `.git`, and `target` are skipped.

## Export results

```sh
itworksbut scan --todo
itworksbut scan --report
itworksbut scan --json
itworksbut scan --sarif > itworksbut.sarif
```

- `--todo` writes `todo.md` inside the scanned project. It includes prioritized findings, fix prompts, locations, and acceptance criteria.
- `--report` writes `report.md` in the current working directory with check statuses, details, and recommendations.
- `--json` prints machine-readable JSON to standard output.
- `--sarif` prints SARIF for tools such as GitHub Code Scanning.

Choose only one of `--json`, `--sarif`, or `--todo`. You can combine `--report` with any of them. Existing report and todo files at these paths are overwritten.

## Control terminal output

- `--quiet` reduces console output to the summary.
- `--verbose` includes scanner warnings and extra metadata.
- `--no-color` disables colored output.
- `--no-banner` disables the introductory banner.
- `--help`, `-h` displays usage information.
- `--version`, `-v` displays the installed version.

Banners and spinners are disabled in CI. JSON and SARIF modes omit console styling so standard output contains only machine-readable results.

## Configure checks

Create an optional `itworksbut.config.json` in the project folder:

```json
{
  "ignore": ["vendor/**"],
  "failOn": "high",
  "checks": {
    "node.rate-limit-missing": false
  }
}
```

`ignore` adds patterns to the default exclusions. Set an individual check ID to `false` to disable it. Use the check ID shown in a finding. A command-line `--fail-on` value overrides the configured threshold.

To select another configuration file in the project folder:

```sh
itworksbut scan --config itworksbut.config.json
```

## Run an API load test

With your local application already running:

```sh
itworksbut stress --target http://localhost:3000 --duration 30 --arrival-rate 5 --max-vusers 50
```

ItWorksBut discovers endpoints in the selected project and tests eligible GET and HEAD routes. Mutating methods such as POST, PUT, PATCH, and DELETE are skipped. A target URL with a path explicitly adds that path as a GET endpoint.

- `--target <url>` selects an HTTP or HTTPS target. Default: `http://localhost:3000`.
- `--duration <seconds>` sets the load phase duration. Default: `30`; maximum: `300`.
- `--arrival-rate <number>` sets the arrival rate. Default: `50`; maximum: `100`.
- `--max-vusers <number>` caps virtual users. Default: `200`; maximum: `400`. Requires a positive integer.
- `--i-own-this` confirms ownership or explicit permission for a non-local target.
- `--path <path>` selects the project used for endpoint discovery.
- `--json` prints the load-test result as JSON.
- `--report` writes `stress-report.md` in the current working directory, overwriting an existing file.

For local targets, the recognized hosts are `localhost`, `127.0.0.1`, and `0.0.0.0`. Other hosts require `--i-own-this`. Only test systems you own or are explicitly authorized to test.

To save a report from a small local test:

```sh
itworksbut stress --duration 10 --arrival-rate 5 --max-vusers 10 --report
```

The report includes tested and skipped endpoints, response-time percentiles, errors, and recommendations. The `stress` command does not support `--todo` or `--sarif`; scan configuration and severity thresholds apply to `scan` and `deps`.

## Exit codes

For `scan` and `deps`:

- `0`: no findings at or above the configured severity threshold.
- `1`: at least one finding meets or exceeds the threshold.
- `2`: an argument or runtime error prevented completion.

For `stress`, a failed result returns `1`; a passing, warning-only, or skipped result returns `0`. Argument and runtime errors return `2`.
