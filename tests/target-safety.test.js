import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateStressOptions } from '../src/utils/targetSafety.js';

test('localhost stress target is allowed without ownership flag', () => {
    const options = validateStressOptions({ target: 'http://localhost:3000' });

    assert.equal(options.target, 'http://localhost:3000');
    assert.equal(options.local, true);
});

test('127.0.0.1 stress target is allowed without ownership flag', () => {
    const options = validateStressOptions({ target: 'http://127.0.0.1:3000' });

    assert.equal(options.local, true);
});

test('stress target path is preserved as explicit endpoint path', () => {
    const options = validateStressOptions({ target: 'http://localhost:3000/app' });

    assert.equal(options.target, 'http://localhost:3000/app');
    assert.equal(options.artilleryTarget, 'http://localhost:3000');
    assert.equal(options.targetPath, '/app');
});

test('external stress target is blocked without ownership flag', () => {
    assert.throws(
        () => validateStressOptions({ target: 'https://example.com' }),
        /Refusing to stress-test an external target/,
    );
});

test('external stress target is allowed with ownership flag', () => {
    const options = validateStressOptions({ target: 'https://example.com', iOwnThis: true });

    assert.equal(options.target, 'https://example.com');
    assert.equal(options.local, false);
});

test('too high stress duration is blocked', () => {
    assert.throws(() => validateStressOptions({ duration: 301 }), /Maximum allowed is 300 seconds/);
});
