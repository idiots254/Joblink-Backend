# Joblink Backend API

Backend server for Joblink application with email verification endpoints.

## Folder Structure

```
backend/
├── config/
│   └── emailVerification.js    # Email verification logic
├── routes/
│   └── auth.js                 # Authentication endpoints
├── server.js                   # Main Express server
├── package.json                # Dependencies
├── .env.example                # Environment variables template
└── README.md                   # This file
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Create `.env` File

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```
PORT=5000
EMAIL_VERIFICATION_METHOD=mock-database
```

### 3. Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

Server will run on `http://localhost:5000`

---

## API Endpoints

### Email Verification

**POST** `/api/auth/verify-google-email`

Verify if an email exists in Google's system.

**Request:**
```json
{
  "email": "user@gmail.com"
}
```

**Response (Success):**
```json
{
  "exists": true,
  "verified": true,
  "email": "user@gmail.com",
  "message": "Gmail account verified"
}
```

**Response (Not Found):**
```json
{
  "exists": false,
  "verified": false,
  "email": "fake@gmail.com",
  "message": "Gmail account not found"
}
```

**Response (Not Gmail):**
```json
{
  "error": "Only Gmail addresses (@gmail.com) are allowed",
  "exists": false,
  "verified": false,
  "email": "user@yahoo.com"
}
```

### Health Check

**GET** `/api/auth/health`

Check if auth service is running.

**Response:**
```json
{
  "status": "Auth service is running"
}
```

**GET** `/health`

Check if backend server is running.

**Response:**
```json
{
  "status": "Backend server is running"
}
```

---

## Email Verification Methods

### 1. Basic Format (DEFAULT)
- ✅ Fastest (no network calls)
- ✅ Just validates Gmail format
- ❌ No actual verification
- **Use for:** Quick testing

**Set:** `EMAIL_VERIFICATION_METHOD=basic-format`

### 2. Mock Database
- ✅ Good for development/testing
- ✅ Checks against predefined email list
- ✅ No external dependencies
- ✅ Add emails in `config/emailVerification.js`
- ❌ Not for production

**Set:** `EMAIL_VERIFICATION_METHOD=mock-database`

**Registered test emails:**
```
test@gmail.com
user@gmail.com
john@gmail.com
demo@gmail.com
```

### 3. SMTP Verification
- ✅ Most reliable
- ✅ Actually connects to Gmail
- ✅ Better for production
- ❌ Requires Gmail credentials

**Set:** `EMAIL_VERIFICATION_METHOD=smtp`

**Setup:**
1. Go to https://myaccount.google.com/apppasswords
2. Generate an App Password
3. Add to `.env`:
```
GMAIL_VERIFY_EMAIL=your-email@gmail.com
GMAIL_VERIFY_PASSWORD=your-16-char-password
```

---

## Frontend Integration

### Connect from React

Update `src/accounts/UserAccountPanel.js` and `EmployerAccountPanel.js`:

Change the API endpoint from:
```javascript
fetch('/api/auth/verify-google-email', ...)
```

If backend is on different port (e.g., 5000):
```javascript
fetch('http://localhost:5000/api/auth/verify-google-email', ...)
```

### Proxy Setup (Optional)

Add to `package.json` root level:
```json
"proxy": "http://localhost:5000"
```

Then use `/api/auth/verify-google-email` directly in React.

---

## Testing

### Test with Mock Database

```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Test endpoint
curl -X POST http://localhost:5000/api/auth/verify-google-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@gmail.com"}'

# Response: { "exists": true, "verified": true, ... }
```

### Test with Frontend

1. Start backend: `npm run dev`
2. In separate terminal, start React: `npm start`
3. Open account panel and test email validation
4. See console logs for verification details

---

## Troubleshooting

### Backend not starting
```bash
# Check if port 5000 is in use
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows

# Use different port
PORT=5001 npm run dev
```

### CORS errors
- Make sure backend is running
- Check CORS settings in `server.js`
- Verify frontend is making requests to correct URL

### Email verification always fails
- Check `EMAIL_VERIFICATION_METHOD` in `.env`
- Check console logs for errors
- Try different verification method

---

## Future Enhancements

- [ ] Database integration (PostgreSQL, MongoDB)
- [ ] User registration endpoint
- [ ] Google OAuth integration
- [ ] Email delivery verification service
- [ ] Rate limiting
- [ ] Authentication (JWT tokens)
- [ ] User profiles storage
- [ ] Email queue system

---

## Support

For issues or questions, check the logs:
```bash
# See all console output
npm run dev
```

Look for error messages and `ERROR:` or `❌` prefixes.
