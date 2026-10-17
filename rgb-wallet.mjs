function walletError(status, message) {
  return Object.assign(new Error(message), { status });
}

export function parseNodeJson(text) {
  return JSON.parse(text, (_key, value, context) => {
    if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value)) {
      if (!context?.source || !/^\d+$/.test(context.source)) throw new Error('Invalid integer amount.');
      return context.source;
    }
    return value;
  });
}

function amount(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) return value;
  throw walletError(502, 'RGB returned an invalid balance.');
}

function balances(balance, asset = false) {
  const result = {
    settled: amount(balance?.settled),
    future: amount(balance?.future),
    spendable: amount(balance?.spendable),
  };
  if (asset) {
    result.offchainOutbound = amount(balance?.offchain_outbound);
    result.offchainInbound = amount(balance?.offchain_inbound);
  }
  return result;
}

export async function getRgbWallet(fetchNode = fetch) {
  async function read(path, body) {
    let response;
    try {
      response = await fetchNode(`http://127.0.0.1:3001${path}`, {
        method: body ? 'POST' : 'GET',
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 403) throw walletError(503, 'The RGB node is locked or access was denied.');
      if (!response.ok) throw walletError(502, `RGB returned HTTP ${response.status}.`);
      return parseNodeJson(await response.text());
    } catch (error) {
      if (error.status) throw error;
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw walletError(504, 'The RGB node did not respond within 10 seconds.');
      }
      if (response?.ok) throw walletError(502, 'RGB returned an invalid response.');
      throw walletError(503, 'The RGB node is unavailable.');
    }
  }

  const [bitcoin, listed, network] = await Promise.all([
    read('/btcbalance', { skip_sync: true }),
    read('/listassets', { filter_asset_schemas: ['Nia', 'Uda', 'Cfa', 'Ifa'] }),
    read('/networkinfo'),
  ]);
  if (typeof network?.network !== 'string') throw walletError(502, 'RGB returned an invalid network.');
  const assets = [];
  for (const [group, schema] of Object.entries({ nia: 'Nia', uda: 'Uda', cfa: 'Cfa', ifa: 'Ifa' })) {
    if (!Array.isArray(listed?.[group])) throw walletError(502, 'RGB returned an invalid asset list.');
    for (const asset of listed[group]) {
      if (typeof asset?.asset_id !== 'string' || !asset.asset_id || typeof asset.name !== 'string' ||
          !Number.isInteger(asset.precision) || asset.precision < 0 || asset.precision > 255 ||
          !(asset.ticker == null || typeof asset.ticker === 'string')) {
        throw walletError(502, 'RGB returned invalid asset metadata.');
      }
      assets.push({
        assetId: asset.asset_id, schema, name: asset.name, ticker: asset.ticker ?? null,
        precision: asset.precision, unit: 'atomic', balance: balances(asset.balance, true),
      });
    }
  }
  return {
    network: network.network,
    balanceSource: 'cached',
    bitcoin: { unit: 'sat', vanilla: balances(bitcoin?.vanilla), colored: balances(bitcoin?.colored) },
    assets,
  };
}
