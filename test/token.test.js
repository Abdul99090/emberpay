import { test } from 'node:test';
import assert from 'node:assert/strict';
import { binToHex, decodeTransaction, hexToBin } from '@bitauth/libauth';
import {
  createInvoice,
  invoiceToPayload,
  payloadToInvoice,
} from '../src/invoice.js';
import { buildUnsignedTokenPayment } from '../src/tx.js';
import { addressesFromPrivateKey } from '../src/address.js';
import { parseInvoiceText } from '../src/nlp.js';

const PRIVKEY_ONE = hexToBin(
  '0000000000000000000000000000000000000000000000000000000000000001',
);
const ADDRS = addressesFromPrivateKey(PRIVKEY_ONE);
const CATEGORY = 'cd'.repeat(32);
const FAKE_TXID = 'bb'.repeat(32);

test('token invoice round-trips with its asset intact', () => {
  const invoice = createInvoice({
    to: ADDRS.mainnetToken,
    asset: { type: 'cashtoken', category: CATEGORY, amount: '200', symbol: 'EMBER' },
    label: 'Sticker pack',
    id: 'inv-token-1',
    createdAt: 1763000000,
  });
  assert.equal(invoice.amountSats, '1000'); // default carrier
  const decoded = payloadToInvoice(invoiceToPayload(invoice));
  assert.deepEqual(decoded, invoice);
});

test('token invoice validates category and amount', () => {
  assert.throws(() =>
    createInvoice({ to: ADDRS.mainnetToken, asset: { type: 'cashtoken', category: 'xyz', amount: '5' } }),
  );
  assert.throws(() =>
    createInvoice({ to: ADDRS.mainnetToken, asset: { type: 'cashtoken', category: CATEGORY, amount: '0' } }),
  );
});

test('assistant parses token phrasing', () => {
  const out = parseInvoiceText(`Charge 100 EMBER tokens for the sticker pack, category ${CATEGORY}`);
  assert.equal(out.tokenAmount, '100');
  assert.equal(out.tokenSymbol, 'EMBER');
  assert.equal(out.tokenCategory, CATEGORY);
  assert.equal(out.label, 'The sticker pack');
});

test('fungible token payment conserves tokens and decodes correctly', () => {
  const tokenUtxos = [
    { txid: FAKE_TXID, vout: 0, sats: '1500', token: { category: CATEGORY, amount: '500' } },
  ];
  const fundingUtxos = [{ txid: FAKE_TXID, vout: 1, sats: '100000' }];
  const { hex, fee, tokenChange, change } = buildUnsignedTokenPayment({
    tokenUtxos,
    fundingUtxos,
    asset: { type: 'cashtoken', category: CATEGORY, amount: '200' },
    toTokenAddress: ADDRS.mainnetToken,
    changeTokenAddress: ADDRS.mainnetToken,
    changeAddress: ADDRS.mainnet,
  });
  assert.equal(tokenChange, 300n); // 500 in − 200 paid
  assert.equal(fee, 488n); // 2 in / 3 out @1sat/B + 2 token-output surcharges
  assert.equal(change, 99_012n); // 101500 − 2000 carriers − 488 fee

  const decoded = decodeTransaction(hexToBin(hex));
  assert.notEqual(typeof decoded, 'string', `decode failed: ${decoded}`);
  assert.equal(decoded.outputs.length, 3);
  assert.equal(binToHex(decoded.outputs[0].token.category), CATEGORY);
  assert.equal(decoded.outputs[0].token.amount, 200n);
  assert.equal(decoded.outputs[1].token.amount, 300n);
  assert.equal(decoded.outputs[2].token, undefined);
});

test('NFT payment moves exactly the requested NFT', () => {
  const tokenUtxos = [
    {
      txid: FAKE_TXID, vout: 2, sats: '2000',
      token: { category: CATEGORY, amount: '0', nft: { capability: 'none', commitment: 'abcd' } },
    },
  ];
  const fundingUtxos = [{ txid: FAKE_TXID, vout: 3, sats: '50000' }];
  const { hex, tokenChange } = buildUnsignedTokenPayment({
    tokenUtxos,
    fundingUtxos,
    asset: { type: 'cashtoken', category: CATEGORY, nft: { capability: 'none', commitment: 'abcd' } },
    toTokenAddress: ADDRS.mainnetToken,
    changeTokenAddress: ADDRS.mainnetToken,
    changeAddress: ADDRS.mainnet,
  });
  assert.equal(tokenChange, 0n);
  const decoded = decodeTransaction(hexToBin(hex));
  assert.notEqual(typeof decoded, 'string');
  assert.equal(decoded.outputs[0].token.nft.capability, 'none');
  assert.equal(binToHex(decoded.outputs[0].token.nft.commitment), 'abcd');
});

test('token payment refuses insufficient tokens and wrong NFTs', () => {
  const poor = [
    { txid: FAKE_TXID, vout: 0, sats: '1500', token: { category: CATEGORY, amount: '100' } },
  ];
  assert.throws(
    () =>
      buildUnsignedTokenPayment({
        tokenUtxos: poor,
        asset: { type: 'cashtoken', category: CATEGORY, amount: '200' },
        toTokenAddress: ADDRS.mainnetToken,
        changeTokenAddress: ADDRS.mainnetToken,
        changeAddress: ADDRS.mainnet,
      }),
    /insufficient tokens/,
  );
  const wrongNft = [
    {
      txid: FAKE_TXID, vout: 0, sats: '2000',
      token: { category: CATEGORY, amount: '0', nft: { capability: 'none', commitment: 'ffff' } },
    },
  ];
  assert.throws(
    () =>
      buildUnsignedTokenPayment({
        tokenUtxos: wrongNft,
        asset: { type: 'cashtoken', category: CATEGORY, nft: { capability: 'none', commitment: 'abcd' } },
        toTokenAddress: ADDRS.mainnetToken,
        changeTokenAddress: ADDRS.mainnetToken,
        changeAddress: ADDRS.mainnet,
      }),
    /does not match/,
  );
});
