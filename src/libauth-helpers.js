/**
 * Small typed wrappers around Libauth primitives used by tx.js,
 * kept in one place so the rest of the codebase stays declarative.
 */
import {
  binToHex,
  encodeTransaction as libauthEncodeTransaction,
  hexToBin,
} from '@bitauth/libauth';

/**
 * Build the standard P2PKH locking bytecode for a 20-byte hash160 payload:
 * OP_DUP OP_HASH160 <push payload> OP_EQUALVERIFY OP_CHECKSIG
 * @param {Uint8Array} payload 20 bytes
 * @returns {Uint8Array}
 */
export function lockingBytecodeP2pkh(payload) {
  if (payload.length !== 20) throw new Error('P2PKH payload must be 20 bytes');
  const out = new Uint8Array(25);
  out[0] = 0x76; // OP_DUP
  out[1] = 0xa9; // OP_HASH160
  out[2] = 0x14; // push 20 bytes
  out.set(payload, 3);
  out[23] = 0x88; // OP_EQUALVERIFY
  out[24] = 0xac; // OP_CHECKSIG
  return out;
}

/**
 * Convert a display-order txid hex string into the outpoint hash bytes
 * Libauth expects (byte-reversed, as serialized on the wire).
 * @param {string} txid 64 hex chars
 * @returns {Uint8Array}
 */
export function outpointHashFromTxid(txid) {
  const bin = hexToBin(txid);
  if (typeof bin === 'string' || bin.length !== 32) {
    throw new Error(`invalid txid: ${txid}`);
  }
  return new Uint8Array([...bin].reverse());
}

/**
 * Serialize a Libauth Transaction to hex.
 * @param {object} transaction
 * @returns {string} hex
 */
export function encodeTransaction(transaction) {
  const result = libauthEncodeTransaction(transaction);
  if (typeof result === 'string') {
    throw new Error(`transaction encoding failed: ${result}`);
  }
  return binToHex(result);
}
