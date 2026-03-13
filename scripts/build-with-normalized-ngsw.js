#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '..');
const angularCliPath = path.resolve(workspaceRoot, 'node_modules/@angular/cli/bin/ng.js');
const normalizeScriptPath = path.resolve(__dirname, 'normalize-ngsw.js');
const buildArgs = process.argv.slice(2);

process.chdir(workspaceRoot);

try {
  execFileSync(process.execPath, [angularCliPath, 'build', ...buildArgs], {
    cwd: workspaceRoot,
    env: process.env,
    stdio: 'inherit',
  });

  execFileSync(process.execPath, [normalizeScriptPath], {
    cwd: resolveManifestDirectory(buildArgs),
    env: process.env,
    stdio: 'inherit',
  });
} catch (error) {
  process.exit(error.status ?? 1);
}

function resolveManifestDirectory(args) {
  const workspace = JSON.parse(fs.readFileSync('angular.json', 'utf8'));
  const cliOptions = parseCliOptions(args);
  const projectName = resolveProjectName(workspace, cliOptions);
  const project = findNamedValue(workspace.projects, projectName);
  const buildTarget = project?.architect?.build;

  if (!buildTarget) {
    throw new Error(`Build target not found for Angular project "${projectName}".`);
  }

  const outputPath = resolveOutputPath(buildTarget, cliOptions, projectName);
  const basePath =
    typeof outputPath === 'string'
      ? outputPath
      : outputPath?.base ?? path.posix.join('dist', projectName);
  const browserPath =
    typeof outputPath === 'string' ? 'browser' : (outputPath?.browser ?? 'browser');
  const absoluteBasePath = path.isAbsolute(basePath)
    ? basePath
    : path.resolve(workspaceRoot, basePath);

  return browserPath ? path.resolve(absoluteBasePath, browserPath) : absoluteBasePath;
}

function parseCliOptions(args) {
  const cliOptions = {
    configuration: undefined,
    outputPath: undefined,
    project: undefined,
    positionals: [],
  };

  const pendingArgs = [...args];

  while (pendingArgs.length > 0) {
    const arg = pendingArgs.shift();

    if (arg === undefined) {
      break;
    }

    if (arg === '--configuration' || arg === '-c') {
      cliOptions.configuration = pendingArgs.shift();
      continue;
    }

    if (arg.startsWith('--configuration=')) {
      cliOptions.configuration = arg.slice('--configuration='.length);
      continue;
    }

    if (arg === '--output-path' || arg === '-o') {
      cliOptions.outputPath = pendingArgs.shift();
      continue;
    }

    if (arg.startsWith('--output-path=')) {
      cliOptions.outputPath = arg.slice('--output-path='.length);
      continue;
    }

    if (arg === '--project') {
      cliOptions.project = pendingArgs.shift();
      continue;
    }

    if (arg.startsWith('--project=')) {
      cliOptions.project = arg.slice('--project='.length);
      continue;
    }

    if (!arg.startsWith('-')) {
      cliOptions.positionals.push(arg);
    }
  }

  return cliOptions;
}

function resolveProjectName(workspace, cliOptions) {
  const knownProjectNames = getNamedEntries(workspace.projects).map(
    ([projectName]) => projectName,
  );
  const explicitProject =
    cliOptions.project ??
    cliOptions.positionals.find((value) => knownProjectNames.includes(value));

  if (explicitProject) {
    return explicitProject;
  }

  if (workspace.defaultProject) {
    return workspace.defaultProject;
  }

  if (knownProjectNames.length === 1) {
    return knownProjectNames[0];
  }

  throw new Error('Unable to determine the Angular project for ng build.');
}

function resolveOutputPath(buildTarget, cliOptions, projectName) {
  let outputPath = buildTarget.options?.outputPath;
  const configurationNames = (cliOptions.configuration ?? buildTarget.defaultConfiguration ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  for (const configurationName of configurationNames) {
    const configuration = findNamedValue(buildTarget.configurations, configurationName);
    const configuredOutputPath =
      configuration && typeof configuration === 'object' && Object.hasOwn(configuration, 'outputPath')
        ? configuration.outputPath
        : undefined;

    if (configuredOutputPath !== undefined) {
      outputPath = configuredOutputPath;
    }
  }

  if (cliOptions.outputPath !== undefined) {
    return cliOptions.outputPath;
  }

  return outputPath ?? path.posix.join('dist', projectName);
}

function getNamedEntries(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value) : [];
}

function findNamedValue(value, expectedKey) {
  for (const [entryKey, entryValue] of getNamedEntries(value)) {
    if (entryKey === expectedKey) {
      return entryValue;
    }
  }

  return undefined;
}
