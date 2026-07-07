/**
 * Admin middleware.
 * Проверяет что пользователь является админом.
 * Должен идти после authMiddleware.
 */
import { Request, Response, NextFunction } from 'express';

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
