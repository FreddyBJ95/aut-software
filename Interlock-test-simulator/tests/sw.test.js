import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const scope = 'https://example.test/aut-software/Interlock-test-simulator/';
const cachePrefix = `interlock-test-simulator:${scope}:`;
const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

function startWorker(cacheKeys = []) {
  const handlers = new Map();
  const deleted = [];
  const precached = new Map();
  const opened = new Set();
  let claimed = false;

  runInNewContext(source, {
    URL,
    Request,
    fetch: async () => { throw new TypeError('Offline'); },
    self: {
      registration: { scope },
      clients: { claim: async () => { claimed = true; } },
      addEventListener: (type, handler) => handlers.set(type, handler)
    },
    caches: {
      keys: async () => cacheKeys,
      delete: async key => { deleted.push(key); },
      open: async name => {
        opened.add(name);
        return {
          addAll: async requests => {
            for (const request of requests) precached.set(request.url, request);
          },
          match: async key => precached.get(typeof key === 'string' ? key : key.url)
        };
      }
    }
  });

  return {
    lifecycle(type) {
      let pending;
      handlers.get(type)({ waitUntil: promise => { pending = promise; } });
      return pending;
    },
    request(url, { method = 'GET', mode = 'same-origin' } = {}) {
      let response;
      handlers.get('fetch')({
        request: { url, method, mode },
        respondWith: promise => { response = promise; }
      });
      return response;
    },
    deleted,
    precached,
    opened,
    get claimed() { return claimed; }
  };
}

test('updating Interlock removes only its old cache entries', async () => {
  const worker = startWorker([
    'pipe-bend-v45',
    'another-app',
    'interlock-v5',
    'interlock-other-app',
    'interlock-test-simulator:https://example.test/another-scope/:v5',
    `${cachePrefix}v5`,
    `${cachePrefix}v6`
  ]);

  await worker.lifecycle('activate');

  assert.deepEqual(worker.deleted, ['interlock-v5', `${cachePrefix}v5`]);
  assert.equal(worker.claimed, true);
});

test('precache serves the app and its scripts offline under the Pages subpath', async () => {
  const worker = startWorker();
  await worker.lifecycle('install');

  const index = await worker.request(`${scope}?from=homescreen`, { mode: 'navigate' });
  assert.equal(index.url, `${scope}index.html`);
  for (const asset of ['styles.css?v=5', 'app.js?v=6', 'core.js', 'project.js', 'i18n.js']) {
    const request = await worker.request(new URL(asset, scope).href);
    assert.equal(request.cache, 'reload');
  }
  assert.deepEqual([...worker.opened], [`${cachePrefix}v6`]);
});

test('Interlock does not intercept sibling apps, external requests, or missing scripts', async () => {
  const worker = startWorker();
  await worker.lifecycle('install');

  assert.equal(worker.request('https://example.test/aut-software/Pipe-bend/index.html'), undefined);
  assert.equal(worker.request('https://other.test/script.js'), undefined);
  assert.equal(worker.request(`${scope}missing.js`), undefined);
  assert.equal(worker.request(`${scope}index.html`, { method: 'POST' }), undefined);
});
