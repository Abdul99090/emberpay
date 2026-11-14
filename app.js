/**
 * EmberPay demo app — wires the UI to the shared src/ logic.
 * Everything runs client-side; invoices live entirely inside their links.
 */
import {
  bchToSatoshis,
  createInvoice,
  invoiceToLink,
  payloadToInvoice,
  satoshisToBch,
} from './src/invoice.js';
import { parseInvoiceText } from './src/nlp.js';
import { buildPaymentUri } from './src/payuri.js';

const $ = (id) => document.getElementById(id);
const state = { project: null };

async function loadProjectAddresses() {
  try {
    const res = await fetch('./project-addresses.json');
    state.project = await res.json();
  } catch {
    state.project = null;
  }
  const tokenAddr = state.project?.mainnetToken ?? 'unavailable';
  $('banner-token-address').textContent = tokenAddr;
  if (state.project?.mainnet && !$('f-to').value) {
    $('f-to').value = state.project.mainnet;
  }
}

function drawQr(canvas, text) {
  if (window.QRCode) {
    window.QRCode.toCanvas(canvas, text, { width: canvas.width, margin: 1 }, (err) => {
      if (err) canvas.replaceWith(document.createTextNode(text));
    });
  }
}

/* ── Create flow ─────────────────────────────────────────────── */
function onParse() {
  const parsed = parseInvoiceText($('nl-input').value);
  if (parsed.to) $('f-to').value = parsed.to;
  if (parsed.amountSats) $('f-amount').value = satoshisToBch(BigInt(parsed.amountSats));
  if (parsed.label) $('f-label').value = parsed.label;
  if (parsed.memo) $('f-memo').value = parsed.memo;
  $('create-error').textContent = parsed.missing.length
    ? `Assistant could not find: ${parsed.missing.join(', ')} — the defaults below still work.`
    : '';
}

function onCreate() {
  $('create-error').textContent = '';
  try {
    const invoice = createInvoice({
      to: $('f-to').value.trim(),
      amountSats: bchToSatoshis($('f-amount').value.trim() || '0'),
      label: $('f-label').value.trim(),
      memo: $('f-memo').value.trim(),
    });
    const link = invoiceToLink(invoice, location.origin + location.pathname);
    $('r-link').value = link;
    const uri = buildPaymentUri({
      address: invoice.to,
      amountSats: BigInt(invoice.amountSats),
      label: 'EmberPay',
      message: invoice.label || 'Payment',
    });
    drawQr($('r-qr'), uri);
    $('create-result').classList.remove('hidden');
  } catch (err) {
    $('create-error').textContent = err.message;
  }
}

/* ── Pay flow ────────────────────────────────────────────────── */
function showPayView(invoice) {
  $('view-create').classList.add('hidden');
  $('view-pay').classList.remove('hidden');
  $('p-amount').textContent = `${satoshisToBch(BigInt(invoice.amountSats))} BCH`;
  $('p-label').textContent = invoice.label || 'Payment request';
  $('p-to').textContent = invoice.to;
  $('p-memo').textContent = invoice.memo ? `“${invoice.memo}”` : '';
  const uri = buildPaymentUri({
    address: invoice.to,
    amountSats: BigInt(invoice.amountSats),
    label: 'EmberPay',
    message: invoice.label || 'Payment',
  });
  drawQr($('p-qr'), uri);
  $('p-open').href = uri;
}

function route() {
  const match = /#\/pay\/([A-Za-z0-9_-]+)/.exec(location.hash);
  if (match) {
    try {
      showPayView(payloadToInvoice(match[1]));
      return;
    } catch {
      // fall through to the create view with a clean hash
    }
  }
  $('view-pay').classList.add('hidden');
  $('view-create').classList.remove('hidden');
}

/* ── Wallet connect (progressive enhancement) ────────────────── */
async function onConnect() {
  const status = $('wallet-status');
  status.textContent = 'Starting WizardConnect…';
  try {
    const { connectWizard } = await import('./wallet-connect.js');
    await connectWizard({
      onPairingUri: (uri) => {
        $('wizard-pair').classList.remove('hidden');
        $('wizard-uri').textContent = uri;
        drawQr($('wizard-qr'), uri);
      },
      onConnected: (address) => {
        status.textContent = `Connected wallet: ${address}`;
        $('wizard-pair').classList.add('hidden');
      },
      onStatus: (msg) => {
        status.textContent = msg;
      },
    });
  } catch (err) {
    status.textContent =
      'WizardConnect unavailable here — QR / deep-link payment still works below.';
  }
}

/* ── Wire up ─────────────────────────────────────────────────── */
$('btn-parse').addEventListener('click', onParse);
$('btn-create').addEventListener('click', onCreate);
$('btn-copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('r-link').value);
  $('btn-copy').textContent = 'Copied ✓';
  setTimeout(() => ($('btn-copy').textContent = 'Copy'), 1500);
});
$('btn-new').addEventListener('click', () => {
  location.hash = '';
  route();
});
$('btn-connect').addEventListener('click', onConnect);
window.addEventListener('hashchange', route);

loadProjectAddresses().then(route);
