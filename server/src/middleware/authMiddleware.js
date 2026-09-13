const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware: protect routes by validating JWT Bearer token
 * Can be used directly as middleware: `router.get('/path', protect, ...)`
 * or invoked as a factory function: `router.get('/path', protect(), ...)`
 */
const protectHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Authentication token required.',
      statusCode: 401,
      errorCode: 'UNAUTHENTICATED',
      timestamp: new Date().toISOString()
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET || 'development_appointease_secret_key_change_in_prod';
    const decoded = jwt.verify(token, secret);
    req.user = decoded; // { id, role, email, ... }
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please authenticate again.',
      statusCode: 401,
      errorCode: 'SESSION_EXPIRED',
      timestamp: new Date().toISOString()
    });
  }
};

const protect = (req, res, next) => {
  // If called as middleware directly
  if (req && res && typeof next === 'function') {
    return protectHandler(req, res, next);
  }
  // If called as protect()
  return protectHandler;
};

/**
 * Role-Based Access Control Guard
 * @param  {...string} roles Allowed roles ('ADMIN', 'PROVIDER', 'PATIENT')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required prior to authorization check.',
        statusCode: 401,
        errorCode: 'UNAUTHENTICATED',
        timestamp: new Date().toISOString()
      });
    }

    const userRole = (req.user.role || '').toUpperCase();
    const normalizedRoles = roles.map((r) => r.toUpperCase());

    if (!normalizedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role '${userRole || 'ANONYMOUS'}' does not have access to this resource.`,
        statusCode: 403,
        errorCode: 'FORBIDDEN_ROLE',
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

module.exports = {
  protect,
  requireRole,
  // Aliases for backwards compatibility
  authenticateToken: protect,
  authorizeRoles: requireRole
};
