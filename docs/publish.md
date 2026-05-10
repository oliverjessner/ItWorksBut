The `itworksbut` formula belongs in the Homebrew tap repo, not in this app repo:

```text
https://github.com/oliverjessner/homebrew-tap
└── Formula/
    └── itworksbut.rb
```

This repository contains a one-command release script. It runs checks, publishes the npm package, generates the Homebrew formula, commits it to the tap, and pushes the tap:

```sh
npm login
npm run publish
```

Do not run `npm publish` directly. The package blocks direct npm publishing so the Homebrew tap cannot be forgotten.

Preview everything without publishing:

```sh
npm run publish -- --dry-run
```

By default the script expects the tap checkout at `../homebrew-tap`. Override it when needed:

```sh
npm run publish -- --tap-path /path/to/homebrew-tap
```

Use `--no-push` when you want the script to commit the tap formula but leave the push to you.
