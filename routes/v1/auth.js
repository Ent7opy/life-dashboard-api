const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Canopy <hello@canopy.app>';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  display_name: z.string().min(1).max(50).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/v1/auth/register
router.post('/register', validate(registerSchema), async (req, res, next) => {
  const { email, password, display_name } = req.body;
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const verify_token = crypto.randomBytes(32).toString('hex');
    const verify_token_expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { rows } = await pool.query(
      `INSERT INTO users (email, display_name, password_hash, verify_token, verify_token_expires, email_verified)
       VALUES ($1, $2, $3, $4, $5, FALSE)
       RETURNING id, email, display_name`,
      [
        email.toLowerCase(),
        display_name || email.split('@')[0],
        password_hash,
        verify_token,
        verify_token_expires,
      ]
    );

    // Send verification email
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: 'Verify your Canopy account 🌿',
        html: `
          <!DOCTYPE html>
          <html>
          <body style="margin:0;padding:0;background:#f7f3e9;font-family:Georgia,serif;">
            <div style="max-width:520px;margin:40px auto;background:#faf8f3;border:1px solid #d4c5a9;border-radius:12px;padding:48px 40px;">
              <h1 style="margin:0 0 4px;color:#3d6b4f;font-size:32px;font-weight:bold;letter-spacing:-0.5px;">Canopy 🌿</h1>
              <p style="margin:0 0 32px;color:#8a7055;font-size:14px;font-style:italic;">your life, tended carefully</p>
              <h2 style="margin:0 0 12px;color:#2c2416;font-size:20px;font-weight:normal;">Welcome, ${rows[0].display_name}.</h2>
              <p style="margin:0 0 28px;color:#5c4a32;font-size:16px;line-height:1.6;">One more step — verify your email address to start using Canopy.</p>
              <a href="${APP_URL}/auth/verify?token=${verify_token}"
                 style="display:inline-block;background:#3d6b4f;color:#f7f3e9;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-family:Georgia,serif;">
                Verify my email
              </a>
              <p style="margin:28px 0 0;color:#a89070;font-size:13px;line-height:1.5;">This link expires in 24 hours. If you didn't create a Canopy account, you can safely ignore this email.</p>
            </div>
          </body>
          </html>
        `,
      });
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr);
      // Don't fail the registration if email fails — user can request resend
    }

    res.status(201).json({
      message: 'Account created. Please check your email to verify your address.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login
router.post('/login', validate(loginSchema), async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = rows[0];

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email before logging in. Check your inbox.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, display_name: user.display_name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        timezone: user.timezone,
        theme: user.theme,
        settings: user.settings,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/verify?token=...
router.get('/verify', async (req, res, next) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Verification token required' });

  try {
    const { rows } = await pool.query(
      'SELECT id, email FROM users WHERE verify_token = $1 AND verify_token_expires > NOW()',
      [token]
    );

    if (!rows.length) {
      return res.redirect(`${APP_URL}/login?error=invalid_token`);
    }

    await pool.query(
      'UPDATE users SET email_verified = TRUE, verify_token = NULL, verify_token_expires = NULL WHERE id = $1',
      [rows[0].id]
    );

    res.redirect(`${APP_URL}/login?verified=true`);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me  (requires auth)
router.get('/me', require('../../middleware/requireAuth').requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, display_name, timezone, theme, settings, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', async (req, res, next) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const { rows } = await pool.query('SELECT id, display_name FROM users WHERE email = $1', [email.toLowerCase()]);
    // Always return success to prevent email enumeration
    if (rows.length > 0) {
      const reset_token = crypto.randomBytes(32).toString('hex');
      const reset_token_expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await pool.query(
        'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
        [reset_token, reset_token_expires, rows[0].id]
      );
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject: 'Reset your Canopy password',
          html: `
            <div style="max-width:520px;margin:40px auto;background:#faf8f3;border:1px solid #d4c5a9;border-radius:12px;padding:48px 40px;font-family:Georgia,serif;">
              <h1 style="color:#3d6b4f;margin:0 0 24px;">Canopy 🌿</h1>
              <p style="color:#5c4a32;font-size:16px;line-height:1.6;margin:0 0 28px;">Hi ${rows[0].display_name}, here's your password reset link. It expires in 1 hour.</p>
              <a href="${APP_URL}/auth/reset-password?token=${reset_token}"
                 style="display:inline-block;background:#3d6b4f;color:#f7f3e9;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;">
                Reset password
              </a>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error('Failed to send reset email:', emailErr);
      }
    }
    res.json({ message: 'If that email is registered, a reset link is on its way.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 8) {
    return res.status(400).json({ error: 'Valid token and password (min 8 chars) required' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );
    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired reset token' });

    const password_hash = await bcrypt.hash(password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [password_hash, rows[0].id]
    );
    res.json({ message: 'Password updated. You can now log in.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
