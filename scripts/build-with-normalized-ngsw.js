#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const workspaceRoot = process.cwd();
const angularCliPath = path.resolve(workspaceRoot, 'node_modules/@angular/cli/bin/ng.js');
const normalizeScriptPath = path.resolve(workspaceRoot, 'scripts/normalize-ngsw.js');
const buildArgs = process.argv.slice(2);

try {
  execFileSync(process.execPath, [angularCliPath, 'build', ...buildArgs], {
    cwd: workspaceRoot,
    env: process.env,
    stdio: 'inherit',
  });

  execFileSync(process.execPath, [normalizeScriptPath, resolveManifestPath(buildArgs)], {
    cwd: workspaceRoot,
    env: process.env,
    stdio: 'inherit',
  });
} catch (error) {
  process.exit(error.status ?? 1);
}

function resolveManifestPath(args) {
  const workspace = JSON.parse(
    fs.readFileSync(path.resolve(workspaceRoot, 'angular.json'), 'utf8'),
  );
  const cliOptions = parseCliOptions(args);
  const projectName = resolveProjectName(workspace, cliOptions);
  const buildTarget = workspace.projects?.[projectName]?.architect?.build;

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

  return browserPath
    ? path.resolve(absoluteBasePath, browserPath, 'ngsw.json')
    : path.resolve(absoluteBasePath, 'ngsw.json');
}

function parseCliOptions(args) {
  const cliOptions = {
    configuration: undefined,
    outputPath: undefined,
    project: undefined,
    positionals: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--configuration' || arg === '-c') {
      cliOptions.configuration = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--configuration=')) {
      cliOptions.configuration = arg.slice('--configuration='.length);
      continue;
    }

    if (arg === '--output-path' || arg === '-o') {
      cliOptions.outputPath = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--output-path=')) {
      cliOptions.outputPath = arg.slice('--output-path='.length);
      continue;
    }

    if (arg === '--project') {
      cliOptions.project = args[index + 1];
      index += 1;
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
  const explicitProject =
    cliOptions.project ??
    cliOptions.positionals.find((value) => workspace.projects && value in workspace.projects);

  if (explicitProject) {
    return explicitProject;
  }

  if (workspace.defaultProject) {
    return workspace.defaultProject;
  }

  const projectNames = Object.keys(workspace.projects ?? {});

  if (projectNames.length === 1) {
    return projectNames[0];
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
    const configuredOutputPath = buildTarget.configurations?.[configurationName]?.outputPath;

    if (configuredOutputPath !== undefined) {
      outputPath = configuredOutputPath;
    }
  }

  if (cliOptions.outputPath !== undefined) {
    return cliOptions.outputPath;
  }

  return outputPath ?? path.posix.join('dist', projectName);
}
