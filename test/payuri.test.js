import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPaymentUri, parsePaymentUri } from '../src/payuri.js';

const ADDR = 'bitcoincash:qq7f9s0ctutxdtcplt6m87dnfmcm3qm9juxz9c8a9v';

test('builds a BIP21 URI with amount, label and message', () => {
  const uri = buildPaymentUri({
    address: ADDR,
    amountSats: 1_000_000n,
    label: 'EmberPay',
    message: 'Logo design',
  });
  assert.ok(uri.startsWith(`${ADDR}?`));
  const parsed = parsePaymentUri(uri);
  assert.equal(parsed.address, ADDR);
  assert.equal(parsed.amountBch, '0.01');
  assert.equal(parsed.label, 'EmberPay');
  assert.equal(parsed.message, 'Logo design');
});

test('bare address round-trips with no parameters', () => {
  const uri = buildPaymentUri({ address: ADDR });
  assert.equal(uri, ADDR);
  assert.deepEqual(parsePaymentUri(uri), { address: ADDR });
});

test('rejects non-BCH URIs', () => {
  assert.throws(() => parsePaymentUri('bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'));
  assert.throws(() => buildPaymentUri({ address: 'no-prefix-here' }));
});
