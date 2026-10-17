import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePayoutInvoice } from './payout-invoice.mjs';

const decoded = {
  network: 'SignetCustom', assetSchema: 'Nia',
  assetId: 'rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0',
  recipientId: 'sbc:wvout:recipient', assignment: { Fungible: 1000000 },
  expirationTimestamp: 2000, transportEndpoints: ['rpcs://proxy.iriswallet.com/0.2/json-rpc']
};

test('only an exact supported payout invoice passes validation', () => {
  assert.equal(validatePayoutInvoice(decoded, '1000000', 1000).valid, true);
  for (const change of [
    { network: 'Signet' }, { assetId: 'rgb:other' }, { assetId: null },
    { assignment: { Fungible: 999999 } }, { assignment: { Fungible: 0 } },
    { expirationTimestamp: 1060 }, { expirationTimestamp: null },
    { recipientId: 'sbc:utxob:recipient' }, { assetSchema: 'Uda' },
    { transportEndpoints: ['rpc://127.0.0.1:3000/json-rpc'] }, { transportEndpoints: [] }
  ]) assert.equal(validatePayoutInvoice({ ...decoded, ...change }, '1000000', 1000).valid, false);
  assert.equal(validatePayoutInvoice(null, '1000000', 1000).valid, false);
});
