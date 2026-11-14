/**
 * CashAddress helpers built on Libauth (the reference BCH library).
 *
 * EmberPay needs three address flavours of the same key:
 *  - a plain P2PKH CashAddress (receive BCH, used in payment links/QRs)
 *  - a token-aware P2PKH address (receive CashTokens — the project's
 *    EMBER2026 Community-Choice voting address lives here)
 *  - a chipnet (testnet) address for safe demos
 */
import {
  decodeCashAddress,
  encodeCashAddress,
  hash160,
  secp256k1,
} from '@bitauth/libauth';

export const NETWORKS = {
  mainnet: { prefix: 'bitcoincash' },
  chipnet: { prefix: 'bchtest' },
};

/**
 * Derive the public key + payment code (hash160) for a private key.
 * @param {Uint8Array} privateKey 32 bytes
 * @returns {{publicKey: Uint8Array, payload: Uint8Array}}
 */
export function derivePayload(privateKey) {
  const publicKey = secp256k1.derivePublicKeyCompressed(privateKey);
  if (typeof publicKey === 'string') {
    throw new Error(`invalid private key: ${publicKey}`);
  }
  return { publicKey, payload: hash160(publicKey) };
}

/**
 * Encode a hash160 payload as a CashAddress.
 * @param {Uint8Array} payload 20-byte hash160 of the compressed public key
 * @param {'mainnet'|'chipnet'} network
 * @param {boolean} [withTokens] token-aware (CashTokens) address when true
 */
export function encodeAddress(payload, network = 'mainnet', withTokens = false) {
  const { prefix } = NETWORKS[network] ?? {};
  if (!prefix) throw new Error(`unknown network: ${network}`);
  const result = encodeCashAddress({
    prefix,
    type: withTokens ? 'p2pkhWithTokens' : 'p2pkh',
    payload,
  });
  // Libauth v3 returns { address } on success, { error } on failure.
  if (typeof result !== 'object' || typeof result.address !== 'string') {
    throw new Error(`address encoding failed: ${JSON.stringify(result)}`);
  }
  return result.address;
}

/**
 * All addresses EmberPay shows for one private key.
 * @param {Uint8Array} privateKey 32 bytes
 */
export function addressesFromPrivateKey(privateKey) {
  const { payload } = derivePayload(privateKey);
  return {
    mainnet: encodeAddress(payload, 'mainnet', false),
    mainnetToken: encodeAddress(payload, 'mainnet', true),
    chipnet: encodeAddress(payload, 'chipnet', false),
    chipnetToken: encodeAddress(payload, 'chipnet', true),
  };
}

/**
 * Validate a CashAddress string (checksum + shape), returning its parts.
 * @param {string} address
 * @returns {{prefix: string, type: string, payload: Uint8Array}}
 */
export function validateAddress(address) {
  const decoded = decodeCashAddress(address);
  // Libauth v3 returns the decoded parts, or { error } on failure.
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    'error' in decoded ||
    !(decoded.payload instanceof Uint8Array)
  ) {
    throw new Error(`invalid CashAddress: ${JSON.stringify(decoded)}`);
  }
  return decoded;
}

/** True when the string is a well-formed CashAddress on either network. */
export function isValidAddress(address) {
  try {
    validateAddress(address);
    return true;
  } catch {
    return false;
  }
}
