import type winston from "winston";

/** Closes file transports so Node can exit (Winston keeps log file handles open otherwise). */
export async function shutdownLogger(logger: winston.Logger): Promise<void> {
  await Promise.all(
    logger.transports.map(
      (t) =>
        new Promise<void>((resolve) => {
          const tr = t as { close?: (cb?: () => void) => void };
          if (typeof tr.close === "function") {
            tr.close(() => resolve());
          } else {
            resolve();
          }
        })
    )
  );
  logger.close();
}
