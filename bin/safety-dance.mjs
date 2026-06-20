#!/usr/bin/env node

import { readFileSync } from 'node:fs';

import {
  checkCompatibility,
  getModelCapability,
  listModels,
  listModelsAsync,
  getModelCapabilityAsync,
  validateManifest,
  validateCapability,
  validateReport,
} from '../index.mjs';

const [, , command, ...args] = process.argv;

try {
  switch (command) {
    case 'models':
      await handleModels(args);
      break;
    case 'validate':
      handleValidate(args);
      break;
    case 'check':
      await handleCheck(args);
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      printUsage();
      process.exit(command ? 0 : 1);
      break;
    default:
      fail(`Unknown command: ${command}`);
  }
} catch (error) {
  fail(error.message);
}

async function handleModels(args) {
  const useOpenRouter = args.includes('--openrouter') || args.includes('--all');
  const models = useOpenRouter ? await listModelsAsync() : listModels();
  for (const model of models) {
    console.log(model);
  }
}

function handleValidate(args) {
  const [type, filePath] = args;
  if (!type || !filePath) {
    fail('Usage: safety-dance validate <manifest|capability|report> <file.json>');
  }

  const validators = {
    manifest: validateManifest,
    capability: validateCapability,
    report: validateReport,
  };
  const validator = validators[type];
  if (!validator) {
    fail(`Unknown validation type: ${type}`);
  }

  const document = readJson(filePath);
  const result = validator(document);
  printJson(result);
  process.exit(result.valid ? 0 : 1);
}

async function handleCheck(args) {
  const [manifestPath, capabilityArg] = args;
  if (!manifestPath || !capabilityArg) {
    fail('Usage: safety-dance check <manifest.json> <capability.json|provider/model_id>');
  }

  const manifest = readJson(manifestPath);
  const capability = capabilityArg.endsWith('.json')
    ? readJson(capabilityArg)
    : await lookupCapabilityAsync(capabilityArg);

  const result = checkCompatibility(manifest, capability);
  printJson(result);
  process.exit(result.compatible ? 0 : 1);
}

async function lookupCapabilityAsync(value) {
  const slash = value.indexOf('/');
  if (slash === -1) {
    fail('Capability argument must be a JSON file path or provider/model_id');
  }
  const provider = value.slice(0, slash);
  const modelId = value.slice(slash + 1);
  const capability = await getModelCapabilityAsync(provider, modelId);
  if (!capability) {
    fail(`Unknown model: ${value} (not found in local registry or OpenRouter)`);
  }
  return capability;
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to read JSON from ${filePath}: ${error.message}`);
  }
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printUsage() {
  console.error(`Safety Dance CLI

Usage:
  safety-dance models [--openrouter|--all]
  safety-dance validate <manifest|capability|report> <file.json>
  safety-dance check <manifest.json> <capability.json|provider/model_id>

Options:
  models --openrouter   Include all models from OpenRouter
  models --all          Same as --openrouter
  check                 Automatically falls back to OpenRouter when
                        a model is not found in the local registry
`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
