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
