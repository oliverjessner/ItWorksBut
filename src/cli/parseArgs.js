const FLAG_WITH_VALUE = new Set(["--fail-on", "--config", "--path", "--theme"]);
const BOOLEAN_FLAGS = new Set(["--json", "--sarif", "--verbose", "--help", "-h", "--no-color", "--no-banner", "--no-spinner", "--compact", "--quiet"]);

export function parseArgs(argv) {
  const args = {
    command: "scan",
    path: ".",
    config: undefined,
    failOn: undefined,
    json: false,
    sarif: false,
    verbose: false,
    noColor: false,
    noBanner: false,
    noSpinner: false,
    compact: false,
    quiet: false,
    theme: "default",
    help: false
  };

  const tokens = [...argv];
  if (tokens[0] && !tokens[0].startsWith("-")) {
    args.command = tokens.shift();
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token.includes("=") && token.startsWith("--")) {
      const [flag, ...rest] = token.split("=");
      assignValue(args, flag, rest.join("="));
      continue;
    }

    if (FLAG_WITH_VALUE.has(token)) {
      const value = tokens[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error(`Missing value for ${token}`);
      }
      assignValue(args, token, value);
      index += 1;
      continue;
    }

    if (BOOLEAN_FLAGS.has(token)) {
      if (token === "--help" || token === "-h") args.help = true;
      if (token === "--json") args.json = true;
      if (token === "--sarif") args.sarif = true;
      if (token === "--verbose") args.verbose = true;
      if (token === "--no-color") args.noColor = true;
      if (token === "--no-banner") args.noBanner = true;
      if (token === "--no-spinner") args.noSpinner = true;
      if (token === "--compact") args.compact = true;
      if (token === "--quiet") args.quiet = true;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (args.json && args.sarif) {
    throw new Error("Use only one output format: --json or --sarif");
  }

  return args;
}

function assignValue(args, flag, value) {
  if (flag === "--fail-on") args.failOn = value;
  else if (flag === "--config") args.config = value;
  else if (flag === "--path") args.path = value;
  else if (flag === "--theme") args.theme = value;
  else throw new Error(`Unknown argument: ${flag}`);
}
