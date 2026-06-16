# 🚀 Backend Quick Start Guide

## 30 Second Setup

### Step 1: Navigate to backend
```bash
cd backend
```

### Step 2: Install dependencies
```bash
npm install
```

### Step 3: Create .env file
```bash
cp .env.example .env
```

### Step 4: Start server
```bash
npm run dev
```

✅ **Done!** Backend running on `http://localhost:5000`

---

## Verify It's Working

### Option A: Use Browser
Visit: `http://localhost:5000/health`

Expected: `{"status": "Backend server is running"}`

### Option B: Use Terminal
```bash
curl http://localhost:5000/health
```

### Option C: Test Email Verification
```bash
curl -X POST http://localhost:5000/api/auth/verify-google-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@gmail.com"}'
```

Expected Response:
```json
{
  "exists": true,
  "verified": true,
  "email": "test@gmail.com",
  "message": "Gmail account verified"
}
```

---

## Connect Frontend

The frontend (`UserAccountPanel.js` and `EmployerAccountPanel.js`) is already configured to call:
```
POST /api/auth/verify-google-email
```

If backend is on different port, update in React:
```javascript
// In UserAccountPanel.js, line ~375
fetch('http://localhost:5000/api/auth/verify-google-email', {
```

---

## Default Settings

**Verification Method:** `mock-database`

This means emails in this list will be verified as valid:
- `test@gmail.com`
- `user@gmail.com`
- `john@gmail.com`
- `demo@gmail.com`

Any other Gmail will be rejected.

---

## Adding More Test Emails

Edit `backend/config/emailVerification.js`, line 12:

```javascript
const mockRegisteredEmails = [
  'test@gmail.com',
  'user@gmail.com',
  'john@gmail.com',
  'demo@gmail.com',
  'your-email@gmail.com'  // ← Add here
];
```

Restart server: `npm run dev`

---

## Production Setup

### Switch to SMTP Verification
1. Get Gmail app password: https://myaccount.google.com/apppasswords
2. Update `.env`:
```
EMAIL_VERIFICATION_METHOD=smtp
GMAIL_VERIFY_EMAIL=your-email@gmail.com
GMAIL_VERIFY_PASSWORD=your-app-password
```
3. Restart: `npm run dev`

---

## Troubleshooting

### Port already in use
```bash
PORT=5001 npm run dev
```

### Module not found
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Still having issues?
Check console logs for error messages and see `README.md` for detailed troubleshooting.

---

## Next Steps

- [ ] Connect frontend to backend
- [ ] Test email validation in browser
- [ ] Add database (PostgreSQL/MongoDB)
- [ ] Implement user registration
- [ ] Deploy to production

---

**Questions?** Check `backend/README.md` for complete documentation.
