/**
 * BIP21-style payment URIs for Bitcoin Cash ("bitcoincash:" / "bchtest:").
 *
 * A BIP21 URI is the lingua franca of BCH payments: every major wallet
 * (Paytaca, Selene, Electron Cash, …) can scan one as a QR code or open
 * one as a deep link and pre-fill a real mainnet send. EmberPay renders
 * one for every invoice as the universal pay path, next to WizardConnect.
 */
import { satoshisToBch } from './invoice.js';

/**
 * Build a payment URI.
 * @param {object} fields
 * @param {string} fields.address full CashAddress (with prefix)
 * @param {bigint|number} [fields.amountSats]
 * @param {string} [fields.label] label for the recipient (BIP21 "label")
 * @param {string} [fields.message] message shown to the payer (BIP21 "message")
 * @returns {string} e.g. bitcoincash:q...?amount=0.01&label=EmberPay
 */
export function buildPaymentUri({ address, amountSats, label, message }) {
  if (typeof address !== 'string' || !address.includes(':')) {
    throw new Error('address must be a full CashAddress including its prefix');
  }
  const params = new URLSearchParams();
  if (amountSats !== undefined && amountSats !== null) {
    params.set('amount', satoshisToBch(amountSats));
  }
  if (label) params.set('label', label);
  if (message) params.set('message', message);
  const query = params.toString();
  return query ? `${address}?${query}` : address;
}

/**
 * Parse a payment URI back into its fields.
 * @param {string} uri
 * @returns {{address: string, amountBch?: string, label?: string, message?: string}}
 */
export function parsePaymentUri(uri) {
  if (typeof uri !== 'string') throw new TypeError('uri must be a string');
  const qIndex = uri.indexOf('?');
  const address = qIndex === -1 ? uri : uri.slice(0, qIndex);
  if (!/^(bitcoincash|bchtest):[a-z0-9]+$/i.test(address)) {
    throw new Error(`not a BCH payment URI: ${JSON.stringify(uri)}`);
  }
  const out = { address };
  if (qIndex !== -1) {
    const params = new URLSearchParams(uri.slice(qIndex + 1));
    if (params.has('amount')) out.amountBch = params.get('amount');
    if (params.has('label')) out.label = params.get('label');
    if (params.has('message')) out.message = params.get('message');
  }
  return out;
}
