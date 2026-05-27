#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');

const manifestFilename = 'ngsw.json';
const fixedCommandPath = '/usr/bin:/bin';
const gitCommandEnv = { PATH: fixedCommandPath };
let manifestDescriptor;

try {
  manifestDescriptor = fs.openSync(manifestFilename, 'r+');
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log(`Skipping ngsw normalization; manifest not found at ${manifestFilename}.`);
    process.exit(0);
  }

  console.error(`Failed to open ${manifestFilename}: ${error.message}`);
  process.exit(1);
}

try {
  const manifest = JSON.parse(readUtf8File(manifestDescriptor));
  const { source, timestamp } = resolveDeterministicTimestamp(manifest);
  const originalTimestamp = manifest.timestamp;

  manifest.timestamp = timestamp;
  writeManifest(manifestDescriptor, manifest);

  console.log(
    `Normalized ${manifestFilename} timestamp ${String(originalTimestamp)} -> ${timestamp} (${source}).`,
  );
} catch (error) {
  console.error(`Failed to normalize ${manifestFilename}: ${error.message}`);
  process.exitCode = 1;
} finally {
  fs.closeSync(manifestDescriptor);
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
        env: gitCommandEnv,
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();

    if (dirtyWorkingTree) {
      return null;
    }

    const commitEpochSeconds = execFileSync('git', ['log', '-1', '--format=%ct', 'HEAD'], {
      encoding: 'utf8',
      env: gitCommandEnv,
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

function readUtf8File(fileDescriptor) {
  const { size } = fs.fstatSync(fileDescriptor);

  if (size === 0) {
    return '';
  }

  const buffer = Buffer.alloc(size);
  fs.readSync(fileDescriptor, buffer, 0, size, 0);

  return buffer.toString('utf8');
}

function writeManifest(fileDescriptor, manifest) {
  const serializedManifest = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.ftruncateSync(fileDescriptor, 0);
  fs.writeSync(fileDescriptor, serializedManifest, 0, 'utf8');
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}
