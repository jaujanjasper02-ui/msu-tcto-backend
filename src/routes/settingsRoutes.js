// backend/src/routes/settingsRoutes.js
import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { getSettings, updateSettings } from '../controllers/settingsController.js';

const router = express.Router();

// All routes require authentication and admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

// ✅ FIX: Match the frontend endpoint
// Frontend calls: /api/admin/settings
// So dapat: router.get('/settings') kasi ang base ay /api/admin na
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

export default router;