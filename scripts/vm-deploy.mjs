import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const packageManagerCommand = isWindows ? 'pnpm.cmd' : 'corepack';
const packageManagerPrefix = isWindows ? [] : ['pnpm'];

function loadEnvFile(filename) {
  const envPath = path.join(repoRoot, filename);
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile('.env.vm');
loadEnvFile('.env.local');

function runStep(label, command, args, options = {}, usePackageManagerPrefix = false) {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${label}`);
    const fullArgs = usePackageManagerPrefix ? [...packageManagerPrefix, ...args] : args;
    const child = spawn(command, fullArgs, {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false,
      ...options,
    });

    child.on('error', (error) => reject(error));
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} failed with exit code ${code}`));
      }
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSmokeCheck(label, url, { attempts = 5, delayMs = 1500 } = {}) {
  if (!url) return;
  console.log(`\n> Smoke check: ${label} (${url})`);
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        throw new Error(`${label} returned HTTP ${res.status}`);
      }

      const text = await res.text();
      console.log(text.slice(0, 200));
      return;
    } catch (error) {
      lastError = error;
      console.log(`  intento ${attempt}/${attempts} falló: ${error?.message || error}`);
      if (attempt < attempts) {
        await delay(delayMs);
      }
    }
  }

  throw lastError || new Error(`${label} smoke check failed`);
}

const steps = [
  ['Actualizar repo', 'git', ['pull', '--ff-only', 'origin', 'main'], {}, false],
  ['Instalar dependencias', packageManagerCommand, ['install', '--frozen-lockfile'], {}, true],
  ['Migrar base de datos', packageManagerCommand, ['db:migrate'], {}, true],
  ['Aplicar metadata Hasura', packageManagerCommand, ['hasura:apply'], {}, true],
  ['Recrear servicios VM', packageManagerCommand, ['vm:up'], {}, true],
  ['Mostrar estado', packageManagerCommand, ['vm:ps'], {}, true],
];

try {
  for (const [label, command, args, options, usePackageManagerPrefix] of steps) {
    await runStep(label, command, args, options, usePackageManagerPrefix);
  }

  await runSmokeCheck('API health local', process.env.FINANCE_API_HEALTH_URL || 'http://127.0.0.1:4100/health');
  await runSmokeCheck('Web home local', process.env.FINANCE_WEB_HEALTH_URL || 'http://127.0.0.1:3005');

  console.log('\nDespliegue completado.');
} catch (error) {
  console.error('\nDespliegue fallido:', error?.message || error);
  process.exit(1);
}
