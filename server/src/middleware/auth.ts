/**
 * JWT-аутентификация.
 * Express middleware: проверяет Bearer token → req.user.
 * Socket.IO middleware: проверяет handshake.auth.token.
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

/** Расширяем Express Request полем user */
export interface AuthUser {
  userId: number;
  tgId: number;
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Express middleware — проверка JWT.
 * Использовать на защищённых роутах:
 *   router.post('/save', authMiddleware, handler)
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload & AuthUser;
    req.user = {
      userId: payload.userId,
      tgId: payload.tgId,
      isAdmin: payload.isAdmin,
    };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Socket.IO middleware — проверка JWT при подключении.
 * Использовать: io.use(socketAuthMiddleware)
 */
export function socketAuthMiddleware(socket: any, next: (err?: Error) => void) {
  const token = socket.handshake?.auth?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload & AuthUser;
    socket.data.user = payload;
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
}
