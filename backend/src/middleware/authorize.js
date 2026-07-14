export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.participant?.role)) {
    return res.status(403).json({ detail: "You do not have permission to perform this action" });
  }
  next();
};
