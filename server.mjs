import { createServer } from 'node:http';

export async function getHealth(fetchService = fetch) {
  async function check(url, validate) {
    try {
      const response = await fetchService(url, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) return { status: 'unavailable', httpStatus: response.status };
      const body = await response.json();
      return validate(body) ? { status: 'ok' } : { status: 'unexpected_response' };
    } catch {
      return { status: 'unavailable' };
    }
  }

  const [qvac, rgb] = await Promise.all([
    check('http://127.0.0.1:11434/v1/models',
      (body) => Array.isArray(body?.data) && body.data.some((model) => model?.id === 'goal-digger')),
    check('http://127.0.0.1:3001/nodeinfo',
      (body) => typeof body?.pubkey === 'string' && body.pubkey.length > 0),
  ]);
  return {
    status: qvac.status === 'ok' && rgb.status === 'ok' ? 'ok' : 'degraded',
    qvac,
    rgb,
  };
}

export const server = createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store');
  if (request.url?.split('?')[0] !== '/health') {
    response.writeHead(404).end(JSON.stringify({ error: 'Endpoint not found.' }));
    return;
  }
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.writeHead(405).end(JSON.stringify({ error: 'Use GET for this endpoint.' }));
    return;
  }
  const health = await getHealth();
  response.writeHead(health.status === 'ok' ? 200 : 503).end(JSON.stringify(health));
});

if (import.meta.main) {
  server.listen(4000, '127.0.0.1', () => {
    console.log('Health endpoint: http://127.0.0.1:4000/health');
  });
  server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
}
