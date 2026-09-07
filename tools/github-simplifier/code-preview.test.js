const test = require('node:test');
const assert = require('node:assert');
const { formatBytes } = require('./code-preview.js');

test('formatBytes', async (t) => {
  await t.test('handles invalid inputs gracefully', () => {
    assert.strictEqual(formatBytes(null), '0 B');
    assert.strictEqual(formatBytes(undefined), '0 B');
    assert.strictEqual(formatBytes(NaN), '0 B');
    assert.strictEqual(formatBytes(Infinity), 'Infinity B');
    assert.strictEqual(formatBytes(-Infinity), '0 B');
    assert.strictEqual(formatBytes('invalid'), 'NaN B');
  });

  await t.test('formats bytes correctly (< 1024 B)', () => {
    assert.strictEqual(formatBytes(0), '0 B');
    assert.strictEqual(formatBytes(1), '1 B');
    assert.strictEqual(formatBytes(500), '500 B');
    assert.strictEqual(formatBytes(1023), '1023 B');
    assert.strictEqual(formatBytes(1023.9), '1024 B'); // Math.round
  });

  await t.test('formats negative valid numbers to 0 B', () => {
      assert.strictEqual(formatBytes(-100), '0 B');
      assert.strictEqual(formatBytes(-1), '0 B');
  });

  await t.test('formats kilobytes correctly (1024 B to < 1048576 B)', () => {
    assert.strictEqual(formatBytes(1024), '1.0 KB');
    assert.strictEqual(formatBytes(1024 * 1.5), '1.5 KB');
    assert.strictEqual(formatBytes(1024 * 10), '10 KB'); // >= 10 uses 0 decimal places
    assert.strictEqual(formatBytes(1024 * 9.99), '10.0 KB');
    assert.strictEqual(formatBytes(1024 * 10.5), '11 KB');
    assert.strictEqual(formatBytes(1024 * 999), '999 KB');
  });

  await t.test('formats megabytes correctly (1048576 B to < 1073741824 B)', () => {
    assert.strictEqual(formatBytes(1024 * 1024), '1.0 MB');
    assert.strictEqual(formatBytes(1024 * 1024 * 5.25), '5.3 MB'); // 1 decimal place if < 10
    assert.strictEqual(formatBytes(1024 * 1024 * 50.5), '51 MB'); // 0 decimal place if >= 10
  });

  await t.test('formats gigabytes correctly (>= 1073741824 B)', () => {
    assert.strictEqual(formatBytes(1024 * 1024 * 1024), '1.0 GB');
    assert.strictEqual(formatBytes(1024 * 1024 * 1024 * 2.5), '2.5 GB');
    assert.strictEqual(formatBytes(1024 * 1024 * 1024 * 100), '100 GB');
  });
});
