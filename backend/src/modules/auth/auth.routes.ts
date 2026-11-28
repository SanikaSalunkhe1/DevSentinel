import { Router } from 'express';
import { authController } from './auth.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = Router();

// Public Authentication Endpoints
router.post('/google', (req, res) => authController.verifyGoogleToken(req, res));
router.get('/google/url', (req, res) => authController.getGoogleAuthUrl(req, res));
router.get('/google/callback', (req, res) => authController.handleGoogleCallback(req, res));
router.post('/logout', (req, res) => authController.logout(req, res));

// Development / Testing Mock Login Endpoint
router.post('/mock-login', (req, res) => authController.mockLoginForTesting(req, res));

// Protected Endpoints
router.get('/me', requireAuth, (req, res) => authController.getMe(req, res));

export default router;
