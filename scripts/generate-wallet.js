/**
 * Generate the EmberPay project wallet (donations / EMBER2026 voting).
 *
 * The private key is written OUTSIDE the repository, to
 *   ~/workspace/hackathons/bch-blaze/.secrets/project-wallet.json (0600)
 * and is never printed. Only public addresses go into the repo
 * (project-addresses.json) and stdout.
 *
 * Usage: node scripts/generate-wallet.js
 */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { binToHex, secp256k1 } from '@bitauth/libauth';
import { addressesFromPrivateKey, derivePayload } from '../src/address.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const secretsDir = join(homedir(), 'workspace/hackathons/bch-blaze/.secrets');
const secretsFile = join(secretsDir, 'project-wallet.json');

if (existsSync(secretsFile)) {
  console.error(`Refusing to overwrite existing wallet file: ${secretsFile}`);
  process.exit(1);
}

// Generate a valid secp256k1 private key (rejection-sample the tiny
// range of invalid scalars).
let privateKey;
do {
  privateKey = new Uint8Array(randomBytes(32));
} while (typeof secp256k1.derivePublicKeyCompressed(privateKey) === 'string');

const { publicKey } = derivePayload(privateKey);
const addresses = addressesFromPrivateKey(privateKey);

mkdirSync(secretsDir, { recursive: true });
writeFileSync(
  secretsFile,
  JSON.stringify(
    {
      project: 'EmberPay (BCH BLAZE 2026)',
      createdAt: new Date().toISOString(),
      privateKeyHex: binToHex(privateKey),
      publicKeyHex: binToHex(publicKey),
      addresses,
      note: 'SECRET — never commit, never share. Holds donation/voting funds only.',
    },
    null,
    2,
  ),
  { mode: 0o600 },
);

writeFileSync(
  join(repoRoot, 'project-addresses.json'),
  JSON.stringify(
    {
      project: 'EmberPay',
      purpose:
        'Public project addresses. mainnetToken receives CashTokens (incl. EMBER2026 Community-Choice votes); mainnet receives BCH donations.',
      ...addresses,
    },
    null,
    2,
  ),
);

console.log('EmberPay project wallet created.');
console.log(`  BCH (mainnet):        ${addresses.mainnet}`);
console.log(`  CashTokens (mainnet): ${addresses.mainnetToken}`);
console.log(`  Chipnet (testnet):    ${addresses.chipnet}`);
console.log(`  Key stored at:        ${secretsFile} (mode 0600, outside repo)`);
