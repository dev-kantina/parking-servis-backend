import rateLimit from 'express-rate-limit';

// Rate limiter for authentication endpoints (login, register)
// More restrictive to prevent brute force attacks
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: {
    success: false,
    error: 'Previše pokušaja. Molimo pokušajte ponovo za 15 minuta.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Rate limiter for password reset requests
// Very restrictive to prevent email enumeration
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    success: false,
    error: 'Previše zahtjeva za resetovanje lozinke. Pokušajte ponovo za sat vremena.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
// Less restrictive for normal API usage
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    success: false,
    error: 'Previše zahtjeva. Molimo pokušajte ponovo za trenutak.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});
