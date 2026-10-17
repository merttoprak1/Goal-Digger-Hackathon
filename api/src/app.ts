import express from "express";
import {openStakeDeposits,type StakeDeposits} from '../../stake-deposits.mjs';
import {openSessions} from './store/sessions.js';
import {challengeRoutes} from './routes/challenges.js';
import {sessionRoutes} from './routes/sessions.js';
import morgan from "morgan";
import { env } from "./config/env.js";
import { ApiError, errorHandler } from "./middlewares/error-handler.js";
import { requestId } from "./middlewares/request-id.js";
import { routes } from "./routes/index.js";

export function createApp({databasePath=env.DATABASE_PATH,stakeDeposits}:{databasePath?:string;stakeDeposits?:StakeDeposits}={}) {
  const app = express();

  const sessionStore=openSessions(databasePath);
  app.locals.sessionStore=sessionStore;
  const stakes=stakeDeposits??(env.VAULT_API_TOKEN?openStakeDeposits({databasePath,token:env.VAULT_API_TOKEN}):undefined);
  app.locals.stakeDeposits=stakes;
  app.locals.close=()=>{if(!stakeDeposits)stakes?.close();sessionStore.close();};
  app.disable('x-powered-by');
  app.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
  app.use(express.json({limit:'4kb'}));
  app.use(requestId);
  if (env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  app.use('/api',sessionRoutes(sessionStore));
  app.use('/api/challenges',challengeRoutes(sessionStore,stakes));
  app.use('/api',routes);
  app.use(routes);
  app.use((_req,_res,next)=>next(new ApiError(404,'Endpoint not found.','NOT_FOUND')));

  app.use(errorHandler);
  return app;
}
