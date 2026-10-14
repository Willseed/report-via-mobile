import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RUNNER = fileURLToPath(new URL('./collect-style-hashes-runner.mjs', import.meta.url));
const SOURCE_DIRECTORY = fileURLToPath(new URL('../src/', import.meta.url));
const MODULE_NAME = /^[A-Za-z0-9._-]+\.js$/;
const SERVICE_WORKER_FILES = new Set(['ngsw-worker.js', 'safety-worker.js', 'worker-basic.min.js']);
const COLLECTOR = '__reportCollectCompiledStyle';
const CUSTOM_STYLE_CONFIGURATION = new Set([
  'APP_ID',
  'CSS_VAR_NAMESPACE',
  'provideCssVarNamespacing',
]);

function compareCodeUnits(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function runCollector(directory, inventory) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [RUNNER],
      {
        cwd: directory,
        env: { PATH: '/usr/bin:/bin' },
        timeout: 30_000,
        maxBuffer: 4 * 1024 * 1024,
      },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
    child.stdin.on('error', reject);
    child.stdin.end(JSON.stringify(inventory));
  });
}

function propertyName(node) {
  if (ts.isComputedPropertyName(node)) return propertyName(node.expression);
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
  return null;
}

function isComponentTarget(node) {
  return (
    (ts.isPropertyAccessExpression(node) && node.name.text === 'ɵcmp') ||
    (ts.isElementAccessExpression(node) &&
      node.argumentExpression &&
      propertyName(node.argumentExpression) === 'ɵcmp')
  );
}

function containsRootSelector(node) {
  let found = false;
  function visit(child) {
    if (ts.isPropertyAssignment(child) && propertyName(child.name) === 'selectors') {
      function findSelector(selector) {
        if (ts.isStringLiteralLike(selector) && selector.text === 'app-root') found = true;
        ts.forEachChild(selector, findSelector);
      }
      findSelector(child.initializer);
    }
    ts.forEachChild(child, visit);
  }
  visit(node);
  return found;
}

function topLevelBinding(node) {
  for (let current = node; current; current = current.parent) {
    if (
      ts.isVariableDeclaration(current) &&
      ts.isIdentifier(current.name) &&
      ts.isVariableStatement(current.parent?.parent) &&
      ts.isSourceFile(current.parent.parent.parent)
    ) {
      return current.name.text;
    }
    if (ts.isClassDeclaration(current) && ts.isSourceFile(current.parent)) {
      return current.name?.text;
    }
  }
  if (ts.isBinaryExpression(node) && isComponentTarget(node.left)) {
    const target = node.left.expression;
    if (ts.isIdentifier(target)) return target.text;
  }
  throw new Error('The root component has no supported top-level binding.');
}

function callsRootBootstrap(node, rootBindings) {
  if (
    ts.isCallExpression(node) &&
    node.arguments.length > 0 &&
    ts.isIdentifier(node.arguments[0]) &&
    rootBindings.has(node.arguments[0].text)
  ) {
    return true;
  }
  return ts.forEachChild(node, (child) => callsRootBootstrap(child, rootBindings)) ?? false;
}

/** Instrument only temporary copies; production modules and Angular runtime stay unchanged. */
export function instrumentStyleModule(source, filename) {
  const parsed = ts.createSourceFile(
    filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS,
  );
  assert.equal(parsed.parseDiagnostics.length, 0, `${filename} is not valid JavaScript.`);
  const edits = [];
  const locations = [];
  const rootBindings = new Set();

  function record(initializer, owner) {
    assert.ok(initializer, `${filename} has a component without an initializer.`);
    const location = `${filename}:${initializer.getStart(parsed)}`;
    const expression = initializer.getText(parsed);
    locations.push(location);
    edits.push({
      start: initializer.getStart(parsed),
      end: initializer.end,
      replacement: `globalThis.${COLLECTOR}(${JSON.stringify(location)},(${expression}))`,
    });
    if (containsRootSelector(initializer)) rootBindings.add(topLevelBinding(owner));
  }

  function visit(node) {
    if (
      (ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node) ||
        ts.isMethodDeclaration(node)) &&
      propertyName(node.name) === 'ɵcmp'
    ) {
      throw new Error(`${filename} has an unsupported computed component definition.`);
    }
    if (ts.isPropertyDeclaration(node) && propertyName(node.name) === 'ɵcmp') {
      assert.ok(
        node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword),
        `${filename} has an unsupported non-static component definition.`,
      );
      record(node.initializer, node);
      return;
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      isComponentTarget(node.left)
    ) {
      assert.equal(
        node.operatorToken.kind,
        ts.SyntaxKind.EqualsToken,
        `${filename} has an unsupported conditional component initializer.`,
      );
      record(node.right, node);
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);

  let removedBootstrapCalls = 0;
  for (const statement of parsed.statements) {
    if (!ts.isExpressionStatement(statement)) continue;
    if (callsRootBootstrap(statement, rootBindings)) {
      edits.push({ start: statement.getStart(parsed), end: statement.end, replacement: '' });
      removedBootstrapCalls += 1;
    }
  }

  let instrumented = source;
  for (const edit of edits.toSorted((left, right) => right.start - left.start)) {
    instrumented =
      instrumented.slice(0, edit.start) + edit.replacement + instrumented.slice(edit.end);
  }
  return { source: instrumented, locations, removedBootstrapCalls, rootCount: rootBindings.size };
}

export function hashStyleText(style) {
  return `'sha256-${createHash('sha256').update(style).digest('base64')}'`;
}

/** Reject application overrides before assuming Angular's default scope and CSS namespace. */
export async function assertDefaultStyleConfiguration(sourceDirectory = SOURCE_DIRECTORY) {
  const files = (await readdir(sourceDirectory, { recursive: true }))
    .filter((filename) => filename.endsWith('.ts') && !filename.endsWith('.spec.ts'));
  const sources = await Promise.all(files.map(async (filename) => ({
    filename,
    source: await readFile(join(sourceDirectory, filename), 'utf8'),
  })));
  for (const { filename, source } of sources) {
    const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (
        (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) &&
        CUSTOM_STYLE_CONFIGURATION.has(node.text)
      ) {
        throw new Error(
          `${filename} uses ${node.text}; custom style scopes require a new inventory.`,
        );
      }
      ts.forEachChild(node, visit);
    }
    visit(parsed);
  }
}

/**
 * Enumerate every compiled component, including unused Material style loaders and lazy chunks.
 * The isolated runner imports trusted build modules but never bootstraps the application.
 * Any component definition not executed during module initialization aborts the build.
 */
export async function collectBuiltStyleHashes(buildDirectory) {
  await assertDefaultStyleConfiguration();
  const allJavaScript = (await readdir(buildDirectory, { recursive: true }))
    .filter((filename) => filename.endsWith('.js'))
    .toSorted(compareCodeUnits);
  assert.ok(
    allJavaScript.every((filename) => MODULE_NAME.test(filename)),
    'Nested or unusual JavaScript paths require an updated style inventory.',
  );
  const files = allJavaScript.filter((filename) => !SERVICE_WORKER_FILES.has(filename));
  assert.ok(files.length > 0, 'No production application modules were found.');
  const modules = await Promise.all(allJavaScript.map(async (filename) => ({
    filename,
    result: instrumentStyleModule(await readFile(join(buildDirectory, filename), 'utf8'), filename),
  })));
  const locations = [];
  const applicationModules = [];
  let removedBootstrapCalls = 0;
  let rootCount = 0;
  for (const { filename, result } of modules) {
    if (SERVICE_WORKER_FILES.has(filename)) {
      assert.equal(
        result.locations.length,
        0,
        'Service worker assets must not contain Angular components.',
      );
      continue;
    }
    locations.push(...result.locations);
    removedBootstrapCalls += result.removedBootstrapCalls;
    rootCount += result.rootCount;
    applicationModules.push({ filename, source: result.source });
  }
  assert.ok(locations.length > 0, 'The build contains no compiled Angular components.');
  assert.equal(rootCount, 1, 'Exactly one app-root component must be present.');
  assert.equal(removedBootstrapCalls, 1, 'Exactly one root bootstrap call must be removed.');
  const directory = await mkdtemp(join(tmpdir(), 'report-style-inventory-'));
  try {
    // Wait for every write before cleanup, including when one of them fails.
    const writes = await Promise.allSettled([
      writeFile(join(directory, 'package.json'), '{"type":"module"}\n'),
      ...applicationModules.map(({ filename, source }) =>
        writeFile(join(directory, filename), source)),
    ]);
    for (const result of writes) {
      if (result.status === 'rejected') throw result.reason;
    }
    const stdout = await runCollector(directory, { files, locations });
    return JSON.parse(stdout);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
