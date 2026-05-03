// backend/src/routes/adminUsersRoutes.js

import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import {
  getAllAdminUsers,
  addAdminUser,
  updateAdminUser,
  deleteAdminUser,
  resetAdminPassword
} from '../controllers/adminUsersController.js';

const router = express.Router();

// All routes require authentication and admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

// Get all admin users
router.get('/admin-users', getAllAdminUsers);

// Add new admin user
router.post('/admin-users', addAdminUser);

// Update admin user
router.put('/admin-users/:id', updateAdminUser);

// Delete admin user
router.delete('/admin-users/:id', deleteAdminUser);

// Reset admin password
router.post('/admin-users/:id/reset-password', resetAdminPassword);

export default router;