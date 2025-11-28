import { RequestHandler } from "express";
import config from "../config.js";

export const corsMiddleware: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  if (origin === config.frontendUrl) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.header("Access-Control-Allow-Methods", "PATCH, DELETE");
  }
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
};
