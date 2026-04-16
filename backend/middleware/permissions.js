import { userCan } from '@poultrymanager/shared';

export const requirePermission = (action) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized — no user' });
  }

  if (userCan(req.user, action)) {
    return next();
  }

  return res.status(403).json({
    message: `Missing permission: ${action}`,
  });
};

export const requireAnyPermission = (...actions) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized — no user' });
  }
  for (const action of actions) {
    if (userCan(req.user, action)) return next();
  }
  return res.status(403).json({
    message: `Missing permission: one of ${actions.join(', ')}`,
  });
};

export function can(user, action) {
  return userCan(user, action);
}
