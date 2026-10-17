import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();
const server = app.listen(env.PORT, "127.0.0.1", () => {
  console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {app.locals.close();process.exit(0);});
  });
}
