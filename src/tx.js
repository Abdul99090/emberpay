/**
 * Transaction preparation for the WizardConnect send flow.
 *
 * EmberPay is non-custodial: it never holds a payer's keys. To ask a
 * wallet to pay an invoice, the dapp assembles the unsigned transaction
 * (inputs = the wallet's UTXOs, outputs = invoice amount to the recipient
 * + change back to the wallet), estimates the fee, and hands it to
 * WizardConnect's signTransaction, which prompts the wallet to sign and
 * broadcast a real BCH mainnet transaction.
 *
 * This module is the pure, testable half of that flow: coin selection,
 * fee estimation and unsigned-transaction assembly (Libauth encoding).
 */
import {
  encodeTransaction,
  lockingBytecodeP2pkh,
  outpointHashFromTxid,
} from './libauth-helpers.js';
import { hexToBin } from '@bitauth/libauth';
import { validateAddress } from './address.js';

export const DUST_LIMIT_SATS = 546n;
const TX_OVERHEAD_BYTES = 10;
const P2PKH_INPUT_BYTES = 148;
const P2PKH_OUTPUT_BYTES = 34;

/**
 * Estimate the network fee for a P2PKH transaction at 1 sat/byte
 * (BCH's standard relay fee — one of the reasons BCH payments are cheap).
 * @param {number} numInputs
 * @param {number} numOutputs
 * @param {number} [feePerByte]
 * @returns {bigint} fee in satoshis
 */
export function estimateFeeSats(numInputs, numOutputs, feePerByte = 1) {
  const bytes =
    TX_OVERHEAD_BYTES +
    numInputs * P2PKH_INPUT_BYTES +
    numOutputs * P2PKH_OUTPUT_BYTES;
  return BigInt(Math.ceil(bytes * feePerByte));
}

/**
 * Greedy largest-first coin selection.
 * @param {Array<{txid: string, vout: number, sats: string, lockingBytecodeHex?: string}>} utxos
 * @param {bigint} targetSats amount that outputs + fee must cover
 * @returns {{selected: Array, totalIn: bigint, fee: bigint, change: bigint}}
 */
export function selectCoins(utxos, targetSats) {
  const sorted = [...utxos].sort((a, b) => (BigInt(b.sats) > BigInt(a.sats) ? 1 : -1));
  const selected = [];
  let totalIn = 0n;
  for (const utxo of sorted) {
    selected.push(utxo);
    totalIn += BigInt(utxo.sats);
    // Assume a change output exists while selecting; corrected below.
    const fee = estimateFeeSats(selected.length, 2);
    if (totalIn >= targetSats + fee) {
      const change = totalIn - targetSats - fee;
      if (change >= DUST_LIMIT_SATS) {
        return { selected, totalIn, fee, change };
      }
      // Change would be dust: fold it into the fee, single output.
      const feeNoChange = estimateFeeSats(selected.length, 1);
      if (totalIn >= targetSats + feeNoChange) {
        return { selected, totalIn, fee: totalIn - targetSats, change: 0n };
      }
    }
  }
  throw new Error(
    `insufficient funds: have ${totalIn} sats, need ${targetSats} + fee`,
  );
}

/**
 * Assemble an unsigned payment transaction (Libauth Transaction object
 * plus its serialized hex). Unlocking bytecodes are left empty — the
 * wallet fills them when it signs via WizardConnect.
 *
 * @param {object} fields
 * @param {Array} fields.utxos candidate UTXOs owned by the payer
 * @param {string} fields.toAddress recipient CashAddress
 * @param {bigint} fields.amountSats invoice amount
 * @param {string} fields.changeAddress payer CashAddress for change
 * @returns {{transaction: object, hex: string, fee: bigint, change: bigint, selected: Array}}
 */
export function buildUnsignedPayment({ utxos, toAddress, amountSats, changeAddress }) {
  const amount = BigInt(amountSats);
  const { selected, fee, change } = selectCoins(utxos, amount);

  const recipientPayload = validateAddress(toAddress).payload;
  const outputs = [
    {
      lockingBytecode: lockingBytecodeP2pkh(recipientPayload),
      valueSatoshis: amount,
    },
  ];
  if (change > 0n) {
    const changePayload = validateAddress(changeAddress).payload;
    outputs.push({
      lockingBytecode: lockingBytecodeP2pkh(changePayload),
      valueSatoshis: change,
    });
  }

  const transaction = {
    version: 2,
    inputs: selected.map((utxo) => ({
      outpointTransactionHash: outpointHashFromTxid(utxo.txid),
      outpointIndex: utxo.vout,
      sequenceNumber: 0xfffffffe,
      unlockingBytecode: new Uint8Array(),
    })),
    outputs,
    locktime: 0,
  };
  return { transaction, hex: encodeTransaction(transaction), fee, change, selected };
}

/* ── CashTokens ──────────────────────────────────────────────── */

/** Extra serialized size of a fungible-token output vs a plain output. */
const TOKEN_OUTPUT_SURCHARGE_BYTES = 40;

/**
 * Assemble an unsigned CashToken payment transaction — the settlement
 * engine behind token-denominated EmberPay invoices.
 *
 * CashTokens live inside BCH outputs, so a token payment spends:
 *   - token UTXOs of the invoice's category (fungible amount, or the one
 *     NFT being transferred), whose BCH value rides along, plus
 *   - plain BCH "funding" UTXOs to top up the carrier amounts and the fee,
 * and produces:
 *   1. the recipient token output (token-aware address, carrier sats),
 *   2. a token change output back to the payer (when tokens remain),
 *   3. a BCH change output (when the remainder clears the dust limit).
 * Token conservation is enforced exactly: inputs of the category must
 * cover the payment, and the remainder returns as token change — the
 * builder refuses to silently burn tokens.
 *
 * @param {object} fields
 * @param {Array} fields.tokenUtxos UTXOs carrying {token:{category, amount?, nft?}}
 * @param {Array} [fields.fundingUtxos] plain BCH UTXOs for carrier + fee
 * @param {object} fields.asset invoice asset ({type:'cashtoken', ...})
 * @param {string} fields.toTokenAddress recipient token-aware CashAddress
 * @param {string} fields.changeTokenAddress payer token-aware address
 * @param {string} fields.changeAddress payer plain CashAddress
 * @param {bigint|number} [fields.carrierSats] BCH riding each token output
 * @returns {{transaction: object, hex: string, fee: bigint,
 *   tokenChange: bigint, change: bigint}}
 */
export function buildUnsignedTokenPayment({
  tokenUtxos,
  fundingUtxos = [],
  asset,
  toTokenAddress,
  changeTokenAddress,
  changeAddress,
  carrierSats = 1000n,
}) {
  if (!asset || asset.type !== 'cashtoken') {
    throw new Error('token payment requires a cashtoken asset');
  }
  const category = asset.category.toLowerCase();
  const categoryBin = hexToBin(category);
  const carrier = BigInt(carrierSats);

  // Select token inputs of the right category until the payment is covered.
  const selectedToken = [];
  let tokenIn = 0n;
  let nftIn = null;
  for (const utxo of tokenUtxos) {
    if (utxo.token?.category?.toLowerCase() !== category) continue;
    selectedToken.push(utxo);
    if (asset.nft) {
      if (utxo.token.nft) { nftIn = utxo.token.nft; break; }
    } else {
      tokenIn += BigInt(utxo.token.amount ?? '0');
      if (tokenIn >= BigInt(asset.amount)) break;
    }
  }
  if (asset.nft) {
    if (!nftIn) throw new Error('no UTXO carries the requested NFT');
    if (
      nftIn.capability !== asset.nft.capability ||
      (nftIn.commitment ?? '').toLowerCase() !== (asset.nft.commitment ?? '')
    ) {
      throw new Error('NFT in wallet does not match the invoice NFT');
    }
  } else if (tokenIn < BigInt(asset.amount)) {
    throw new Error(
      `insufficient tokens: have ${tokenIn}, need ${asset.amount} of category ${category.slice(0, 12)}...`,
    );
  }
  const tokenChange = asset.nft ? 0n : tokenIn - BigInt(asset.amount);

  // Outputs (fee is estimated from the final shape, then settled below).
  const outputs = [
    {
      lockingBytecode: lockingBytecodeP2pkh(validateAddress(toTokenAddress).payload),
      valueSatoshis: carrier,
      token: asset.nft
        ? {
            category: categoryBin,
            amount: 0n,
            nft: {
              capability: asset.nft.capability,
              commitment: hexToBin(asset.nft.commitment ?? ''),
            },
          }
        : { category: categoryBin, amount: BigInt(asset.amount) },
    },
  ];
  if (tokenChange > 0n) {
    outputs.push({
      lockingBytecode: lockingBytecodeP2pkh(validateAddress(changeTokenAddress).payload),
      valueSatoshis: carrier,
      token: { category: categoryBin, amount: tokenChange },
    });
  }

  // BCH accounting: token UTXOs contribute their carrier value too.
  let bchIn = selectedToken.reduce((sum, u) => sum + BigInt(u.sats), 0n);
  const bchCommitted = carrier * BigInt(outputs.length);
  const selectedFunding = [];
  const numInputs = () => selectedToken.length + selectedFunding.length;
  const feeFor = (withChangeOutput) =>
    estimateFeeSats(numInputs(), outputs.length + (withChangeOutput ? 1 : 0)) +
    BigInt(outputs.length * TOKEN_OUTPUT_SURCHARGE_BYTES);

  let fee = feeFor(true);
  const sortedFunding = [...fundingUtxos].sort((a, b) =>
    BigInt(b.sats) > BigInt(a.sats) ? 1 : -1,
  );
  for (const utxo of sortedFunding) {
    if (bchIn >= bchCommitted + fee) break;
    selectedFunding.push(utxo);
    bchIn += BigInt(utxo.sats);
    fee = feeFor(true);
  }
  let change = bchIn - bchCommitted - fee;
  if (change < DUST_LIMIT_SATS) {
    fee = feeFor(false);
    if (bchIn < bchCommitted + fee) {
      throw new Error(
        `insufficient BCH for carrier + fee: have ${bchIn}, need ${bchCommitted + fee}`,
      );
    }
    change = 0n;
    fee = bchIn - bchCommitted;
  } else {
    outputs.push({
      lockingBytecode: lockingBytecodeP2pkh(validateAddress(changeAddress).payload),
      valueSatoshis: change,
    });
  }

  const allInputs = [...selectedToken, ...selectedFunding];
  const transaction = {
    version: 2,
    inputs: allInputs.map((utxo) => ({
      outpointTransactionHash: outpointHashFromTxid(utxo.txid),
      outpointIndex: utxo.vout,
      sequenceNumber: 0xfffffffe,
      unlockingBytecode: new Uint8Array(),
    })),
    outputs,
    locktime: 0,
  };
  return {
    transaction,
    hex: encodeTransaction(transaction),
    fee,
    tokenChange,
    change,
  };
}
