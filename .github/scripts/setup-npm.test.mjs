import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const setupScript = fileURLToPath(new URL('./setup-npm.sh', import.meta.url));
const npmVersion = '11.21.1';
const fixtureCli = `#!/usr/bin/env node\nprocess.stdout.write('${npmVersion}\\n');\n`;

function npmEnvironment(directory, cacheName) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^npm_config_/i.test(key)) delete env[key];
  }
  return {
    ...env,
    npm_config_cache: join(directory, cacheName),
    npm_config_userconfig: join(directory, 'unused-user.npmrc'),
    npm_config_globalconfig: join(directory, 'unused-global.npmrc'),
    npm_config_registry: 'http://127.0.0.1:9',
    npm_config_offline: 'true',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false',
    npm_config_fetch_retries: '0',
    REPORT_NPM_TEST_POSTINSTALL_MARKER: join(directory, 'postinstall-ran'),
  };
}

function runNpm(args, directory, cacheName, cwd = directory) {
  const result = spawnSync('npm', args, {
    cwd,
    env: npmEnvironment(directory, cacheName),
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
  return result;
}

async function fixture(t, expectedVersion = npmVersion) {
  const directory = await mkdtemp(join(tmpdir(), 'report-npm-bootstrap-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const packageDirectory = join(directory, 'fixture-package');
  const toolchainDirectory = join(directory, '.github/npm');
  const scriptDirectory = join(directory, '.github/scripts');
  const tarballDirectory = join(directory, 'tarballs');
  for (const path of [packageDirectory, toolchainDirectory, scriptDirectory, tarballDirectory]) {
    await mkdir(path, { recursive: true });
  }
  await writeFile(
    join(packageDirectory, 'package.json'),
    JSON.stringify({
      name: 'npm',
      version: npmVersion,
      bin: { npm: 'cli.cjs' },
      scripts: { postinstall: 'node postinstall.cjs' },
    }),
  );
  await writeFile(join(packageDirectory, 'cli.cjs'), fixtureCli, { mode: 0o755 });
  await writeFile(
    join(packageDirectory, 'postinstall.cjs'),
    "require('node:fs').writeFileSync(process.env.REPORT_NPM_TEST_POSTINSTALL_MARKER, 'ran');\n",
  );
  const packArgs = ['pack', '--ignore-scripts', '--json', '--pack-destination', tarballDirectory];
  const packed = runNpm(packArgs, directory, 'pack-cache', packageDirectory);
  const tarballName = JSON.parse(packed.stdout)[0].filename;
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({ private: true, packageManager: `npm@${expectedVersion}` }),
  );
  await writeFile(
    join(toolchainDirectory, 'package.json'),
    JSON.stringify({ private: true, dependencies: { npm: `file:../../tarballs/${tarballName}` } }),
  );
  runNpm(
    ['install', '--prefix', '.github/npm', '--package-lock-only', '--ignore-scripts'],
    directory,
    'lock-cache',
  );
  const lock = JSON.parse(await readFile(join(toolchainDirectory, 'package-lock.json'), 'utf8'));
  assert.match(lock.packages['node_modules/npm'].integrity, /^sha512-/);
  const scriptPath = join(scriptDirectory, 'setup-npm.sh');
  await copyFile(setupScript, scriptPath);
  return {
    directory,
    packageDirectory,
    toolchainDirectory,
    scriptPath,
    tarballPath: join(tarballDirectory, tarballName),
    githubPath: join(directory, 'github-path'),
    repack() {
      return runNpm(packArgs, directory, 'replacement-pack-cache', packageDirectory);
    },
  };
}

function runSetup(fixture, { githubPath = fixture.githubPath } = {}) {
  const env = npmEnvironment(fixture.directory, 'install-cache');
  delete env.GITHUB_PATH;
  if (githubPath !== null) env.GITHUB_PATH = githubPath;
  return spawnSync('bash', [fixture.scriptPath], {
    cwd: tmpdir(),
    env,
    encoding: 'utf8',
    timeout: 30000,
  });
}

test('installs the integrity-locked npm and configures later steps without lifecycle scripts', async (t) => {
  const data = await fixture(t);
  const result = runSetup(data);
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
  assert.match(result.stdout, /Using integrity-verified npm 11\.21\.1/);
  assert.equal(
    await readFile(data.githubPath, 'utf8'),
    `${join(data.toolchainDirectory, 'node_modules/.bin')}\n`,
  );
  await assert.rejects(access(join(data.directory, 'postinstall-ran')), { code: 'ENOENT' });
});

test('rejects a packageManager version mismatch before changing GITHUB_PATH', async (t) => {
  const data = await fixture(t, '11.21.2');
  await writeFile(data.githubPath, 'existing-entry\n');
  const result = runSetup(data);
  assert.equal(result.status, 1, result.error?.message || result.stderr || result.stdout);
  assert.match(result.stderr, /Locked npm 11\.21\.1 does not match packageManager npm@11\.21\.2/);
  assert.equal(await readFile(data.githubPath, 'utf8'), 'existing-entry\n');
});

test('rejects a changed tarball when it no longer matches the committed integrity hash', async (t) => {
  const data = await fixture(t);
  const originalTarball = await readFile(data.tarballPath);
  await writeFile(join(data.packageDirectory, 'cli.cjs'), `${fixtureCli}// changed archive\n`);
  data.repack();
  assert.notDeepEqual(await readFile(data.tarballPath), originalTarball);
  const result = runSetup(data);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(`${result.stderr}\n${result.stdout}`, /EINTEGRITY|integrity checksum failed/);
  await assert.rejects(access(data.githubPath), { code: 'ENOENT' });
});

test('requires GITHUB_PATH before attempting any installation', async (t) => {
  const data = await fixture(t);
  const result = runSetup(data, { githubPath: null });
  assert.equal(result.status, 1, result.error?.message || result.stderr || result.stdout);
  assert.match(result.stderr, /GITHUB_PATH is required/);
  await assert.rejects(access(join(data.toolchainDirectory, 'node_modules')), { code: 'ENOENT' });
  await assert.rejects(access(join(data.directory, 'install-cache')), { code: 'ENOENT' });
});
