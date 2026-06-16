const express = require('express');
const router = express.Router();
const { verifyGoogleEmail, sendVerificationCode, verifyCode } = require('../config/emailVerification');

/**
 * POST /api/auth/verify-google-email
 * Check if email format is valid and if already verified
 */
router.post('/verify-google-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
        exists: false,
        verified: false
      });
    }

    const result = await verifyGoogleEmail(email);
    return res.json(result);

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      error: 'Email verification failed',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/send-verification-code
 * Send a verification code to the user's email
 * 
 * Request body:
 * {
 *   email: "user@gmail.com"
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   expiresIn: string
 * }
 */
router.post('/send-verification-code', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const result = await sendVerificationCode(email);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error('Send verification code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send verification code'
    });
  }
});

/**
 * POST /api/auth/verify-code
 * Verify the code entered by user
 * 
 * Request body:
 * {
 *   email: "user@gmail.com",
 *   code: "123456"
 * }
 * 
 * Response:
 * {
 *   verified: boolean,
 *   message: string
 * }
 */
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        verified: false,
        message: 'Email and code are required'
      });
    }

    const result = await verifyCode(email, code);
    
    // Use 400 for verification failures, 200 for success
    const statusCode = result.verified ? 200 : 400;
    return res.status(statusCode).json(result);

  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({
      verified: false,
      message: 'Verification failed'
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({ status: 'Auth service is running' });
});

module.exports = router;
