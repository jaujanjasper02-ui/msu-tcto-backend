import express from 'express';
import { authenticateToken as auth, requireAdmin } from '../middleware/auth.middleware.js';
import {
  updateRequestStatus,
  bulkUpdateRequestStatus,
  getAvailableTransitions,
  getStatusHistory,
  getNextInLine
} from '../controllers/updateStatusController.js';

const router = express.Router();

// ===========================================
// ADMIN ROUTES - bawat route ay may sariling auth + requireAdmin
// ===========================================

// Get available transitions for a specific request
router.get('/requests/:id/transitions', auth, requireAdmin, getAvailableTransitions);

// Get status history for a specific request
router.get('/requests/:id/history', auth, requireAdmin, getStatusHistory);

// Update single request status
router.put('/requests/:id/status', auth, requireAdmin, updateRequestStatus);

// Bulk update multiple requests
router.post('/requests/bulk-status', auth, requireAdmin, bulkUpdateRequestStatus);

// FIFO: Get next in line queue number (for admin dashboard)
router.get('/requests/next-in-line', auth, requireAdmin, getNextInLine);

export default router;