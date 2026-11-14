import { test } from 'node:test';
import assert from 'node:assert/strict';
import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  addressesFromPrivateKey,
  derivePayload,
  isValidAddress,
  validateAddress,
} from '../src/address.js';

// Private key = 1: the secp256k1 generator point. Its hash160 is a
// well-known constant (used across BIP32 test material).
const PRIVKEY_ONE = hexToBin(
  '0000000000000000000000000000000000000000000000000000000000000001',
);
const HASH160_OF_ONE = '751e76e8199196d454941c45d1b3a323f1433bd6';

test('derives the known hash160 for private key 1', () => {
  const { payload } = derivePayload(PRIVKEY_ONE);
  assert.equal(binToHex(payload), HASH160_OF_ONE);
});

test('produces all four address flavours, each decoding back to the payload', () => {
  const addresses = addressesFromPrivateKey(PRIVKEY_ONE);
  assert.ok(addresses.mainnet.startsWith('bitcoincash:q'));
  assert.ok(addresses.mainnetToken.startsWith('bitcoincash:z'));
  assert.ok(addresses.chipnet.startsWith('bchtest:q'));
  assert.ok(addresses.chipnetToken.startsWith('bchtest:z'));
  for (const addr of Object.values(addresses)) {
    assert.equal(binToHex(validateAddress(addr).payload), HASH160_OF_ONE);
    assert.ok(isValidAddress(addr));
  }
  assert.equal(validateAddress(addresses.mainnet).type, 'p2pkh');
  assert.equal(validateAddress(addresses.mainnetToken).type, 'p2pkhWithTokens');
});

test('rejects malformed addresses', () => {
  assert.equal(isValidAddress('bitcoincash:not-a-real-address'), false);
  assert.equal(isValidAddress('bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'), false);
  assert.equal(isValidAddress(''), false);
});
