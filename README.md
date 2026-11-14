# 🔥 EmberPay

**One sentence in. One payment link out.**

EmberPay turns a plain sentence — *"Charge 0.01 BCH for the logo design"* — into a
shareable Bitcoin Cash payment link. The recipient needs no account, no server and
no database: the invoice lives entirely inside the link itself. The payer opens it,
scans a QR (or connects with WizardConnect), confirms in their own wallet, and a
real BCH mainnet transaction settles in seconds for ~1 sat/byte in fees.

Built for **[BCH BLAZE 2026](https://dorahacks.io/hackathon/bchblaze2026)** — Mainnet Track.

🌐 **Live demo:** https://abdul99090.github.io/emberpay/
💚 **Community-Choice votes / donations (CashTokens, incl. EMBER2026):**
`bitcoincash:zqcz8jfpdssmzhxs7h2ddkfhllkfldy3vvzq8mlwt5`

---

## The problem

Getting paid in crypto is still awkward. A freelancer, a market seller, or a
charity has to paste a raw address, separately tell the payer how much to send,
hope they type both correctly, and then reconcile "which payment was for what?"
by hand. Payment-request standards exist (BIP21), but almost nobody can produce
one without a wallet manual in hand — so in practice people screenshot addresses
and amounts in chat apps, with the errors and fraud risk that implies.

## The solution

EmberPay makes a payment request as easy to create and share as a text message:

1. **Describe** — type one sentence. EmberPay's invoice assistant extracts the
   amount (BCH or satoshis), the label and an optional note. The parser is
   deterministic and runs 100% locally — in the browser, in tests, offline.
2. **Share** — the invoice is encoded into a single link
   (`…/#/pay/<payload>`). No backend stores anything; the link *is* the invoice.
3. **Get paid** — the link renders a payment card with a BIP21 QR that every
   major BCH wallet (Paytaca, Selene, Electron Cash, …) scans and pre-fills,
   plus a WizardConnect flow for connected wallets. Payment is a genuine
   mainnet transaction, signed by the payer's own wallet. EmberPay is fully
   non-custodial: it never sees a private key.

## Why Bitcoin Cash

- **Fees:** a payment costs ~226 sats (≈ a fraction of a cent) at 1 sat/byte —
  micropayments and tips are actually viable.
- **Speed:** 0-conf usability for small amounts; confirmations in minutes.
- **CashTokens:** the same address family carries tokens — EmberPay's project
  address accepts EMBER2026 votes for Community Choice out of the box.

## Features

- 🗣 **Natural-language invoice assistant** (`src/nlp.js`) — amount, recipient,
  label and memo extracted from one sentence, with explicit "missing field"
  reporting so the UI can guide the user.
- 🔗 **Self-contained payment links** (`src/invoice.js`) — invoices serialize to
  base64url payloads; integer-satoshi money math (BigInt) end-to-end, no floats.
- 📷 **Universal BIP21 QR + deep link** (`src/payuri.js`) — works with every
  BCH wallet today, no integration required on the payer side.
- 🔌 **WizardConnect integration** (`wallet-connect.js`) — pairing via the
  official `@wizardconnect/dapp` / `@wizardconnect/core` packages, HD pubkey
  retrieval, and local address derivation with Libauth.
- 🧾 **Transaction preparation** (`src/tx.js`) — largest-first coin selection,
  dust-aware change handling and fee estimation, assembling the unsigned
  transaction a wallet signs via WizardConnect. Pure and unit-tested.
- 🛡 **Libauth throughout** (`src/address.js`) — the reference BCH library
  handles CashAddress encoding/decoding (incl. token-aware addresses).

## Quick start

```bash
# Run the test suite (19 tests, node:test, no network needed)
npm test

# Try the invoice assistant in your terminal
npm run demo -- "Charge 0.01 BCH for the logo design, note: thank you!"

# Serve the web demo locally
npx serve .        # or: python3 -m http.server
# then open http://localhost:3000 (port depends on the server)
```

No build step: the demo is plain ES modules + the shared `src/` logic.

## Project structure

```
index.html          Live demo (GitHub Pages) incl. the BLAZE banner
app.js              Demo UI wiring (create + pay views)
wallet-connect.js   WizardConnect pairing / pubkey / address derivation
style.css           Demo styling
src/
  invoice.js        Invoice model, satoshi math, link payload codec
  nlp.js            Natural-language invoice assistant
  payuri.js         BIP21 payment URI build/parse
  address.js        CashAddress + token-address helpers (Libauth)
  tx.js             Coin selection, fee estimation, unsigned tx assembly
  libauth-helpers.js  P2PKH locking bytecode, tx serialization wrappers
test/               node:test suites for every src module
scripts/
  demo-invoice.js   Terminal demo of the assistant
  generate-wallet.js  Creates the project donation/voting wallet
                      (key written outside the repo, mode 0600)
project-addresses.json  Public project addresses (donations + EMBER2026 votes)
```

## Architecture

```
 sentence ──► nlp.js ──► invoice.js ──► link (#/pay/<payload>)
                                            │
                              ┌─────────────┴─────────────┐
                              ▼                           ▼
                        BIP21 QR / deep link      WizardConnect session
                        (any BCH wallet)          (tx.js unsigned tx →
                                                   wallet signs → mainnet)
```

State: none. There is no server and no database in the payment path — a
deliberate design choice: nothing to hack, nothing to shut down, nothing
between a payer and a payee.

## Roadmap

- In-browser UTXO discovery via a public indexer so the WizardConnect
  sign-and-broadcast path runs end-to-end in the demo (builder + tests already
  in `src/tx.js`).
- CashTokens-denominated invoices (pay a specific token amount, not just BCH).
- Recurring payment links (subscriptions) and multi-recipient split links.
- Optional payment notifications via webhook for merchants.

## Team

Solo build by **bejo** (DoraHacks: `hacker8d060a3`) for BCH BLAZE 2026.
All code in this repository was written during the hackathon submission window.

## License

MIT — see [LICENSE](LICENSE).
