import type { Config } from "@react-router/dev/config";

export default {
  // SPA mode: the app is rendered on the client and talks to the API over HTTP.
  // Set to `true` only if we decide to server-render later.
  ssr: false,
} satisfies Config;
