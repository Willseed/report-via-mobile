import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  assertDefaultStyleConfiguration,
  collectBuiltStyleHashes,
  hashStyleText,
  instrumentStyleModule,
} from './collect-style-hashes.mjs';

const MAIN = `
export const define = value => value;
export class Root {
  static ɵcmp = define({id: 'c100', selectors: [['app-root']], encapsulation: 0,
    styles: ['[_ngcontent-%COMP%]{--%NS%color:red}']});
}
class UnrenderedMaterialLoader {
  static ɵcmp = define({id: 'c101', encapsulation: 2, styles: ['.unused{color:blue}']});
}
function bootstrap(root, options) { throw new Error('App bootstrap must never execute.'); }
bootstrap(Root, {}).catch(console.error);
`;

async function fixture(t, files = { 'main-test.js': MAIN }) {
  const directory = await mkdtemp(join(tmpdir(), 'report-style-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [filename, source] of Object.entries(files)) {
    await writeFile(join(directory, filename), source);
  }
  return directory;
}

test('collects every definition, including lazy and unrendered component styles', async (t) => {
  const directory = await fixture(t, {
    'main-test.js': MAIN,
    'chunk-lazy.js': `
      import {define} from './main-test.js';
      class Lazy {
        static ['ɵcmp'] = define({id: 'c102', encapsulation: 0,
          styles: ['.lazy-%COMP%{color:green}']});
      }
      class Shadow {}
      Shadow.ɵcmp = define({id: 'c103', encapsulation: 3, styles: ['.%COMP%{--%NS%color:black}']});
    `,
    'ngsw-worker.js': 'throw new Error("Service worker must not run in inventory.");',
  });
  const result = await collectBuiltStyleHashes(directory);
  assert.equal(result.componentCount, 4);
  assert.deepEqual(result.hashes, [
    hashStyleText(''),
    hashStyleText('[_ngcontent-ng-c100]{--color:red}'),
    hashStyleText('.unused{color:blue}'),
    hashStyleText('.lazy-ng-c102{color:green}'),
    hashStyleText('.c103{--color:black}'),
  ].sort());
  assert.equal(await readFile(join(directory, 'main-test.js'), 'utf8'), MAIN);
  assert.equal(globalThis.__reportCollectCompiledStyle, undefined);
});

test('fails closed when a compiled component is hidden in an unexecuted function', async (t) => {
  const directory = await fixture(t, {
    'main-test.js': `${MAIN}
      function deferredFactory() {
        return class {
          static ɵcmp = define({id: 'c104', encapsulation: 2, styles: ['.hidden{color:red}']});
        };
      }
    `,
  });
  await assert.rejects(collectBuiltStyleHashes(directory), /Not every compiled component/);
});

test('fails closed on unrecognized encapsulation and dynamic style values', async (t) => {
  const directory = await fixture(t, {
    'main-test.js': MAIN.replace('encapsulation: 0', 'encapsulation: 99'),
  });
  await assert.rejects(collectBuiltStyleHashes(directory), /Unknown encapsulation/);
  await writeFile(
    join(directory, 'main-test.js'),
    MAIN.replace("styles: ['.unused{color:blue}']", 'styles: [() => "dynamic"]'),
  );
  await assert.rejects(collectBuiltStyleHashes(directory), /Non-static style/);
});

test('rejects unsupported root bootstrap or JavaScript layout', async (t) => {
  const directory = await fixture(t, {
    'main-test.js': MAIN.replace('bootstrap(Root, {}).catch(console.error);', ''),
  });
  await assert.rejects(collectBuiltStyleHashes(directory), /Exactly one root bootstrap/);
  await mkdir(join(directory, 'lazy'));
  await writeFile(join(directory, 'lazy', 'component.js'), 'export const value = 1;');
  await assert.rejects(collectBuiltStyleHashes(directory), /Nested or unusual JavaScript paths/);
});

test('rejects component accessors and non-static component definitions', () => {
  assert.throws(
    () => instrumentStyleModule(
      'class Component { static get ɵcmp() { return null; } }', 'main.js',
    ),
    /unsupported computed component/,
  );
  assert.throws(
    () => instrumentStyleModule('class Component { ɵcmp = {}; }', 'main.js'),
    /unsupported non-static component/,
  );
});

test('rejects application scope overrides, including aliases and namespace imports', async (t) => {
  const directory = await fixture(t, {
    'app.ts': 'export const app = {};',
    'app.spec.ts': 'const APP_ID = "test";',
  });
  await assertDefaultStyleConfiguration(directory);
  for (const source of [
    'import {APP_ID as scope} from "@angular/core";',
    'import * as browser from "@angular/platform-browser"; ' +
      'browser.provideCssVarNamespacing("app");',
    'const override = browser["CSS_VAR_NAMESPACE"];',
  ]) {
    await writeFile(join(directory, 'app.ts'), source);
    await assert.rejects(assertDefaultStyleConfiguration(directory), /custom style scopes require/);
  }
});
