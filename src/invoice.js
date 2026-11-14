/**
 * EmberPay invoice model.
 *
 * An invoice is a self-describing payment request: recipient CashAddress,
 * amount (in satoshis, integer — never floats), a human label, an optional
 * memo, and the network it belongs to. Invoices serialize into a compact
 * base64url payload so a whole payment request fits inside one shareable
 * link:  https://<host>/#/pay/<payload>
 *
 * All money math is done on integer satoshis / decimal strings so values
 * never drift through binary floating point.
 */

export const SATOSHIS_PER_BCH = 100_000_000n;

/**
 * Convert a decimal BCH string (e.g. "0.01", "1.5") to integer satoshis.
 * @param {string} bch decimal string, up to 8 decimal places
 * @returns {bigint} satoshis
 */
export function bchToSatoshis(bch) {
  if (typeof bch !== 'string') throw new TypeError('amount must be a string');
  const match = /^(\d+)(?:\.(\d{1,8}))?$/.exec(bch.trim());
  if (!match) throw new Error(`invalid BCH amount: ${JSON.stringify(bch)}`);
  const whole = BigInt(match[1]);
  const frac = BigInt((match[2] ?? '').padEnd(8, '0'));
  return whole * SATOSHIS_PER_BCH + frac;
}

/**
 * Convert integer satoshis to a plain decimal BCH string (no exponent,
 * trailing zeros trimmed, but always at least "0").
 * @param {bigint|number} sats
 * @returns {string}
 */
export function satoshisToBch(sats) {
  const value = BigInt(sats);
  const whole = value / SATOSHIS_PER_BCH;
  const frac = value % SATOSHIS_PER_BCH;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(8, '0').replace(/0+$/, '');
  return `${whole.toString()}.${fracStr}`;
}

/**
 * Normalise/validate the asset an invoice is denominated in.
 * BCH is the default. A CashToken asset makes EmberPay's link carry the
 * full token terms (category + amount, or one specific NFT) — the payer's
 * wallet then settles in that token, with a small BCH "carrier" amount
 * riding on the token output (CashTokens live inside BCH outputs).
 */
function normaliseAsset(asset, amountSats) {
  if (asset === undefined || asset === null || asset.type === 'bch') {
    return { asset: { type: 'bch' }, amountSats };
  }
  if (asset.type !== 'cashtoken') {
    throw new Error(`unknown asset type: ${asset.type}`);
  }
  const category = String(asset.category ?? '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(category)) {
    throw new Error('CashToken asset requires a 32-byte category id (64 hex chars)');
  }
  const out = { type: 'cashtoken', category };
  if (asset.nft) {
    const capability = asset.nft.capability ?? 'none';
    if (!['none', 'mutable', 'minting'].includes(capability)) {
      throw new Error(`unknown NFT capability: ${capability}`);
    }
    out.nft = {
      capability,
      commitment: String(asset.nft.commitment ?? '').toLowerCase(),
    };
    if (out.nft.commitment && !/^([0-9a-f]{2})+$/.test(out.nft.commitment)) {
      throw new Error('NFT commitment must be hex');
    }
  } else {
    const amount = BigInt(asset.amount ?? '0');
    if (amount <= 0n) throw new Error('token amount must be greater than zero');
    out.amount = amount.toString();
  }
  if (asset.symbol) out.symbol = String(asset.symbol).slice(0, 12);
  // Token outputs need a BCH carrier; default to 1000 sats when unspecified.
  return { asset: out, amountSats: amountSats ?? 1000n };
}

let counter = 0;

/**
 * Create an invoice object.
 * @param {object} fields
 * @param {string} fields.to CashAddress of the recipient (bitcoincash: or bchtest:)
 * @param {bigint|number} [fields.amountSats] BCH amount in satoshis (> 0);
 *   for CashToken invoices this is the BCH carrier on the token output
 *   (defaults to 1000)
 * @param {object} [fields.asset] {type:'bch'} (default) or
 *   {type:'cashtoken', category, amount} / {type:'cashtoken', category, nft}
 * @param {string} [fields.label] short human label, e.g. "Logo design"
 * @param {string} [fields.memo] optional longer note
 * @param {'mainnet'|'chipnet'} [fields.network]
 * @param {string} [fields.id] invoice id (auto-generated when omitted)
 * @param {number} [fields.createdAt] unix seconds (defaults to now)
 */
export function createInvoice(fields) {
  const {
    to,
    label = '',
    memo = '',
    network = 'mainnet',
    id,
    createdAt,
  } = fields ?? {};
  if (typeof to !== 'string' || to.length === 0) {
    throw new Error('invoice requires a recipient address ("to")');
  }
  const { asset, amountSats } = normaliseAsset(fields?.asset, fields?.amountSats);
  const sats = BigInt(amountSats);
  if (sats <= 0n) throw new Error('invoice amount must be greater than zero');
  if (network !== 'mainnet' && network !== 'chipnet') {
    throw new Error(`unknown network: ${network}`);
  }
  counter += 1;
  return {
    v: 1,
    id: id ?? `inv-${Date.now().toString(36)}-${counter}`,
    to,
    amountSats: sats.toString(),
    asset,
    label: String(label).slice(0, 80),
    memo: String(memo).slice(0, 280),
    network,
    createdAt: createdAt ?? Math.floor(Date.now() / 1000),
  };
}

/** Encode bytes as base64url (works identically in Node and browsers). */
function bytesToBase64Url(bytes) {
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** Decode a base64url string back to bytes. */
function base64UrlToBytes(text) {
  const b64 = text.replaceAll('-', '+').replaceAll('_', '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Encode an invoice as a base64url payload safe for a URL fragment. */
export function invoiceToPayload(invoice) {
  const json = JSON.stringify(invoice);
  return bytesToBase64Url(new TextEncoder().encode(json));
}

/** Decode a payload produced by invoiceToPayload back into an invoice. */
export function payloadToInvoice(payload) {
  if (typeof payload !== 'string' || payload.length === 0) {
    throw new Error('empty invoice payload');
  }
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
  } catch {
    throw new Error('invoice payload is not valid base64url JSON');
  }
  if (parsed.v !== 1 || typeof parsed.to !== 'string' || typeof parsed.amountSats !== 'string') {
    throw new Error('invoice payload has an unexpected shape');
  }
  // Re-run through createInvoice for validation/normalisation.
  return createInvoice({
    to: parsed.to,
    amountSats: BigInt(parsed.amountSats),
    asset: parsed.asset ?? { type: 'bch' },
    label: parsed.label ?? '',
    memo: parsed.memo ?? '',
    network: parsed.network ?? 'mainnet',
    id: parsed.id,
    createdAt: parsed.createdAt,
  });
}

/** Build the full shareable payment link for an invoice. */
export function invoiceToLink(invoice, baseUrl) {
  const base = baseUrl.replace(/\/$/, '');
  return `${base}/#/pay/${invoiceToPayload(invoice)}`;
}
