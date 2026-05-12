# Admin User Setup Guide

## Overview

The Ente Arazhy backend now supports an **ADMIN** role with full API access. Admin users can access all endpoints without restrictions.

## Available Roles

- **ADMIN**: Full system access to all APIs
- **VICAR**: Church leadership role with limited access
- **FAMILY_HEAD**: Family head with family-level access
- **MEMBER**: Standard member access

## Creating an Admin User

### Method 1: Using the Setup Script (Recommended)

Run the admin creation script from the project root:

```bash
# Create admin with custom password
node scripts/createAdmin.js password

# Examples:
node scripts/createAdmin.js SecurePassword@2024
```

The script will:
- Create an ADMIN member named "Vicar"
- House Number: 0
- No family or church affiliation required
- Display login credentials

### Method 2: Manual Database Entry

Connect to MongoDB and insert:

```javascript
db.members.insertOne({
  firstName: "Vicar",
  lastName: "",
  fullName: "Vicar",
  houseNumber: 0,
  email: "admin@entearazhy.com",
  phone: "ADMIN",
  role: "ADMIN",
  password: "HASHED_PASSWORD", // Must be bcrypt hashed
  gender: "N/A",
  isActive: true,
  mustResetPassword: false,
  createdAt: new Date(),
  updatedAt: new Date()
})
```

## Admin Login

### Request

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "houseNumber": 0,
  "password": "your_password_here"
}
```

### Response

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "member": {
      "_id": "...",
      "firstName": "Vicar",
      "role": "ADMIN",
      "houseNumber": 0,
      ...
    },
    "accessToken": "eyJhbGc...",
    "mustResetPassword": false
  }
}
```

## Using Admin Token

All subsequent API requests should include the access token:

```bash
Authorization: Bearer eyJhbGc...
```

## Admin-Only Endpoints

To create an admin-only endpoint, use the `adminOnly` middleware:

```javascript
// In route file
const authenticate = require('../middlewares/authenticate');
const adminOnly = require('../middlewares/adminOnly');

router.post('/admin/action', authenticate, adminOnly, controller.action);
```

**Middleware Chain:**
1. `authenticate` - Validates JWT and fetches user role
2. `adminOnly` - Checks if user role is ADMIN

## Security Notes

⚠️ **Important:**
- Keep admin credentials secure
- Change the default password after first setup
- Use strong passwords (min 12 characters recommended)
- Limit admin account usage for sensitive operations
- Monitor admin activity in production
- Use HTTPS in production for all auth endpoints

## Admin Permissions

Admin users have access to:
- ✓ All member CRUD operations
- ✓ All church management operations
- ✓ All division management operations
- ✓ All family management operations
- ✓ All event management operations
- ✓ All celebrations/anniversary data
- ✓ Token management operations
- ✓ Any future protected endpoints

## Changing Admin Password

Admin can change their password:

```bash
POST /api/v1/auth/change-password/:memberId
Content-Type: application/json
Authorization: Bearer <token>

{
  "oldPassword": "Admin@12345",
  "newPassword": "NewSecurePassword@2024"
}
```

## Troubleshooting

### Admin script connection fails
- Ensure MongoDB is running
- Check `MONGO_URI` in `.env`
- Verify network connectivity

### Admin login fails
- Verify house number (default: 1)
- Confirm password is correct
- Check if member's `isActive` is true

### Admin middleware returns 403
- Verify user role is "ADMIN"
- Check token hasn't expired
- Ensure authenticate middleware runs before adminOnly

## Default Admin Credentials

After running `node scripts/createAdmin.js <password>`:

- **Name:** Vicar
- **House Number:** 0
- **Password:** (your_password_provided)
- **Email:** admin@entearazhy.com
- **Role:** ADMIN
- **No Church/Division/Family:** Admin operates independently

---

For more information, see the authentication controller at `src/controllers/v1/auth/auth.controller.js`
