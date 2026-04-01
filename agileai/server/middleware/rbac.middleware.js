export const requireRole = (...roles) => {
  return (req, res, next) => {
    // Fixed by @RoleAuth — ensure user is authenticated and has required role
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to access this resource',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: User role '${req.user.role}' does not have sufficient permissions. Required roles: [${roles.join(', ')}]`,
      });
    }

    next();
  };
};
