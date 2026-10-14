import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const { files, locations } = JSON.parse(await text(process.stdin));
assert.ok(Array.isArray(files) && Array.isArray(locations), 'Invalid style inventory request.');
assert.ok(files.every((name) => /^[A-Za-z0-9._-]+\.js$/.test(name)));
const expected = new Set(locations);
assert.equal(expected.size, locations.length, 'Component inventory locations must be unique.');
const components = new Map();
const styles = new Set([
  // CDK MediaMatcher creates an empty style element, then adds rules through CSSOM.
  '',
]);
const dom = new JSDOM(undefined, { url: 'https://tools.pylot.dev/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, ngDevMode: false });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

globalThis.__reportCollectCompiledStyle = (location, definition) => {
  assert.ok(expected.has(location), `Unexpected component definition: ${location}`);
  assert.ok(!components.has(location), `Component initialized more than once: ${location}`);
  assert.match(definition.id, /^c[0-9]+$/, `Invalid component ID at ${location}`);
  assert.ok(Array.isArray(definition.styles), `Missing component styles at ${location}`);
  assert.ok([0, 2, 3].includes(definition.encapsulation), `Unknown encapsulation at ${location}`);
  assert.ok(
    !definition.getExternalStyles,
    `External runtime styles need a new inventory at ${location}`,
  );
  for (const style of definition.styles) {
    assert.equal(typeof style, 'string', `Non-static style at ${location}`);
    // The parent rejects APP_ID and CSS_VAR_NAMESPACE overrides in application sources.
    const componentId =
      definition.encapsulation === 0 ? `ng-${definition.id}` : definition.id;
    const scoped = definition.encapsulation === 2 ? style : style.replaceAll('%COMP%', componentId);
    styles.add(scoped.replaceAll('%NS%', ''));
  }
  components.set(location, {
    location,
    id: definition.id,
    encapsulation: definition.encapsulation,
    styleCount: definition.styles.length,
  });
  return definition;
};

// Imports execute only the emitted module declarations. The collector removes app bootstrap.
for (const filename of files) await import(pathToFileURL(join(process.cwd(), filename)).href);
assert.deepEqual(
  [...components.keys()].sort(),
  [...expected].sort(),
  'Not every compiled component was initialized; runtime-only definitions are unsupported.',
);
const hashes = [...styles]
  .map((style) => `'sha256-${createHash('sha256').update(style).digest('base64')}'`)
  .sort();
process.stdout.write(JSON.stringify({
  hashes,
  componentCount: components.size,
  components: [...components.values()],
}));
dom.window.close();
