import fs from "node:fs";
import path from "node:path";
import winston from "winston";

export function createLogger(debug = false): winston.Logger {
  const logDir = path.resolve("logs");
  fs.mkdirSync(logDir, { recursive: true });

  return winston.createLogger({
    level: debug ? "debug" : "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({ format: winston.format.simple() }),
      new winston.transports.File({ filename: path.join(logDir, "crawler.log") }),
      new winston.transports.File({ filename: path.join(logDir, "crawler-error.log"), level: "error" })
    ]
  });
}
