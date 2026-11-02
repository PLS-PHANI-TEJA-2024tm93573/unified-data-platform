const { connect, StringCodec } = require('nats');

class NatsPublisher {
  constructor(url = process.env.NATS_URL || 'nats://localhost:4222') {
    this.url = url; this.codec = StringCodec(); this.connection = null; this.connected = false; this.published = 0; this.dropped = 0; this.lastPublishedAt = null;
  }
  async start() {
    try {
      this.connection = await connect({ servers: this.url, maxReconnectAttempts: -1 }); this.connected = true;
      void (async () => { for await (const status of this.connection.status()) { if (status.type === 'disconnect') this.connected = false; if (status.type === 'reconnect') this.connected = true; } })().catch(() => { this.connected = false; });
      void this.connection.closed().then(() => { this.connected = false; });
    } catch (error) { this.connected = false; console.error(`NATS connection failed (${this.url}): ${error.message}`); }
  }
  publish(subject, message) {
    // Core NATS publish is non-blocking. A disconnected broker drops immediately;
    // the client cannot durably buffer Core NATS messages.
    if (!this.connected || !this.connection || this.connection.isClosed()) { this.dropped++; return false; }
    try { this.connection.publish(subject, this.codec.encode(JSON.stringify(message))); this.published++; this.lastPublishedAt = new Date().toISOString(); return true; }
    catch (error) { this.dropped++; console.error(`NATS publish failed for ${subject}: ${error.message}`); return false; }
  }
  health() { return { connected: this.connected && !!this.connection && !this.connection.isClosed(), url: this.url, published: this.published, dropped: this.dropped, lastPublishedAt: this.lastPublishedAt, bufferCapacity: 0, mode: 'Core NATS; no durable queue' }; }
  async close() { if (this.connection && !this.connection.isClosed()) await this.connection.drain(); this.connected = false; }
}
module.exports = { NatsPublisher };
