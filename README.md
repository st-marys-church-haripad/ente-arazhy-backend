# Ente Arazhy Backend

Backend REST API for the Ente Arazhy mobile application and website.

## Features

- **Authentication & Authorization**
  - JWT-based authentication with access and refresh tokens
  - Role-based access control (Vicar, Family Head, Member)
  - Password reset functionality with email verification
  - Secure password hashing with bcrypt

- **User Management**
  - Member profile management
  - Family and division organization
  - Church management

- **Email Services**
  - Password reset emails with secure tokens
  - HTML email templates

## Tech Stack

- **Runtime:** Node.js 22
- **Framework:** Express 5
- **Database:** MongoDB with Mongoose
- **Authentication:** JWT (jsonwebtoken)
- **Email:** Nodemailer
- **Security:** Helmet, CORS, bcrypt
- **Rate Limiting:** express-rate-limit

## Prerequisites

- Node.js 22 or higher
- MongoDB instance
- SMTP email server (e.g., Gmail, SendGrid, etc.)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd enteArazhy_backend
```

2. Install dependencies:
```bash
npm install
```

3. Install nodemailer (if not already installed):
```bash
npm install nodemailer
```

4. Create a `.env` file in the root directory based on `.env.example`:
```bash
cp .env.example .env
```

5. Configure your environment variables in `.env`:

### Required Environment Variables

#### Database
- `MONGO_URI` - MongoDB connection string

#### JWT Configuration
- `JWT_ACCESS_SECRET` - Secret key for access tokens
- `JWT_REFRESH_SECRET` - Secret key for refresh tokens
- `ACCESS_TOKEN_EXPIRY` - Access token expiration (e.g., "15m")
- `REFRESH_TOKEN_EXPIRY` - Refresh token expiration (e.g., "7d")

#### Email Configuration (for Forgot Password feature)
- `EMAIL_HOST` - SMTP server host (default: smtp.gmail.com)
- `EMAIL_PORT` - SMTP server port (default: 587)
- `EMAIL_USER` - Email account username
- `EMAIL_PASSWORD` - Email account password (use app-specific password for Gmail)
- `EMAIL_FROM` - Sender email address (default: noreply@entearazhy.com)

#### Frontend Configuration
- `FRONTEND_URL` - Frontend application URL for password reset links (e.g., http://localhost:3000)

## Setting Up Email for Forgot Password

### Using Gmail

1. Enable 2-factor authentication on your Google account
2. Generate an app-specific password:
   - Go to your Google Account settings
   - Security → 2-Step Verification → App passwords
   - Select "Mail" and your device
   - Copy the generated 16-character password

3. Configure your `.env` file:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
EMAIL_FROM=noreply@entearazhy.com
FRONTEND_URL=http://localhost:3000
```

### Using Other Email Providers

Configure the SMTP settings according to your email provider:

**SendGrid:**
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
```

**Outlook:**
```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on the port specified in your `.env` file (default: 3000).

## API Documentation

Detailed API documentation is available in [API_PAYLOADS.md](./API_PAYLOADS.md).

### Forgot Password Flow

1. **Request Password Reset**
   - User requests a password reset by providing their email
   - Endpoint: `POST /api/v1/auth/forgot-password`
   - Body: `{ "email": "user@example.com" }`

2. **Receive Reset Email**
   - User receives an email with a reset link containing a secure token
   - Token expires in 1 hour
   - Link format: `{FRONTEND_URL}/reset-password?token={resetToken}`

3. **Reset Password**
   - User clicks the link and submits a new password
   - Frontend sends the token and new password to the backend
   - Endpoint: `POST /api/v1/auth/reset-password-with-token`
   - Body: `{ "token": "...", "newPassword": "..." }`

4. **Success**
   - Password is updated
   - Old reset tokens are invalidated
   - User can now login with the new password

## Security Features

- **Token Security:**
  - Password reset tokens are hashed before storage
  - Tokens expire after 1 hour
  - Used tokens are immediately invalidated

- **Email Enumeration Prevention:**
  - Same response for existing and non-existing emails
  - Prevents attackers from discovering valid email addresses

- **Password Requirements:**
  - Minimum 6 characters (can be increased)
  - Passwords are hashed with bcrypt before storage

## Project Structure

```
src/
├── config/              # Configuration files
├── controllers/         # Request handlers
│   └── v1/
│       └── auth/       # Authentication controllers
├── lib/                # Utility libraries
│   ├── jwt.js          # JWT token generation
│   ├── nodemailer.js   # Email configuration
│   └── mongoose.js     # Database connection
├── middlewares/        # Express middlewares
├── models/             # Database models
├── routes/             # API routes
│   └── v1/
└── server.js          # Application entry point
```

## License

MIT License - see LICENSE file for details

## Author

Jerin Easo Regi

## Support

For issues and questions, please open an issue in the repository.
