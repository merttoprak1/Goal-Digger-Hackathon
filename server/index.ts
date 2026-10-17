import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createApp } from './app.ts';
import { createStore } from './store.ts';

const port = Number(process.env.PORT ?? 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
const path = resolve(process.env.DATABASE_PATH ?? './data/goal-digger.sqlite');
mkdirSync(dirname(path), { recursive: true });
const store = createStore(path);
const server = createApp(store).listen(port, '127.0.0.1', () => {
  console.log(`Goal Digger API: http://127.0.0.1:${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => { server.close(() => { store.close(); process.exit(0); }); });
}
