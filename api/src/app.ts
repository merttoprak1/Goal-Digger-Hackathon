import express from "express";
import {openSessions} from './store/sessions.js';
import {sessionRoutes} from './routes/sessions.js';
import morgan from "morgan";
import { env } from "./config/env.js";
import { ApiError, errorHandler } from "./middlewares/error-handler.js";
import { requestId } from "./middlewares/request-id.js";
import { routes } from "./routes/index.js";

export function createApp({databasePath=env.DATABASE_PATH}:{databasePath?:string}={}) {
  const app = express();

  const sessionStore=openSessions(databasePath);
  app.locals.sessionStore=sessionStore;
  app.disable('x-powered-by');
  app.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
  app.use(express.json({limit:'4kb'}));
  app.use(requestId);
  if (env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  app.use('/api',sessionRoutes(sessionStore));
  app.use('/api',routes);
  app.use(routes);
  app.use((_req,_res,next)=>next(new ApiError(404,'Endpoint not found.','NOT_FOUND')));

  app.use(errorHandler);
  return app;
}
