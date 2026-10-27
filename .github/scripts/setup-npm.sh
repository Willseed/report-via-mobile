#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_PATH:?GITHUB_PATH is required to configure npm for subsequent steps}"
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

# Install the CLI's patched runtime from lockfile hashes, excluding its old bundle.
npm ci --prefix .github/npm --ignore-scripts --no-fund
node .github/scripts/install-npm-cli.mjs

report_npm_bin="$(pwd)/.github/npm/node_modules/.bin"
report_expected_npm=$(node -p 'require("./package.json").packageManager.replace(/^npm@/, "")')
report_actual_npm=$("$report_npm_bin/npm" --version)

if [[ "$report_actual_npm" != "$report_expected_npm" ]]; then
  printf '::error::Locked npm %s does not match packageManager npm@%s\n' \
    "$report_actual_npm" "$report_expected_npm" >&2
  exit 1
fi

printf '%s\n' "$report_npm_bin" >> "$GITHUB_PATH"
printf 'Using integrity-verified npm %s\n' "$report_actual_npm"
