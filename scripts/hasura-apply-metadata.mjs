import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function loadEnvLocal() {
  const envPath = path.join(repoRoot, '.env.local');
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

loadEnvLocal();

const endpoint = (process.env.HASURA_GRAPHQL_ENDPOINT || 'http://localhost:8086').replace(/\/+$/, '');
const adminSecret = process.env.HASURA_GRAPHQL_ADMIN_SECRET || '';
const metadataPath = path.join(repoRoot, 'hasura', 'metadata', 'metadata.json');

if (!fs.existsSync(metadataPath)) {
  console.error('metadata file not found:', metadataPath);
  process.exit(1);
}

if (!adminSecret) {
  console.error('HASURA_GRAPHQL_ADMIN_SECRET is required in .env.local or environment');
  process.exit(1);
}

const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

const payload = {
  type: 'replace_metadata',
  args: {
    metadata,
    allow_inconsistent_metadata: false,
  },
};

const res = await fetch(`${endpoint}/v1/metadata`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-hasura-admin-secret': adminSecret,
  },
  body: JSON.stringify(payload),
});

const data = await res.json().catch(() => ({}));
if (!res.ok || data?.error) {
  console.error('Hasura metadata apply failed:', JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log('Hasura metadata applied successfully.');
