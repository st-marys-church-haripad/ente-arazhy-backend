const config = require('../config');

/* Show raw error messages only in local development */
const exposeDetails = config.NODE_ENV === 'development';

/**
 * Global Error Handler Middleware
 * Processes all errors and returns consistent JSON responses
 */
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  try {
    let statusCode = 500;
    let message = 'Internal Server Error';

    /* MongoDB Cast Error */
    if (err.name === 'CastError') {
      statusCode = 404;
      message = 'Resource not found';
    }
    /* MongoDB Duplicate Key Error */
    else if (err.code === 11000) {
      statusCode = 400;
      message = 'Duplicate field value entered';
    }
    /* Mongoose Validation Error */
    else if (err.name === 'ValidationError') {
      statusCode = 400;
      message = Object.values(err.errors)
        .map((error) => error.message)
        .join(', ');
    }
    /* JWT Errors */
    else if (err.name === 'JsonWebTokenError') {
      statusCode = 401;
      message = 'Invalid or expired token';
    } else if (err.name === 'TokenExpiredError') {
      statusCode = 401;
      message = 'Token has expired';
    } else if (err.name === 'NotBeforeError') {
      statusCode = 401;
      message = 'Invalid or expired token';
    }
    /* File upload errors */
    else if (err.name === 'MulterError') {
      if (err.code === 'LIMIT_FILE_SIZE') {
        statusCode = 413;
        message = 'File is too large (maximum 5MB)';
      } else {
        statusCode = 400;
        message = 'Invalid file upload';
      }
    }
    /* Malformed JSON body */
    else if (err.type === 'entity.parse.failed') {
      statusCode = 400;
      message = 'Invalid JSON in request body';
    }
    /* Custom Status Codes */
    else if (err.statusCode || err.status) {
      statusCode = err.statusCode || err.status;
      message = err.message || message;
    }
    /* Unknown errors: raw message only in development */
    else if (err.message && exposeDetails) {
      message = err.message;
    }

    /* Log server errors (no query string, it may contain personal data) */
    if (statusCode >= 500) {
      console.error(
        `[${req.method}] ${String(req.originalUrl).split('?')[0]} -> ${statusCode}:`,
        err.stack || err
      );
      if (!exposeDetails) {
        message = 'Internal Server Error';
      }
    }

    return res.status(statusCode).json({
      success: false,
      message
    });
  } catch (handlerError) {
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
};

module.exports = errorHandler;