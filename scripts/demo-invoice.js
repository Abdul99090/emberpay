/**
 * Terminal demo of the EmberPay invoice assistant.
 *
 *   node scripts/demo-invoice.js "Charge 0.01 BCH for the logo design"
 *   node scripts/demo-invoice.js            (uses a built-in example)
 *
 * Parses the sentence, builds the invoice, prints the shareable payment
 * link, the BIP21 URI, and an ASCII QR code of the URI.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { createInvoice, invoiceToLink } from '../src/invoice.js';
import { parseInvoiceText } from '../src/nlp.js';
import { buildPaymentUri } from '../src/payuri.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const projectAddresses = JSON.parse(
  readFileSync(join(repoRoot, 'project-addresses.json'), 'utf8'),
);
const projectAddress = projectAddresses.mainnet;

const sentence =
  process.argv.slice(2).join(' ') ||
  `Charge 0.01 BCH to ${projectAddress} for the logo design, note: thank you!`;

console.log(`\n🗣  "${sentence}"\n`);

const parsed = parseInvoiceText(sentence);

// Token sentence? Build a CashToken invoice to the project's token-aware
// address. Without an explicit category in the sentence, use a clearly
// labelled SAMPLE category (sha256 of a fixed string) for the demo.
let invoice;
if (parsed.tokenAmount) {
  const category =
    parsed.tokenCategory ??
    createHash('sha256').update('emberpay-sample-token').digest('hex');
  invoice = createInvoice({
    to: projectAddresses.mainnetToken,
    asset: {
      type: 'cashtoken',
      category,
      amount: parsed.tokenAmount,
      symbol: parsed.tokenSymbol ?? 'TOKEN',
    },
    label: parsed.label || 'Token payment',
    memo: parsed.memo,
  });
  console.log(
    `🪙 CashToken invoice (${parsed.tokenSymbol ?? 'TOKEN'}), category ${category.slice(0, 16)}…` +
      (parsed.tokenCategory ? '' : ' (sample category for demo)'),
  );
} else {
  invoice = createInvoice({
    to: parsed.to ?? projectAddress,
    amountSats: BigInt(parsed.amountSats ?? '1000000'),
    label: parsed.label || 'Payment',
    memo: parsed.memo,
  });
}
const link = invoiceToLink(invoice, 'https://abdul99090.github.io/emberpay');
const uri = buildPaymentUri({
  address: invoice.to,
  amountSats: BigInt(invoice.amountSats),
  label: 'EmberPay',
  message: invoice.label,
});

console.log('📄 Invoice:', JSON.stringify(invoice, null, 2));
console.log(`\n🔗 Payment link: ${link}`);
console.log(`\n💸 BIP21 URI: ${uri}`);
console.log('\n📷 QR (scan with Paytaca / Selene / any BCH wallet):');
console.log(await QRCode.toString(uri, { type: 'terminal', small: true }));
