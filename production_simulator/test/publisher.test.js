const test = require('node:test');
const assert = require('node:assert/strict');
const { NatsPublisher } = require('../src/publisher');

test('publisher drops immediately while disconnected and exposes bounded capacity', () => { const publisher = new NatsPublisher('nats://127.0.0.1:1'); assert.equal(publisher.publish('a.b', {}), false); assert.equal(publisher.health().dropped, 1); assert.equal(publisher.health().bufferCapacity, 0); });
