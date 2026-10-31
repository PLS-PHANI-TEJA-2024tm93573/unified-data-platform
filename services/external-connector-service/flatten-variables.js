#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const VALID_ACQ_CYCLES = [1000, 500, 1500, 2000];

function parseArgs(argv) {
  const positionalArgs = [];
  const options = {
    acqCycle: 1000,
    outputPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg.startsWith('--acq-cycle=')) {
      const value = Number.parseInt(arg.split('=')[1], 10);
      if (!VALID_ACQ_CYCLES.includes(value)) {
        throw new Error(
          `Invalid acq_cycle value: ${value}. Allowed values are ${VALID_ACQ_CYCLES.join(', ')}`,
        );
      }
      options.acqCycle = value;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    positionalArgs.push(arg);
  }

  const inputPath = positionalArgs[0] || 'asset-model-hierarchy.json';
  const outputPath = positionalArgs[1] || null;

  return { inputPath, outputPath, acqCycle: options.acqCycle, help: options.help };
}

function printUsage() {
  console.log(`Usage:
  node flatten-variables.js <input-json> [output-json] [--acq-cycle=<value>]

  Supported acq_cycle values: ${VALID_ACQ_CYCLES.join(', ')} ms

  Example:
  node flatten-variables.js asset-model-hierarchy.json flattened-variables.json --acq-cycle=1500
`);
}

function collectChildVariables(roots) {
  const uniqueVariables = new Map();

  const visit = (node, isRootNode = false) => {
    if (!node) {
      return;
    }

    if (!isRootNode && Array.isArray(node.variables)) {
      for (const variable of node.variables) {
        if (!variable || !variable.id || !variable.name) {
          continue;
        }

        if (!uniqueVariables.has(variable.id)) {
          uniqueVariables.set(variable.id, {
            variable_id: variable.id,
            name: variable.name,
            data_type: variable.data_type ?? variable.dataType ?? null,
            acq_cycle: null,
          });
        }
      }
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        visit(child, false);
      }
    }
  };

  for (const root of roots) {
    visit(root, true);
  }

  return Array.from(uniqueVariables.values());
}

function main() {
  try {
    const { inputPath, outputPath, acqCycle, help } = parseArgs(process.argv.slice(2));

    if (help) {
      printUsage();
      return;
    }

    const fullInputPath = path.resolve(process.cwd(), inputPath);
    const raw = fs.readFileSync(fullInputPath, 'utf8');
    const payload = JSON.parse(raw);
    const roots = Array.isArray(payload.roots) ? payload.roots : [payload];

    const flattenedVariables = collectChildVariables(roots).map((variable) => ({
      variable_id: variable.variable_id,
      name: variable.name,
      acq_cycle: acqCycle,
      data_type: variable.data_type,
    }));

    const formattedJson = JSON.stringify(flattenedVariables, null, 2);

    if (outputPath) {
      const fullOutputPath = path.resolve(process.cwd(), outputPath);
      fs.writeFileSync(fullOutputPath, `${formattedJson}\n`, 'utf8');
      console.log(`Flattened variables written to ${fullOutputPath}`);
    } else {
      console.log(formattedJson);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    printUsage();
    process.exitCode = 1;
  }
}

main();
