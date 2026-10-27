import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const setupScript = fileURLToPath(new URL('./setup-npm.sh', import.meta.url));
const installScript = fileURLToPath(new URL('./install-npm-cli.mjs', import.meta.url));
const tarDirectory = fileURLToPath(new URL('../npm/node_modules/tar/', import.meta.url));
const npmVersion = '11.21.1';
const sourceUrl = `https://registry.npmjs.org/npm/-/npm-${npmVersion}.tgz`;
const runtimeSource = `module.exports = { version: '${npmVersion}', origin: 'locked-runtime' };\n`;
const fixtureCli = `#!/usr/bin/env node
const runtime = require('fixture-runtime');
process.stdout.write((process.argv[2] === '--runtime-origin' ? runtime.origin : runtime.version) + '\\n');
`;

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
  const packageDirectory = join(directory, 'fixture-runtime');
  const sourceDirectory = join(directory, 'source/package');
  const toolchainDirectory = join(directory, '.github/npm');
  const scriptDirectory = join(directory, '.github/scripts');
  const tarballDirectory = join(directory, 'tarballs');
  for (const path of [packageDirectory, toolchainDirectory, scriptDirectory, tarballDirectory]) {
    await mkdir(path, { recursive: true });
  }
  await mkdir(join(sourceDirectory, 'bin'), { recursive: true });
  await mkdir(join(sourceDirectory, 'node_modules/fixture-runtime'), { recursive: true });
  await writeFile(
    join(packageDirectory, 'package.json'),
    JSON.stringify({
      name: 'fixture-runtime',
      version: '1.0.0',
      main: 'index.cjs',
      scripts: { postinstall: 'node postinstall.cjs' },
    }),
  );
  await writeFile(join(packageDirectory, 'index.cjs'), runtimeSource);
  await writeFile(
    join(packageDirectory, 'postinstall.cjs'),
    "require('node:fs').writeFileSync(process.env.REPORT_NPM_TEST_POSTINSTALL_MARKER, 'ran');\n",
  );
  const packArgs = ['pack', '--ignore-scripts', '--json', '--pack-destination', tarballDirectory];
  const packed = runNpm(packArgs, directory, 'pack-cache', packageDirectory);
  const tarballName = JSON.parse(packed.stdout)[0].filename;
  const dependencies = {
    'fixture-runtime': `file:../../tarballs/${tarballName}`,
    tar: `file:${tarDirectory}`,
  };
  await writeFile(
    join(sourceDirectory, 'package.json'),
    JSON.stringify({ name: 'npm', version: npmVersion, dependencies }),
  );
  await writeFile(join(sourceDirectory, 'bin/npm-cli.js'), fixtureCli, { mode: 0o755 });
  await writeFile(join(sourceDirectory, 'bin/npx-cli.js'), fixtureCli, { mode: 0o755 });
  await writeFile(
    join(sourceDirectory, 'node_modules/fixture-runtime/package.json'),
    JSON.stringify({ name: 'fixture-runtime', version: '0.1.0', main: 'index.cjs' }),
  );
  await writeFile(
    join(sourceDirectory, 'node_modules/fixture-runtime/index.cjs'),
    "module.exports = { version: '11.0.0', origin: 'stale-bundle' };\n",
  );
  const sourceTarball = join(tarballDirectory, 'npm-source.tgz');
  const repackSource = () => {
    const result = spawnSync('tar', ['-czf', sourceTarball, '-C', join(directory, 'source'), 'package'], {
      encoding: 'utf8',
      env: { ...process.env, COPYFILE_DISABLE: '1' },
      timeout: 30000,
    });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
  };
  repackSource();
  const integrity = `sha512-${createHash('sha512').update(await readFile(sourceTarball)).digest('base64')}`;
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({ private: true, packageManager: `npm@${expectedVersion}` }),
  );
  await writeFile(
    join(toolchainDirectory, 'package.json'),
    JSON.stringify({
      private: true,
      npmCli: { version: npmVersion, url: sourceUrl, integrity },
      dependencies,
    }),
  );
  runNpm(
    ['install', '--prefix', '.github/npm', '--package-lock-only', '--ignore-scripts'],
    directory,
    'lock-cache',
  );
  const lock = JSON.parse(await readFile(join(toolchainDirectory, 'package-lock.json'), 'utf8'));
  assert.match(lock.packages['node_modules/fixture-runtime'].integrity, /^sha512-/);
  const scriptPath = join(scriptDirectory, 'setup-npm.sh');
  await copyFile(setupScript, scriptPath);
  await copyFile(installScript, join(scriptDirectory, 'install-npm-cli.mjs'));
  const fetchPreload = join(directory, 'fetch-fixture.mjs');
  await writeFile(
    fetchPreload,
    `import { readFile, writeFile } from 'node:fs/promises';
const sourceUrl = ${JSON.stringify(sourceUrl)};
globalThis.fetch = async (input) => {
  const url = typeof input === 'string' ? input : input.url || input.href;
  if (url !== sourceUrl) throw new Error('Unexpected network request: ' + url);
  await writeFile(process.env.REPORT_NPM_TEST_FETCH_MARKER, 'fetched');
  return new Response(await readFile(process.env.REPORT_NPM_TEST_SOURCE_TARBALL));
};
`,
  );
  return {
    directory,
    packageDirectory,
    sourceDirectory,
    toolchainDirectory,
    scriptPath,
    fetchPreload,
    sourceTarball,
    runtimeTarball: join(tarballDirectory, tarballName),
    githubPath: join(directory, 'github-path'),
    fetchMarker: join(directory, 'source-fetched'),
    repackSource,
    repackRuntime() {
      return runNpm(packArgs, directory, 'replacement-pack-cache', packageDirectory);
    },
  };
}

function runSetup(fixture, { githubPath = fixture.githubPath } = {}) {
  const env = npmEnvironment(fixture.directory, 'install-cache');
  delete env.GITHUB_PATH;
  if (githubPath !== null) env.GITHUB_PATH = githubPath;
  env.NODE_OPTIONS = `--import=${pathToFileURL(fixture.fetchPreload).href}`;
  env.REPORT_NPM_TEST_SOURCE_TARBALL = fixture.sourceTarball;
  env.REPORT_NPM_TEST_FETCH_MARKER = fixture.fetchMarker;
  return spawnSync('bash', [fixture.scriptPath], {
    cwd: tmpdir(),
    env,
    encoding: 'utf8',
    timeout: 30000,
  });
}

test('installs verified CLI source using locked runtime dependencies without bundled modules or lifecycle scripts', async (t) => {
  const data = await fixture(t);
  const result = runSetup(data);
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
  assert.match(result.stdout, /Using integrity-verified npm 11\.21\.1/);
  assert.equal(
    await readFile(data.githubPath, 'utf8'),
    `${join(data.toolchainDirectory, 'node_modules/.bin')}\n`,
  );
  const cli = join(data.toolchainDirectory, 'node_modules/.bin/npm');
  const origin = spawnSync(cli, ['--runtime-origin'], { encoding: 'utf8' });
  assert.equal(origin.status, 0, origin.error?.message || origin.stderr);
  assert.equal(origin.stdout.trim(), 'locked-runtime');
  await assert.rejects(access(join(data.toolchainDirectory, 'cli/node_modules')), { code: 'ENOENT' });
  await assert.rejects(access(join(data.directory, 'postinstall-ran')), { code: 'ENOENT' });
});

test('rejects a packageManager version mismatch before changing GITHUB_PATH', async (t) => {
  const data = await fixture(t, '11.21.2');
  await writeFile(data.githubPath, 'existing-entry\n');
  const result = runSetup(data);
  assert.equal(result.status, 1, result.error?.message || result.stderr || result.stdout);
  assert.match(result.stderr, /does not match|packageManager|mismatch/);
  assert.equal(await readFile(data.githubPath, 'utf8'), 'existing-entry\n');
});

test('rejects changed CLI source before unpacking, executing it, or configuring PATH', async (t) => {
  const data = await fixture(t);
  const originalTarball = await readFile(data.sourceTarball);
  await writeFile(join(data.sourceDirectory, 'bin/npm-cli.js'), `${fixtureCli}// changed source\n`);
  data.repackSource();
  assert.notDeepEqual(await readFile(data.sourceTarball), originalTarball);
  const result = runSetup(data);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(`${result.stderr}\n${result.stdout}`, /EINTEGRITY|integrity|checksum/);
  await assert.rejects(access(data.githubPath), { code: 'ENOENT' });
  await assert.rejects(access(join(data.toolchainDirectory, 'cli')), { code: 'ENOENT' });
});

test('rejects changed runtime archives before attempting to install the CLI source', async (t) => {
  const data = await fixture(t);
  const originalTarball = await readFile(data.runtimeTarball);
  await writeFile(join(data.packageDirectory, 'index.cjs'), `${runtimeSource}// changed runtime\n`);
  data.repackRuntime();
  assert.notDeepEqual(await readFile(data.runtimeTarball), originalTarball);
  const result = runSetup(data);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(`${result.stderr}\n${result.stdout}`, /EINTEGRITY|integrity checksum failed/);
  await assert.rejects(access(data.githubPath), { code: 'ENOENT' });
  await assert.rejects(access(data.fetchMarker), { code: 'ENOENT' });
});

test('requires GITHUB_PATH before attempting any installation', async (t) => {
  const data = await fixture(t);
  const result = runSetup(data, { githubPath: null });
  assert.equal(result.status, 1, result.error?.message || result.stderr || result.stdout);
  assert.match(result.stderr, /GITHUB_PATH is required/);
  await assert.rejects(access(join(data.toolchainDirectory, 'node_modules')), { code: 'ENOENT' });
  await assert.rejects(access(join(data.directory, 'install-cache')), { code: 'ENOENT' });
});
