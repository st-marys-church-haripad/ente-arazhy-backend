/**
 * Global Error Handler Middleware
 * Processes all errors and returns consistent JSON responses
 */
const errorHandler = (err, req, res, next) => {
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
    }
    /* Custom Status Codes */
    else if (err.statusCode) {
      statusCode = err.statusCode;
      message = err.message || message;
    }
    /* Use default message if available */
    else if (err.message) {
      message = err.message;
    }

    res.status(statusCode).json({
      success: false,
      message
    });
  } catch (handlerError) {
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
};

module.exports = errorHandler;