/**
 * Simple in-memory rate limiter middleware.
 * Limits each client IP to a maximum number of requests per time window.
 */

const REQUESTS_PER_MINUTE = 60;
const WINDOW_MS = 60 * 1000; // 1 minute in milliseconds

// Store: { ip: { count: number, resetTime: number } }
const store = new Map();

/**
 * Rate limit middleware that tracks requests per IP address.
 * Returns 429 Too Many Requests if limit is exceeded.
 */
function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  let record = store.get(ip);

  // Initialize or reset if window has expired
  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      resetTime: now + WINDOW_MS,
    };
    store.set(ip, record);
  }

  record.count++;

  // Set rate limit headers
  res.set('X-RateLimit-Limit', REQUESTS_PER_MINUTE);
  res.set('X-RateLimit-Remaining', Math.max(0, REQUESTS_PER_MINUTE - record.count));
  res.set('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

  if (record.count > REQUESTS_PER_MINUTE) {
    return res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded: ${REQUESTS_PER_MINUTE} requests per minute`,
    });
  }

  next();
}

module.exports = rateLimit;
