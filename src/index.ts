import debug from "debug";
import http from "http";
import config from "./config.js";
import app from "./app/app.js";
import mongoose from "mongoose";

if (config.nodeEnv === "development") debug.enable("my-bookshelf-backend:*");
const log = debug("my-bookshelf-backend:server");

app.set("port", config.port);

mongoose.set("strictQuery", false);

async function connectMongoose() {
  await mongoose.connect(config.connectionString);
}

try {
  connectMongoose();
} catch (err) {
  console.error(`Failed to connect to MongoDB`, err);
  process.exit(1);
}

const server = http.createServer(app);

server.listen(config.port);
server.on("error", onError);
server.on("listening", onListening);

function onError(error: any) {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = "Port " + config.port;

  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
    default:
      throw error;
  }
}

function onListening() {
  const addr = server.address();
  if (!addr) return;
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  log("Listening on " + bind);
}
