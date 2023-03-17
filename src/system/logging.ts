import { createLogger, Logger, format, transports } from 'winston';
const path = require('path');

console.log('Creating Logger instance');
const logger = createLogger({
  level: 'verbose',
  //format: format.combine(
  //  format.colorize({ all: true }),
  //format.simple(),
  //format.json(),
  //),
  defaultMeta: { service: 'jwtdemo' },
  transports: [
    new transports.Console({ format: format.colorize({ all: true }) }),
    //
    // - Write all logs with level `error` and below to `error.log`
    // - Write all logs with level `info` and below to `full.log`
    //
    new transports.File({
      filename: path.join(__dirname, 'log', 'error.log'),
      level: 'error',
    }),
    new transports.File({
      filename: path.join(__dirname, 'log', 'full.log'),
      maxsize: 20000000,
    }),
  ],
});

logger.info('Logger instance Created');
//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
//if (process.env.NODE_ENV !== 'production')
//{
//  logger.add(new transports.Console({
//    format: format.simple(),
//  }));
//}

export function getLogger(): Logger {
  return logger;
}
