import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeUrl, fetchTarget } from '../assets/js/fetcher.js';
test('retains ordinary public URLs but removes browser-only fragments', () => {
  assert.equal(normalizeUrl('example.com/path?q=public#access_token=private'), 'https://example.com/path?q=public');
});
test('rejects credentials, signed URLs and private addresses', () => {
  for (const url of ['https://user:password@example.com/', 'https://example.com/?access_token=secret', 'https://example.com/?api-key=secret', 'https://example.com/?X-Amz-Signature=secret', 'http://127.1/', 'http://10.0.0.1/', 'http://192.168.1.1/', 'http://172.16.0.1/', 'http://169.254.169.254/', 'http://demo.local/']) {
    assert.throws(() => normalizeUrl(url), url);
  }
});
test('a rejected URL never reaches the proxy network call', async () => {
  const original = globalThis.fetch; let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('Unexpected network'); };
  try { await assert.rejects(fetchTarget('https://example.com/?token=secret')); assert.equal(called, false); }
  finally { globalThis.fetch = original; }
});
