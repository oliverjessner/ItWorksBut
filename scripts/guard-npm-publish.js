#!/usr/bin/env node

process.stderr.write(`Do not run npm publish directly for ItWorksBut.

Use:
  npm run publish

That command runs checks, publishes npm with lifecycle scripts disabled, and updates the Homebrew tap.
`);

process.exitCode = 1;
