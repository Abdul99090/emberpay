/**
 * WizardConnect integration (the BLAZE-recommended BCH wallet connection).
 *
 * Flow (per the official @wizardconnect/dapp + @wizardconnect/core API):
 *   1. initiateDappRelay(statusCallback) opens the relay and returns a
 *      pairing URI — rendered here as a QR the user scans with a
 *      WizardConnect wallet such as Paytaca.
 *   2. The status callback forwards (client, status) into
 *      DappConnectionManager.updateConnection(), which completes the
 *      handshake and exposes the wallet's HD public keys.
 *   3. The payer's receive address is derived locally from the wallet
 *      pubkey (Libauth) and shown in the UI.
 *
 * Sending then uses DappConnectionManager.signTransaction({transaction,
 * inputPaths}) with the unsigned transaction assembled by src/tx.js.
 * If anything in this layer fails (no wallet, CDN blocked, relay down),
 * EmberPay degrades gracefully: the BIP21 QR / deep-link pay path always
 * works with any BCH wallet, no connection needed.
 */
import { initiateDappRelay, PATH_RECEIVE } from '@wizardconnect/core';
import { DappConnectionManager } from '@wizardconnect/dapp';
import { encodeCashAddress, hash160 } from '@bitauth/libauth';

let manager = null;

/** Derive the mainnet CashAddress for a compressed pubkey. */
export function pubkeyToCashAddress(publicKey) {
  const result = encodeCashAddress({
    prefix: 'bitcoincash',
    type: 'p2pkh',
    payload: hash160(publicKey),
  });
  if (typeof result !== 'object' || typeof result.address !== 'string') {
    throw new Error('address derivation failed');
  }
  return result.address;
}

/**
 * Start a WizardConnect pairing.
 * @param {object} callbacks
 * @param {(uri: string) => void} callbacks.onPairingUri pairing URI to show as QR/text
 * @param {(address: string) => void} callbacks.onConnected wallet receive address
 * @param {(message: string) => void} callbacks.onStatus human-readable status updates
 * @returns {Promise<void>}
 */
export async function connectWizard({ onPairingUri, onConnected, onStatus }) {
  manager = new DappConnectionManager('EmberPay');

  const relay = initiateDappRelay((client, status) => {
    manager.updateConnection(client, status);
    onStatus(`WizardConnect relay: ${status}`);
    if (manager.isWalletDiscovered()) {
      try {
        const pubkey = manager.getPubkey(PATH_RECEIVE, 0n);
        if (pubkey) onConnected(pubkeyToCashAddress(pubkey));
      } catch {
        onStatus('Wallet connected (address derivation unavailable).');
      }
    }
  });

  manager.attachRelay(relay);
  if (relay && typeof relay.uri === 'string') onPairingUri(relay.uri);
  return relay;
}

/** The active DappConnectionManager (null before connect). */
export function getWizardManager() {
  return manager;
}
