// /utils/logger.ts

import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format to safely handle circular references in objects
const safeStringify = (obj: any): string => {
  if (obj === null || obj === undefined) {
    return String(obj);
  }
  
  // Handle Error objects specially
  if (obj instanceof Error) {
    return `Error: ${obj.message}\nStack: ${obj.stack}`;
  }
  
  try {
    // Use a cache to detect circular references
    const cache: any[] = [];
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        // Check for circular references
        if (cache.includes(value)) {
          return '[Circular Reference]';
        }
        cache.push(value);
      }
      return value;
    }, 2);
  } catch (error) {
    return `[Object cannot be stringified: ${error instanceof Error ? error.message : String(error)}]`;
  }
};

// Create a logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.printf(({ timestamp, level, message, ...rest }) => {
      // Format the message
      let formattedMessage = typeof message === 'string' ? message : safeStringify(message);
      
      // Format the rest of the data
      let restString = '';
      if (Object.keys(rest).length > 0) {
        // Remove service from rest to avoid duplication
        const { service, ...otherRest } = rest;
        if (Object.keys(otherRest).length > 0) {
          restString = ' ' + safeStringify(otherRest);
        }
      }
      
      return `${timestamp} [${level}]: ${formattedMessage}${restString}`;
    })
  ),
  defaultMeta: { service: 'vk-to-telegram-bot' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...rest }) => {
          // Format the message
          let formattedMessage = typeof message === 'string' ? message : safeStringify(message);
          
          // Format the rest of the data
          let restString = '';
          if (Object.keys(rest).length > 0) {
            restString = ' ' + safeStringify(rest);
          }
          
          return `${timestamp} [${level}]: ${formattedMessage}${restString}`;
        })
      )
    }),
    // File transport for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error'
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log')
    })
  ]
});

// If we're not in production, also log to the console with simpler formatting
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}