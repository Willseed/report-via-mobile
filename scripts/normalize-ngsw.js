#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const defaultManifestPath = path.resolve(
  process.cwd(),
  'dist/report-via-mobile/browser/ngsw.json',
);
const manifestPath = path.resolve(process.argv[2] ?? defaultManifestPath);

try {
  if (!fs.existsSync(manifestPath)) {
    console.log(
      `Skipping ngsw normalization; manifest not found at ${path.relative(process.cwd(), manifestPath)}.`,
    );
    process.exit(0);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const { source, timestamp } = resolveDeterministicTimestamp(manifest);
  const originalTimestamp = manifest.timestamp;

  manifest.timestamp = timestamp;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `Normalized ${path.relative(process.cwd(), manifestPath)} timestamp ${String(
      originalTimestamp,
    )} -> ${timestamp} (${source}).`,
  );
} catch (error) {
  console.error(
    `Failed to normalize ${path.relative(process.cwd(), manifestPath)}: ${error.message}`,
  );
  process.exit(1);
}

function resolveDeterministicTimestamp(manifest) {
  if (process.env.SOURCE_DATE_EPOCH) {
    return {
      source: 'SOURCE_DATE_EPOCH',
      timestamp: parseEpochSeconds(process.env.SOURCE_DATE_EPOCH, 'SOURCE_DATE_EPOCH'),
    };
  }

  const gitCommitTimestamp = getGitCommitTimestamp();

  if (gitCommitTimestamp !== null) {
    return {
      source: 'git-commit-time',
      timestamp: gitCommitTimestamp,
    };
  }

  return {
    source: 'manifest-hash',
    timestamp: deriveTimestampFromManifest(manifest),
  };
}

function getGitCommitTimestamp() {
  try {
    const dirtyWorkingTree = execFileSync(
      'git',
      ['status', '--porcelain', '--untracked-files=no'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();

    if (dirtyWorkingTree) {
      return null;
    }

    const commitEpochSeconds = execFileSync('git', ['log', '-1', '--format=%ct', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    return parseEpochSeconds(commitEpochSeconds, 'git commit timestamp');
  } catch {
    return null;
  }
}

function deriveTimestampFromManifest(manifest) {
  const manifestForHash = { ...manifest };
  delete manifestForHash.timestamp;

  const digest = createHash('sha256').update(stableStringify(manifestForHash)).digest('hex');
  const secondsWithinCentury = Number(BigInt(`0x${digest.slice(0, 12)}`) % 3_155_760_000n);

  return (946_684_800 + secondsWithinCentury) * 1_000;
}

function parseEpochSeconds(rawValue, label) {
  const normalizedValue = rawValue.trim();

  if (!/^\d+$/.test(normalizedValue)) {
    throw new Error(`${label} must be a whole-number Unix timestamp in seconds.`);
  }

  const milliseconds = Number(normalizedValue) * 1_000;

  if (!Number.isSafeInteger(milliseconds)) {
    throw new Error(`${label} is outside the supported timestamp range.`);
  }

  return milliseconds;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}
