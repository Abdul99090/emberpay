import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bchToSatoshis,
  createInvoice,
  invoiceToLink,
  invoiceToPayload,
  payloadToInvoice,
  satoshisToBch,
} from '../src/invoice.js';

test('bchToSatoshis converts decimal strings exactly', () => {
  assert.equal(bchToSatoshis('0.01'), 1_000_000n);
  assert.equal(bchToSatoshis('1'), 100_000_000n);
  assert.equal(bchToSatoshis('0.00000001'), 1n);
  assert.equal(bchToSatoshis('12.34567891'), 1_234_567_891n);
  assert.throws(() => bchToSatoshis('0.000000001')); // 9 decimals
  assert.throws(() => bchToSatoshis('-1'));
  assert.throws(() => bchToSatoshis('abc'));
});

test('satoshisToBch is the exact inverse', () => {
  assert.equal(satoshisToBch(1_000_000n), '0.01');
  assert.equal(satoshisToBch(100_000_000n), '1');
  assert.equal(satoshisToBch(1n), '0.00000001');
  assert.equal(satoshisToBch(0n), '0');
  for (const s of ['0.01', '3.21', '0.00000001', '21000000']) {
    assert.equal(satoshisToBch(bchToSatoshis(s)), s);
  }
});

test('invoice payload round-trips through a link', () => {
  const invoice = createInvoice({
    to: 'bitcoincash:qqexampleaddress00000000000000000000000',
    amountSats: 250_000n,
    label: 'Hosting',
    memo: 'November',
    id: 'inv-test-1',
    createdAt: 1763000000,
  });
  const link = invoiceToLink(invoice, 'https://example.github.io/emberpay/');
  assert.ok(link.startsWith('https://example.github.io/emberpay/#/pay/'));
  const payload = link.split('/#/pay/')[1];
  assert.equal(invoiceToPayload(invoice), payload);
  const decoded = payloadToInvoice(payload);
  assert.deepEqual(decoded, invoice);
});

test('createInvoice rejects empty recipient and zero amount', () => {
  assert.throws(() => createInvoice({ to: '', amountSats: 1n }));
  assert.throws(() =>
    createInvoice({ to: 'bitcoincash:qqexample', amountSats: 0n }),
  );
});

test('payloadToInvoice rejects garbage', () => {
  assert.throws(() => payloadToInvoice('not-a-payload!!!'));
  assert.throws(() => payloadToInvoice(''));
});
