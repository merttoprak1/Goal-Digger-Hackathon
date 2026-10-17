import express from "express";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { requestId } from "./middlewares/request-id.js";
import { routes } from "./routes/index.js";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(requestId);
  if (env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  app.use(routes);

  app.use(errorHandler);
  return app;
}
