export function validatePayoutInvoice(decoded, amountAtomic, now = Math.floor(Date.now() / 1000)) {
  const invalid = reason => ({ valid: false, reason });
  if (!decoded || typeof decoded !== 'object') return invalid('The RGB invoice could not be decoded.');
  if (decoded.network !== 'SignetCustom') return invalid('The invoice must use CustomSignet.');
  const assetId = 'rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0';
  if (decoded.assetId !== assetId || decoded.assetSchema !== 'Nia') return invalid('The invoice must select the supported test USDT asset.');
  if (typeof decoded.recipientId !== 'string' || !decoded.recipientId.startsWith('sbc:wvout:')) return invalid('The invoice must use a CustomSignet witness recipient.');
  if (!decoded.assignment || Object.keys(decoded.assignment).join(',') !== 'Fungible' ||
      !Number.isSafeInteger(decoded.assignment.Fungible) || String(decoded.assignment.Fungible) !== amountAtomic) {
    return invalid('The invoice amount must exactly match amountAtomic.');
  }
  if (!Number.isSafeInteger(decoded.expirationTimestamp) || decoded.expirationTimestamp <= now + 60) return invalid('The invoice must remain valid for more than 60 seconds.');
  if (JSON.stringify(decoded.transportEndpoints) !== JSON.stringify(['rpcs://proxy.iriswallet.com/0.2/json-rpc'])) return invalid('The invoice must use the supported RGB proxy.');
  return {
    valid: true, network: decoded.network, assetId, amountAtomic,
    recipientId: decoded.recipientId, expirationTimestamp: decoded.expirationTimestamp
  };
}
