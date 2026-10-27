import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const toolchain = join(repository, '.github/npm');

async function install() {
  const manifest = JSON.parse(await readFile(join(toolchain, 'package.json'), 'utf8'));
  const root = JSON.parse(await readFile(join(repository, 'package.json'), 'utf8'));
  const { version, url, integrity } = manifest.npmCli;
  if (root.packageManager !== `npm@${version}`) {
    throw new Error(`Locked npm ${version} does not match packageManager ${root.packageManager}`);
  }
  if (url !== `https://registry.npmjs.org/npm/-/npm-${version}.tgz`) {
    throw new Error('npm CLI source must use its official registry archive');
  }

  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok) throw new Error(`npm CLI download failed: HTTP ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());
  const actualIntegrity = `sha512-${createHash('sha512').update(archive).digest('base64')}`;
  if (actualIntegrity !== integrity) throw new Error('npm CLI integrity checksum failed');

  const require = createRequire(join(toolchain, 'package.json'));
  const tar = require('tar');
  const staging = await mkdtemp(join(toolchain, '.cli-staging-'));
  try {
    const archivePath = join(staging, 'npm.tgz');
    await writeFile(archivePath, archive);
    await tar.x({
      file: archivePath,
      cwd: staging,
      strict: true,
      filter(path, entry) {
        const parts = path.split('/');
        if (parts.at(-1) === '') parts.pop();
        if (
          path.includes('\\') ||
          parts[0] !== 'package' ||
          parts.some(part => part === '..' || part === '.' || part === '')
        ) {
          throw new Error(`Unsafe npm CLI archive path: ${path}`);
        }
        if (parts[1] === 'node_modules') return false;
        if (entry.type === 'SymbolicLink' || entry.type === 'Link') {
          throw new Error(`Unsupported npm CLI archive link: ${path}`);
        }
        return true;
      },
    });

    const source = join(staging, 'package');
    const cli = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
    if (cli.name !== 'npm' || cli.version !== version) {
      throw new Error('npm CLI source identity does not match the pinned version');
    }
    const dependencies = Object.entries(cli.dependencies);
    if (
      dependencies.length !== Object.keys(manifest.dependencies).length ||
      dependencies.some(([name, range]) => manifest.dependencies[name] !== range)
    ) {
      throw new Error('npm CLI runtime dependencies do not match the locked manifest');
    }

    const cliDirectory = join(toolchain, 'cli');
    await rm(cliDirectory, { recursive: true, force: true });
    await rename(source, cliDirectory);
    const binDirectory = join(toolchain, 'node_modules/.bin');
    await mkdir(binDirectory, { recursive: true });
    for (const command of ['npm', 'npx']) {
      const link = join(binDirectory, command);
      await rm(link, { force: true });
      await symlink(`../../cli/bin/${command}-cli.js`, link);
    }

    // A real CLI invocation also proves that its separately locked runtime resolves.
    const result = spawnSync(process.execPath, [join(cliDirectory, 'bin/npm-cli.js'), '--version'], {
      encoding: 'utf8',
      timeout: 30000,
    });
    if (result.status !== 0 || result.stdout.trim() !== version) {
      throw new Error(result.error?.message || result.stderr || 'npm CLI version check failed');
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

try {
  await install();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
