import express from 'express';
import { 
  createRequest, 
  getAllRequests,
  trackRequestByCode,
  getRequestById, 
  searchRequests,
  getUserRequests,
  getUserRequestDetails,
  getAllandallRequests,
  exportRequestsToCSV,
  getPendingCount  // 🆕 ADD THIS
} from '../controllers/request.controller.js';
import { authenticateToken as auth } from '../middleware/auth.middleware.js';

const router = express.Router();

// Protected routes — user must send valid JWT
router.post('/request', auth, createRequest);
router.get('/getrequest', auth, getAllRequests);
router.get('/track/:tracking_code', trackRequestByCode);
router.get('/requestbyid/:id', auth, getRequestById);
router.get('/user/requests', auth, getUserRequests);
router.get('/search', auth, searchRequests);
router.get('/requests/all', auth, getAllandallRequests);
router.get('/user/requests/:trackingCode', auth, getUserRequestDetails);
router.get('/export/csv', auth, exportRequestsToCSV);

// 🆕 Pending count for sidebar badge
router.get('/pending-count', auth, getPendingCount);

export default router;