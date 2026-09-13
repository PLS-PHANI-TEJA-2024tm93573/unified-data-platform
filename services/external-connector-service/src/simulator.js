const fs = require('fs');
const path = require('path');
const { connect, StringCodec } = require('nats');

const DEFAULT_CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, '..', 'asset-config.json');
const DEFAULT_NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const TOPIC = 'industrial.measurements';

function loadConfig(configPath) {
  const fullPath = path.resolve(configPath);
  const raw = fs.readFileSync(fullPath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('asset-config.json must contain an array of variables.');
  }

  return parsed;
}

function getValueRange(variableName) {
  const name = variableName.toLowerCase();

  if (name.includes('temperature')) {
    return { min: 50, max: 100 };
  }

  if (name.includes('speed')) {
    return { min: 50, max: 100 };
  }

  if (name.includes('pressure')) {
    return { min: 45, max: 95 };
  }

  if (name.includes('humidity')) {
    return { min: 30, max: 80 };
  }

  return { min: 50, max: 100 };
}

function randomNumberInRange(min, max) {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function randomIntegerInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildValueByDataType(variable) {
  const dataType = (variable.data_type || variable.dataType || 'FLOAT').trim().toUpperCase();
  const timestamp = new Date().toISOString();

  switch (dataType) {
    case 'FLOAT': {
      const { min, max } = getValueRange(variable.name || 'measurement');
      return randomNumberInRange(min, max);
    }
    case 'INTEGER': {
      const { min, max } = getValueRange(variable.name || 'measurement');
      return randomIntegerInRange(min, max);
    }
    case 'BOOLEAN':
      return Math.random() >= 0.5;
    case 'STRING':
      return `${variable.name || 'measurement'}-${timestamp}`;
    default: {
      const { min, max } = getValueRange(variable.name || 'measurement');
      return randomNumberInRange(min, max);
    }
  }
}

function buildPayload(variable) {
  const timestamp = new Date().toISOString();

  return {
    variable_id: variable.variable_id,
    variableId: variable.variable_id,
    timestamp,
    value: buildValueByDataType(variable),
  };
}

async function startPublishing() {
  const config = loadConfig(DEFAULT_CONFIG_PATH);
  const nc = await connect({ servers: DEFAULT_NATS_URL });
  const codec = StringCodec();

  console.log(`Connected to NATS at ${DEFAULT_NATS_URL}`);
  console.log(`Loaded ${config.length} variables from ${DEFAULT_CONFIG_PATH}`);

  config.forEach((variable) => {
    const cycleMs = Number(variable.acq_cycle || 1000);

    setInterval(() => {
      const payload = buildPayload(variable);
      const encodedPayload = codec.encode(JSON.stringify(payload));

      nc.publish(TOPIC, encodedPayload);
      console.log(
        `[${new Date().toISOString()}] Published ${variable.name} (${variable.variable_id}) to ${TOPIC}: ${JSON.stringify(payload)}`,
      );
    }, cycleMs);
  });

  const shutdown = async () => {
    console.log('Shutting down external connector...');
    await nc.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startPublishing().catch((error) => {
  console.error('Failed to start external connector service:', error.message);
  process.exit(1);
});
