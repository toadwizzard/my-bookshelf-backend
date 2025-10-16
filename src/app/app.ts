import createHttpError from "http-errors";
import express, { NextFunction, Request, Response } from "express";
import logger from "morgan";
import { ResponseError } from "../helpers/responseError.js";

const app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  next(createHttpError(404));
});

app.use(
  "/api",
  (error: any, req: Request, res: Response, next: NextFunction) => {
    const response: ResponseError = {
      status: error.status || 500,
      message: error.message,
      error: res.app.get("env") === "development" ? error : {},
    };
    res.json(response);
  }
);

app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  const title = `<head><title>Error | ${error.status || 500}</title></head>`;
  const status = `<h1>${error.status || 500}</h1>`;
  const message = `<h2>${error.message || "Error"}</h2>`;
  const stack =
    res.app.get("env") === "development" ? `<pre>${error.stack}</pre>` : "";
  res.send(title + status + message + stack);
});

export default app;
