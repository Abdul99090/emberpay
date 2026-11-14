# Submission checklist — BCH BLAZE 2026 (Mainnet Track)

Deadline: **22 Nov 2026, 21:00 WIB** (14:00 UTC). Judging 23–27 Nov,
winners announced 28 Nov. Requirements below were verified against the
official hackathon page on 15 Nov 2026.

## Done in this repo
- [x] Original project built during the submission window (EmberPay)
- [x] Feature that sends BCH mainnet transactions — BIP21 QR / deep-link
      payment path (any major wallet signs & broadcasts a real mainnet tx);
      WizardConnect signing path prepared in `src/tx.js` + `wallet-connect.js`
- [x] WizardConnect integration (`@wizardconnect/dapp` + `@wizardconnect/core`)
- [x] Top-of-page banner on the demo: presentation link, GitHub link,
      CashTokens EMBER2026 donation/voting address
- [x] Public GitHub repo with source + README
- [x] Test suite green (19/19) — `npm test`
- [x] Project wallet generated; public addresses in `project-addresses.json`
      (private key stored outside the repo)
- [x] BUIDL field draft — [BUIDL.md](BUIDL.md)

## Remaining — needs a browser session (logged-in DoraHacks)
- [ ] Enable GitHub Pages for the repo (Settings → Pages, or
      `gh api -X POST repos/Abdul99090/emberpay/pages -f source.branch=main -f source.path=/`)
      and confirm https://abdul99090.github.io/emberpay/ loads with the banner
- [ ] Click through the live demo once (create invoice → open link → pay view)
- [ ] Test WizardConnect pairing once with a real Paytaca wallet
- [ ] Fill the Widget Factory presentation (template:
      https://docs.google.com/presentation/d/1Yfuk9CJkf4U9M_WukcELhumWgj3Ak6345Ewy8hSp-Hk/edit?usp=sharing ),
      publish it, put ITS link in the demo banner (replacing the template
      link) and in BUIDL.md
- [ ] Submit the BUIDL on DoraHacks using the fields in BUIDL.md
      (hackathon page → Submit BUIDL; account `hacker8d060a3` is registered)

## Remaining — needs a human (hard eligibility gates, from the official page)
- [ ] **Attend ≥ 1 BLAZE preparation stream** (Information stream or
      Workshop 1/2/3) — roll call is taken; one team member attending one
      stream is enough. Check the Streams section at the top of the
      hackathon page for remaining sessions BEFORE 22 Nov. ⚠️ If no stream
      remains, Mainnet-Track eligibility is at risk — escalate immediately.
- [ ] **Confirm the project is real in the BCH BLAZE Telegram channel**
      (one message from the team account once the BUIDL is submitted).

## Optional but valuable
- [ ] One tiny real mainnet payment to the project address through the demo
      link (≈1.000–10.000 sats) as end-to-end proof the flow settles on-chain
      — needs a funded BCH wallet (mainnet funds are a human decision).
- [ ] After the BUIDL is live, share it once in the Telegram channel (doubles
      as the "confirm real" step) to start Community-Choice visibility.
