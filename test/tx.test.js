import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeTransaction, hexToBin } from '@bitauth/libauth';
import {
  buildUnsignedPayment,
  estimateFeeSats,
  selectCoins,
} from '../src/tx.js';
import { addressesFromPrivateKey } from '../src/address.js';

const PRIVKEY_ONE = hexToBin(
  '0000000000000000000000000000000000000000000000000000000000000001',
);
const { mainnet: RECIPIENT } = addressesFromPrivateKey(PRIVKEY_ONE);
const FAKE_TXID = 'aa'.repeat(32);

test('fee estimate follows the 1 sat/byte P2PKH size model', () => {
  // 10 overhead + 148/input + 34/output
  assert.equal(estimateFeeSats(1, 2), 226n);
  assert.equal(estimateFeeSats(2, 2), 374n);
  assert.equal(estimateFeeSats(1, 1), 192n);
});

test('selectCoins picks largest-first and computes change', () => {
  const utxos = [
    { txid: FAKE_TXID, vout: 0, sats: '5000' },
    { txid: FAKE_TXID, vout: 1, sats: '200000' },
    { txid: FAKE_TXID, vout: 2, sats: '9000' },
  ];
  const { selected, totalIn, fee, change } = selectCoins(utxos, 100_000n);
  assert.equal(selected.length, 1);
  assert.equal(totalIn, 200_000n);
  assert.equal(fee, 226n);
  assert.equal(change, 99_774n);
});

test('selectCoins throws on insufficient funds', () => {
  const utxos = [{ txid: FAKE_TXID, vout: 0, sats: '1000' }];
  assert.throws(() => selectCoins(utxos, 100_000n), /insufficient funds/);
});

test('buildUnsignedPayment produces a decodable transaction', () => {
  const utxos = [{ txid: FAKE_TXID, vout: 3, sats: '200000' }];
  const { transaction, hex, fee, change } = buildUnsignedPayment({
    utxos,
    toAddress: RECIPIENT,
    amountSats: 100_000n,
    changeAddress: RECIPIENT,
  });
  assert.equal(fee, 226n);
  assert.equal(change, 99_774n);
  assert.equal(transaction.inputs.length, 1);
  assert.equal(transaction.outputs.length, 2);
  assert.equal(transaction.outputs[0].valueSatoshis, 100_000n);
  assert.equal(transaction.outputs[1].valueSatoshis, 99_774n);

  const decoded = decodeTransaction(hexToBin(hex));
  assert.notEqual(typeof decoded, 'string', `decode failed: ${decoded}`);
  assert.equal(decoded.inputs.length, 1);
  assert.equal(decoded.outputs.length, 2);
  assert.equal(decoded.outputs[0].valueSatoshis, 100_000n);
});
