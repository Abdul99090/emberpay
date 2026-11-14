import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInvoiceText } from '../src/nlp.js';

const ADDR = 'bitcoincash:qq7f9s0ctutxdtcplt6m87dnfmcm3qm9juxz9c8a9v';

test('parses BCH amount, address, label and memo', () => {
  const out = parseInvoiceText(
    `Charge 0.01 BCH to ${ADDR} for the logo design, note: due Friday`,
  );
  assert.equal(out.amountSats, '1000000');
  assert.equal(out.to, ADDR);
  assert.equal(out.label, 'The logo design');
  assert.equal(out.memo, 'due Friday');
  assert.deepEqual(out.missing, []);
});

test('parses satoshi amounts', () => {
  const out = parseInvoiceText('Invoice 25000 sats for monthly hosting');
  assert.equal(out.amountSats, '25000');
  assert.equal(out.label, 'Monthly hosting');
  assert.deepEqual(out.missing, ['recipient']);
});

test('parses plain BCH amount without address', () => {
  const out = parseInvoiceText('Ask 1.5 BCH for consulting');
  assert.equal(out.amountSats, '150000000');
  assert.equal(out.label, 'Consulting');
  assert.deepEqual(out.missing, ['recipient']);
});

test('empty input reports everything missing', () => {
  const out = parseInvoiceText('   ');
  assert.equal(out.amountSats, null);
  assert.deepEqual(out.missing, ['amount', 'recipient']);
});
