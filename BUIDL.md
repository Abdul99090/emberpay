# DoraHacks BUIDL — submission draft (BCH BLAZE 2026)

> Copy these fields into the DoraHacks "Submit BUIDL" form for
> https://dorahacks.io/hackathon/bchblaze2026 — do not submit until every
> item in [SUBMISSION-CHECKLIST.md](SUBMISSION-CHECKLIST.md) is ticked.

## Project name
EmberPay

## Tagline
One sentence in. One payment link out. Non-custodial Bitcoin Cash payment
requests anyone can create and anyone can pay.

## Track
Mainnet Track (also eligible for Community Choice via the EMBER2026
CashTokens address listed in the demo banner)

## Vision / description (long)
Getting paid in crypto is still awkward: a raw address in one message, the
amount in another, and no shared record of what the payment was for.
EmberPay removes all of that. Type one sentence — "Charge 0.01 BCH for the
logo design" — and EmberPay's invoice assistant extracts the amount, label
and note, then encodes the whole invoice into a single shareable link. No
server, no account, no database: the link *is* the invoice.

CashTokens are the engine, not a bolt-on: the same invoice format is
denominated in BCH or in ANY CashToken — fungible amounts, or one specific
NFT. The link carries the full token terms (category, amount / NFT
commitment), payments land on token-aware addresses, and EmberPay's
transaction builder assembles the real CashToken transfer with exact
conservation (token change returns to the payer; the builder refuses a
payment it cannot cover instead of silently burning tokens). That is a
payment primitive that only exists because BCH has native tokens.

The payer opens the link and pays in seconds: scan the BIP21 QR with any
major BCH wallet (Paytaca, Selene, Electron Cash), or connect via
WizardConnect. Either way the payment is a real Bitcoin Cash mainnet
transaction, signed by the payer's own wallet — EmberPay is fully
non-custodial and never touches keys or coins. Under the hood: Libauth for
CashAddress/token logic, integer-satoshi (BigInt) money math throughout,
and a 25-test suite (all passing) covering the invoice codec, the language
parser, address derivation, and BCH + CashToken transaction assembly —
including byte-level decode checks of assembled token transfers.
Typical fees: 226 sats for a standard BCH payment, 488 sats for a tested
fungible-token payment, at 1 sat/byte.

Stated honestly: the WizardConnect pairing/pubkey layer is implemented
against the official packages; its sign-and-broadcast step still needs
live UTXO discovery (indexer) wired in, so the fully-proven send path in
this submission is the BIP21 QR/deep-link flow. The transaction builders
for the connected flow are complete and unit-tested.

Roadmap: in-browser UTXO discovery for end-to-end WizardConnect sends,
recurring and split payment links, token price oracles, merchant webhooks.

## Links
- **Live demo:** https://abdul99090.github.io/emberpay/
- **GitHub repo:** https://github.com/Abdul99090/emberpay
- **Presentation (Widget Factory template):** TODO — replace with the filled
  copy before submitting; the demo banner must link to the same URL.
- **CashTokens address (EMBER2026 votes / donations):**
  `bitcoincash:zqcz8jfpdssmzhxs7h2ddkfhllkfldy3vvzq8mlwt5`
- **BCH donation address:**
  `bitcoincash:qqcz8jfpdssmzhxs7h2ddkfhllkfldy3vv92593g58`

## How it was built
JavaScript (ES modules, no build step): Libauth for address/transaction
primitives, official @wizardconnect/dapp + @wizardconnect/core packages for
wallet connection, BIP21 for universal QR/deep-link payments, node:test for
the 25-test suite covering the invoice codec, the language parser, address
derivation and BCH + CashToken transaction assembly.

## Team
Solo: bejo — DoraHacks `hacker8d060a3`, GitHub `Abdul99090`.
Looking for teammates: No.

## Pre-existing work disclosure
None. This project was created from scratch during the BCH BLAZE 2026
submission window (first commit in the repo marks the start).
