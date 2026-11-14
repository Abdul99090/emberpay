# 🔥 EmberPay

**Payment requests for Bitcoin Cash and CashTokens that travel as a single link.**

🌐 Live demo: https://abdul99090.github.io/emberpay/ ·
💻 This repo: https://github.com/Abdul99090/emberpay ·
🏆 Built for [BCH BLAZE 2026](https://dorahacks.io/hackathon/bchblaze2026) — Mainnet Track

---

## The problem

Ask a freelancer how they get paid in crypto and you will hear the same story
everywhere — in BCH community chats, in marketplace groups, in our own
experience selling digital work:

1. They paste a **raw address** into a chat.
2. In a **separate message**, they say how much to send and what it is for.
3. The payer copies both **by hand**, into a wallet, hoping no character
   changed on the way.
4. Days later, neither side can prove which payment belonged to which job.

One wrong character means money to nowhere. One forgotten amount means an
awkward "you underpaid" conversation. And token payments are worse: a
CashToken sent to a non-token address, or with the wrong category, is a
support ticket nobody can answer. Payment-request standards exist (BIP21),
but producing a correct one by hand is wallet-manual trivia — so in practice,
nobody uses them, and the screenshot-and-pray workflow wins by default.

## The solution

**EmberPay turns one sentence — *"Charge 0.01 BCH for the logo design"* — into
a single shareable link that carries the complete payment request (recipient,
amount, label, note — and for CashTokens: category, amount, NFT identity),
which any BCH wallet can pay in one confirmation.**

No account. No server. No database. The link *is* the invoice.

## Proof it works (verify everything yourself)

**1. The whole pipeline, in a terminal, right now** — actual output of
`npm run demo` in this repo:

```
🗣  "Charge 100 EMBER tokens for the sticker pack"

🪙 CashToken invoice (EMBER), category 7e35a8031ca3bb09… (sample category for demo)
📄 Invoice: {
  "to": "bitcoincash:zqcz8jfpdssmzhxs7h2ddkfhllkfldy3vvzq8mlwt5",
  "amountSats": "1000",
  "asset": { "type": "cashtoken", "category": "7e35a8031ca3bb09…",
             "amount": "100", "symbol": "EMBER" },
  "label": "The sticker pack", …
}
🔗 Payment link: https://abdul99090.github.io/emberpay/#/pay/eyJ2IjoxLCJpZCI6…
💸 BIP21 URI: bitcoincash:zqcz8jfpdssmzhxs7h2ddkfhllkfldy3vvzq8mlwt5?amount=0.00001&…
```

**2. The test suite** — `npm test`: **25 tests, 25 passing, 0 failing**
(invoice codec, language parser, address derivation against the known
hash160 of private key 1, BCH transaction assembly, and CashToken
conservation — a token payment of 200 from a 500-token UTXO produces
exactly 200 to the recipient and 300 token change, verified by decoding
the assembled transaction byte-for-byte).

**3. Real mainnet addresses you can inspect on any explorer:**
- BCH donations: [`bitcoincash:qqcz8jfpdssmzhxs7h2ddkfhllkfldy3vv92593g58`](https://blockchair.com/bitcoin-cash/address/bitcoincash:qqcz8jfpdssmzhxs7h2ddkfhllkfldy3vv92593g58)
- CashTokens (EMBER2026 Community-Choice votes land here): [`bitcoincash:zqcz8jfpdssmzhxs7h2ddkfhllkfldy3vvzq8mlwt5`](https://blockchair.com/bitcoin-cash/address/bitcoincash:zqcz8jfpdssmzhxs7h2ddkfhllkfldy3vvzq8mlwt5)

## Try it yourself (3 steps)

1. **Open the demo:** https://abdul99090.github.io/emberpay/ — type
   *"Charge 0.01 BCH for the logo design"* (or *"Charge 100 EMBER tokens
   for the sticker pack"*) and press **Create payment link**.
2. **Open the link** on any device — you get a payment card with a QR code.
3. **Scan & pay** with Paytaca, Selene or Electron Cash. The wallet
   pre-fills a real mainnet transaction; you just confirm. (Send a tiny
   amount — the pre-filled recipient is EmberPay's own project address,
   so a test payment doubles as a donation.)

Developers: `git clone` this repo → `npm test` → `npm run demo`.

## How it works — CashTokens are the engine

Most "BCH support" in payment tools means BCH-as-an-afterthought. EmberPay
is built the other way: its invoice model is **asset-native**. One invoice
format carries either BCH or *any* CashToken — fungible amounts, or one
specific NFT (capability + commitment). That choice drives everything
downstream:

- **Links** encode the full token terms, not just an address.
- **Addresses** switch to token-aware (`z…`) form automatically, so tokens
  can't land on an address that can't hold them.
- **Settlement** (`src/tx.js → buildUnsignedTokenPayment`) assembles the
  real CashToken transfer: category-checked token inputs, BCH funding
  inputs for the carrier amounts and fee, recipient output, token-change
  output, BCH change. Conservation is enforced exactly — the builder
  *refuses* a payment it cannot cover rather than silently burning the
  difference. This is a primitive that only exists because BCH has native
  tokens; on BTC there is nothing to build it with.

Around that engine:

- 🗣 **Invoice assistant** (`src/nlp.js`) — deterministic parser (no LLM
  call, works offline): extracts BCH/sats amounts, token amounts + symbol
  + category, recipient, label and memo from one sentence, and reports
  exactly which fields it could not find.
- 🔗 **Link codec** (`src/invoice.js`) — BigInt satoshi math end-to-end (no
  floats near money), base64url payloads, strict re-validation on decode.
- 📷 **BIP21 QR + deep link** (`src/payuri.js`) — the universal pay path
  every major BCH wallet already understands.
- 🔌 **WizardConnect** (`wallet-connect.js`) — pairing and HD pubkey
  retrieval via the official `@wizardconnect/dapp` + `@wizardconnect/core`
  packages; the payer address is derived locally with Libauth.
- 🛡 **Libauth everywhere** (`src/address.js`) — the reference BCH library
  for CashAddress encoding/decoding, incl. token-aware addresses.

```
 sentence ──► nlp.js ──► invoice.js ──► link (#/pay/<payload>)
                                            │
                              ┌─────────────┴──────────────┐
                              ▼                            ▼
                        BIP21 QR / deep link      WizardConnect session
                        (any BCH wallet)          (tx.js assembles the BCH
                                                   or CashToken transfer →
                                                   wallet signs → mainnet)
```

## The numbers

| | |
|---|---|
| Tests | **25 passing / 0 failing** (`node:test`, offline) |
| Cost of a typical 1-in/2-out BCH payment | **226 sats** fee @ 1 sat/byte |
| Cost of a fungible CashToken payment (2 in / 3 out, tested) | **488 sats** fee |
| Server / database in the payment path | **0 / 0** |
| Build step for the demo | **none** (plain ES modules) |
| Private keys EmberPay ever touches | **0** (fully non-custodial) |

## Challenges & honesty (what is NOT done, stated plainly)

- **WizardConnect scope today:** pairing, session handling and pubkey →
  address derivation are implemented against the official packages. The
  sign-and-broadcast step additionally needs live UTXO discovery for the
  connected wallet (an indexer round-trip); the transaction builders it
  will feed are complete and unit-tested, but the connected-wallet send
  has **not yet been exercised end-to-end with a real wallet** — the
  BIP21 QR path is the fully-proven send path in this submission.
- **No mainnet transaction has been broadcast by EmberPay itself** — by
  design. Payments are always created and signed in the *payer's* wallet;
  our own project wallet exists to receive donations and EMBER2026 votes.
- **The demo's sample token category** (in the terminal demo) is a labelled
  placeholder — sha256 of a fixed string — used so the token flow can be
  tried without a real token. Real categories slot in unchanged.
- **Hackathon process gates** (from the official page) are tracked in
  [SUBMISSION-CHECKLIST.md](SUBMISSION-CHECKLIST.md), including the two
  that need a human: attending one preparation stream (roll call) and
  confirming the project in the BLAZE Telegram channel.

## What's next

- **Immediate:** in-browser UTXO discovery (public indexer) so the
  WizardConnect sign-and-broadcast path runs end-to-end in the demo.
- **Next:** recurring payment links (subscriptions), multi-recipient split
  links, and CashTokens-denominated price oracles (token amount ⇄ fiat).
- **Platform:** a merchant mode with webhook notifications and an embeddable
  "Pay with EmberPay" button — same link format, no new infrastructure.

## Project structure

```
index.html            Live demo (GitHub Pages) incl. the BLAZE banner
app.js                Demo UI (create + pay views, asset-aware)
wallet-connect.js     WizardConnect pairing / pubkey / address derivation
src/
  invoice.js          Invoice model, satoshi math, link payload codec
  nlp.js              Natural-language invoice assistant
  payuri.js           BIP21 payment URI build/parse
  address.js          CashAddress + token-address helpers (Libauth)
  tx.js               BCH + CashToken transaction assembly, coin selection, fees
  libauth-helpers.js  P2PKH locking bytecode, tx serialization wrappers
test/                 25 tests across every src module
scripts/
  demo-invoice.js     Terminal demo of the assistant (BCH + CashToken)
  generate-wallet.js  Creates the project donation/voting wallet
                      (key written outside the repo, mode 0600)
project-addresses.json  Public project addresses
BUIDL.md              DoraHacks submission fields, ready to paste
SUBMISSION-CHECKLIST.md Every official requirement, ticked or assigned
```

## Team

Solo build by **bejo** (DoraHacks `hacker8d060a3`, GitHub `Abdul99090`) for
BCH BLAZE 2026. All code in this repository was written during the
hackathon submission window; there is no pre-existing work to disclose.

## License

MIT — see [LICENSE](LICENSE).
