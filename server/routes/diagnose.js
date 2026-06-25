import { Router } from 'express';
import { runAll, summaryString } from '../lib/diagnostics.js';
import { getDB } from '../db.js';
import { asyncHandler } from '../lib/errors.js';
import jwt from 'jsonwebtoken';

const router = Router();

// GET /api/diagnose — полная диагностика
// Доступ: admin токен или X-Diagnose-Key совпадающий с ADMIN_PASS
router.get('/', asyncHandler(async (req, res) => {
  // Простая авторизация: admin token или diagnose key
  const authHeader = req.headers.authorization;
  const diagnoseKey = req.headers['x-diagnose-key'];
  let isAdmin = false;

  if (authHeader?.startsWith('Bearer ')) {
    try {
      jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
      isAdmin = true;
    } catch (_) { /* не админ */ }
  }
  if (!isAdmin && diagnoseKey && process.env.ADMIN_PASS) {
    isAdmin = diagnoseKey === process.env.ADMIN_PASS;
  }

  const baseUrl = req.protocol + '://' + req.get('host');
  const db = getDB();

  const result = await runAll({ db, baseUrl });

  res.json({
    success: result.summary.fail === 0,
    summary: result.summary,
    summaryText: summaryString(result),
    groups: result.groups,
    timestamp: new Date().toISOString(),
    authorized: isAdmin,
  });
}));

export default router;
