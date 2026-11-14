/**
 * EmberPay's invoice assistant: turn one plain sentence into invoice fields.
 *
 *   "Charge 0.01 BCH to bitcoincash:q... for the logo design"
 *   "Invoice 25000 sats for monthly hosting"
 *   "Ask 1.5 BCH for consulting, note: due Friday"
 *
 * The parser is deliberately deterministic (regex + rules, no network call):
 * it runs identically in the browser, in tests, and offline. It extracts an
 * amount (BCH decimal or satoshis), a recipient CashAddress when present,
 * a label (text after "for") and a memo (text after "note:" / "memo:").
 * Anything it cannot find is reported in `missing` so the UI can ask.
 */
import { bchToSatoshis } from './invoice.js';

const ADDRESS_RE = /\b(bitcoincash|bchtest):[a-z0-9]{42,}\b/i;
const BCH_AMOUNT_RE = /(\d+(?:\.\d{1,8})?)\s*(?:bch|bitcoin\s*cash)\b/i;
const SATS_AMOUNT_RE = /(\d{1,12})\s*(?:sats?|satoshis?)\b/i;

/**
 * Parse a natural-language invoice request.
 * @param {string} text
 * @returns {{
 *   amountSats: string|null, to: string|null, label: string,
 *   memo: string, missing: string[],
 *   tokenAmount: string|null, tokenSymbol: string|null, tokenCategory: string|null
 * }}
 */
export function parseInvoiceText(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return {
      amountSats: null, to: null, label: '', memo: '',
      missing: ['amount', 'recipient'],
      tokenAmount: null, tokenSymbol: null, tokenCategory: null,
    };
  }
  const missing = [];

  // CashToken phrasing: "100 EMBER tokens", optionally with a category id.
  let tokenAmount = null;
  let tokenSymbol = null;
  let tokenCategory = null;
  const tokenMatch = /(\d{1,18})\s+([A-Za-z][A-Za-z0-9]{1,11})\s+tokens?\b/i.exec(text);
  if (tokenMatch) {
    tokenAmount = BigInt(tokenMatch[1]).toString();
    tokenSymbol = tokenMatch[2].toUpperCase();
  }
  const categoryMatch = /\b([0-9a-f]{64})\b/i.exec(text);
  if (categoryMatch) tokenCategory = categoryMatch[1].toLowerCase();

  // Recipient
  const addrMatch = ADDRESS_RE.exec(text);
  const to = addrMatch ? addrMatch[0] : null;
  if (!to) missing.push('recipient');

  // Amount — prefer an explicit "N BCH", fall back to "N sats".
  let amountSats = null;
  const bchMatch = BCH_AMOUNT_RE.exec(text);
  const satsMatch = SATS_AMOUNT_RE.exec(text);
  if (bchMatch) {
    amountSats = bchToSatoshis(bchMatch[1]).toString();
  } else if (satsMatch) {
    amountSats = BigInt(satsMatch[1]).toString();
  }
  if (amountSats === null && tokenAmount === null) missing.push('amount');

  // Memo — "note: ..." or "memo: ..." to end of string.
  let memo = '';
  const memoMatch = /(?:note|memo)\s*:\s*(.+)$/i.exec(text);
  if (memoMatch) memo = memoMatch[1].trim().replace(/[.\s]+$/, '');

  // Label — text after the last standalone "for", with the memo stripped out.
  let label = '';
  const forMatch = /\bfor\b\s+(.+)$/i.exec(text);
  if (forMatch) {
    label = forMatch[1];
    if (memoMatch) label = label.replace(/(?:note|memo)\s*:\s*.+$/i, '').trim();
    if (addrMatch) label = label.replace(ADDRESS_RE, '').trim();
    label = label.replace(/,?\s*category\s+[0-9a-f]{64}\b/i, '').replace(/\b[0-9a-f]{64}\b/i, '').trim();
    label = label.replace(/\s+/g, ' ').replace(/[.,\s]+$/, '').trim();
    // Capitalise first letter for display.
    if (label) label = label[0].toUpperCase() + label.slice(1);
  }

  return { amountSats, to, label, memo, missing, tokenAmount, tokenSymbol, tokenCategory };
}
