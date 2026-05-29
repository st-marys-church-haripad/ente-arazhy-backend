# API Payloads Documentation

## Base URL
```
http://localhost:PORT/api/v1
```

---

## 1. AUTH Routes

### Login
- **Method:** `POST`
- **Endpoint:** `/auth/login`
- **Request Body:**
```json
{
  "houseNumber": "number",
  "password": "string"
}
```
- **Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "member": {
      "_id": "string",
      "firstName": "string",
      "lastName": "string",
      "fullName": "string",
      "email": "string",
      "phone": "string",
      "houseNumber": "number",
      "role": "string",
      "churchId": "string",
      "divisionId": "string",
      "familyId": "string",
      "isActive": true
    },
    "accessToken": "string (JWT)",
    "mustResetPassword": "boolean"
  }
}
```

### Refresh Token
- **Method:** `POST`
- **Endpoint:** `/auth/refresh`
- **Request Body:**
```json
{
  "refreshToken": "string (JWT)"
}
```
- **Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "string (JWT)"
  }
}
```

### Logout
- **Method:** `POST`
- **Endpoint:** `/auth/logout`
- **Request Body:**
```json
{
  "memberId": "string (MongoDB ID)"
}
```
- **Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

### Change Password
- **Method:** `POST`
- **Endpoint:** `/auth/change-password/:memberId`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body:**
```json
{
  "oldPassword": "string",
  "newPassword": "string"
}
```
- **Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### Reset Password
- **Method:** `POST`
- **Endpoint:** `/auth/reset-password/:memberId`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body:**
```json
{
  "newPassword": "string"
}
```
- **Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

### Forgot Password
- **Method:** `POST`
- **Endpoint:** `/auth/forgot-password`
- **Description:** Send a password reset email to the user. This is a public endpoint (no authentication required).
- **Request Body:**
```json
{
  "email": "user@example.com"
}
```
- **Response (200):**
```json
{
  "success": true,
  "message": "Password reset link has been sent to your email"
}
```
- **Notes:**
  - Always returns a 200 status even if the email doesn't exist (to prevent email enumeration)
  - Reset token expires in 1 hour
  - Email contains a link with the reset token

### Reset Password With Token
- **Method:** `POST`
- **Endpoint:** `/auth/reset-password-with-token`
- **Description:** Reset password using the token received via email. This is a public endpoint (no authentication required).
- **Request Body:**
```json
{
  "token": "string (received from email)",
  "newPassword": "string (minimum 6 characters)"
}
```
- **Response (200):**
```json
{
  "success": true,
  "message": "Password has been reset successfully. You can now login with your new password."
}
```
- **Response (400 - Invalid/Expired Token):**
```json
{
  "success": false,
  "message": "Invalid or expired reset token"
}
```
- **Response (400 - Weak Password):**
```json
{
  "success": false,
  "message": "Password must be at least 6 characters long"
}
```

---

## 2. CHURCH Routes

### Create Church
- **Method:** `POST`
- **Endpoint:** `/churches`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body:**
```json
{
  "name": "string (required)",
  "address": "string (optional)",
  "phone": "string (optional)",
  "email": "string (optional)"
}
```
- **Response (201):**
```json
{
  "success": true,
  "message": "Church created successfully",
  "data": {
    "_id": "string (MongoDB ID)",
    "name": "string",
    "address": "string",
    "phone": "string",
    "email": "string",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

### Get All Churches
- **Method:** `GET`
- **Endpoint:** `/churches`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Query Parameters:** None
- **Response (200):**
```json
{
  "success": true,
  "count": "number",
  "data": [
    {
      "_id": "string",
      "name": "string",
      "address": "string",
      "phone": "string",
      "email": "string",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ]
}
```

### Get Church by ID
- **Method:** `GET`
- **Endpoint:** `/churches/:id`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "string",
    "name": "string",
    "address": "string",
    "phone": "string",
    "email": "string",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

### Update Church
- **Method:** `PUT`
- **Endpoint:** `/churches/:id`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body:**
```json
{
  "name": "string (optional)",
  "address": "string (optional)",
  "phone": "string (optional)",
  "email": "string (optional)"
}
```
- **Response (200):**
```json
{
  "success": true,
  "message": "Church updated successfully",
  "data": {
    "_id": "string",
    "name": "string",
    "address": "string",
    "phone": "string",
    "email": "string",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

### Delete Church
- **Method:** `DELETE`
- **Endpoint:** `/churches/:id`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response (200):**
```json
{
  "success": true,
  "message": "Church deleted successfully"
}
```

---

## 3. DIVISION Routes

### Create Division
- **Method:** `POST`
- **Endpoint:** `/divisions`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body:**
```json
{
  "churchId": "string (MongoDB ID, required)",
  "name": "string (required)"
}
```
- **Response (201):**
```json
{
  "success": true,
  "message": "Division created successfully",
  "data": {
    "_id": "string (MongoDB ID)",
    "churchId": {
      "_id": "string",
      "name": "string"
    },
    "name": "string",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

### Get All Divisions
- **Method:** `GET`
- **Endpoint:** `/divisions`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Query Parameters:**
  - `churchId` (optional): Filter divisions by church
- **Response (200):**
```json
{
  "success": true,
  "count": "number",
  "data": [
    {
      "_id": "string",
      "churchId": {
        "_id": "string",
        "name": "string"
      },
      "name": "string",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ]
}
```

### Get Division by ID
- **Method:** `GET`
- **Endpoint:** `/divisions/:id`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "string",
    "churchId": {
      "_id": "string",
      "name": "string"
    },
    "name": "string",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

### Update Division
- **Method:** `PUT`
- **Endpoint:** `/divisions/:id`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body:**
```json
{
  "churchId": "string (optional)",
  "name": "string (optional)"
}
```
- **Response (200):**
```json
{
  "success": true,
  "message": "Division updated successfully",
  "data": {
    "_id": "string",
    "churchId": {
      "_id": "string",
      "name": "string"
    },
    "name": "string",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

### Delete Division
- **Method:** `DELETE`
- **Endpoint:** `/divisions/:id`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response (200):**
```json
{
  "success": true,
  "message": "Division deleted successfully"
}
```

---

## 4. FAMILY Routes

### Create Family
- **Method:** `POST`
- **Endpoint:** `/families`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body:**
```json
{
  "churchId": "string (MongoDB ID, required)",
  "divisionId": "string (MongoDB ID, required)",
  "familyName": "string (required)",
  "address": "string (optional)",
  "headMemberId": "string (MongoDB ID, optional)"
}
```
- **Response (201):**
```json
{
  "success": true,
  "message": "Family created successfully",
  "data": {
    "_id": "string",
    "churchId": "string",
    "divisionId": "string",
    "familyName": "string",
    "address": "string",
    "headMemberId": "string",
    "memberIds": ["string"],
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

### Get All Families
- **Method:** `GET`
- **Endpoint:** `/families`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Query Parameters:**
  - `divisionId` (optional): Filter families by division
  - `churchId` (optional): Filter families by church
- **Response (200):**
```json
{
  "success": true,
  "count": "number",
  "data": [
    {
      "_id": "string",
      "churchId": "string",
      "divisionId": "string",
      "familyName": "string",
      "address": "string",
      "headMemberId": "string",
      "memberIds": ["string"],
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ]
}
```

### Get Family by ID
- **Method:** `GET`
- **Endpoint:** `/families/:id`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "string",
    "churchId": "string",
    "divisionId": "string",
    "familyName": "string",
    "address": "string",
    "headMemberId": "string",
    "memberIds": ["string"],
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

### Get Family Members
- **Method:** `GET`
- **Endpoint:** `/families/:id/members`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response (200):**
```json
{
  "success": true,
  "count": "number",
  "data": [
    {
      "_id": "string",
      "firstName": "string",
      "lastName": "string",
      "fullName": "string",
      "email": "string",
      "phone": "string",
      "churchId": "string",
      "divisionId": "string",
      "familyId": "string",
      "gender": "string",
      "dob": "date",
      "isActive": "boolean",
      "role": "string"
    }
  ]
}
```

### Update Family
- **Method:** `PUT`
- **Endpoint:** `/families/:id`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body:**
```json
{
  "churchId": "string (optional)",
  "divisionId": "string (optional)",
  "familyName": "string (optional)",
  "address": "string (optional)",
  "headMemberId": "string (optional)"
}
```
- **Response (200):**
```json
{
  "success": true,
  "message": "Family updated successfully",
  "data": {
    "_id": "string",
    "churchId": "string",
    "divisionId": "string",
    "familyName": "string",
    "address": "string",
    "headMemberId": "string",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

### Delete Family
- **Method:** `DELETE`
- **Endpoint:** `/families/:id`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response (200):**
```json
{
  "success": true,
  "message": "Family deleted successfully"
}
```

---

## 5. MEMBER Routes

### Create Member
- **Method:** `POST`
- **Endpoint:** `/members`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body:**
```json
{
  "firstName": "string (required)",
  "lastName": "string (optional)",
  "churchId": "string (MongoDB ID, required)",
  "divisionId": "string (MongoDB ID, required)",
  "familyId": "string (MongoDB ID, required)",
  "email": "string (optional)",
  "phone": "string (optional)",
  "gender": "string (optional)",
  "dob": "date (optional, YYYY-MM-DD)",
  "marriageDate": "date (optional)",
  "houseNumber": "number (optional)",
  "avatarUrl": "string (optional)",
  "spouseId": "string (MongoDB ID, optional)",
  "role": "VICAR | FAMILY_HEAD | MEMBER (default: MEMBER)",
  "password": "string (optional)",
  "isFamilyHead": "boolean (optional)"
}
```
- **Response (201):**
```json
{
  "success": true,
  "message": "Member created successfully",
  "data": {
    "_id": "string",
    "firstName": "string",
    "lastName": "string",
    "fullName": "string",
    "churchId": "string",
    "divisionId": "string",
    "familyId": "string",
    "email": "string",
    "phone": "string",
    "gender": "string",
    "dob": "date",
    "marriageDate": "date",
    "houseNumber": "number",
    "age": "number",
    "role": "string",
    "isFamilyHead": "boolean",
    "isVicar": "boolean",
    "isActive": true,
    "mustResetPassword": true,
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

### Get All Members
- **Method:** `GET`
- **Endpoint:** `/members`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Query Parameters:**
  - `churchId` (optional): Filter by church
  - `divisionId` (optional): Filter by division
  - `familyId` (optional): Filter by family
  - `role` (optional): Filter by role
  - `isActive` (optional): Filter by active status
- **Response (200):**
```json
{
  "success": true,
  "count": "number",
  "data": [
    {
      "_id": "string",
      "firstName": "string",
      "lastName": "string",
      "fullName": "string",
      "churchId": "string",
      "divisionId": "string",
      "familyId": "string",
      "email": "string",
      "phone": "string",
      "gender": "string",
      "dob": "date",
      "age": "number",
      "role": "string",
      "isActive": "boolean"
    }
  ]
}
```

### Get Member by ID
- **Method:** `GET`
- **Endpoint:** `/members/:id`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "string",
    "firstName": "string",
    "lastName": "string",
    "fullName": "string",
    "churchId": "string",
    "divisionId": "string",
    "familyId": "string",
    "email": "string",
    "phone": "string",
    "gender": "string",
    "dob": "date",
    "marriageDate": "date",
    "houseNumber": "number",
    "age": "number",
    "avatarUrl": "string",
    "spouseId": "string",
    "role": "string",
    "isFamilyHead": "boolean",
    "isVicar": "boolean",
    "isActive": "boolean",
    "mustResetPassword": "boolean",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

### Update Member
- **Method:** `PUT`
- **Endpoint:** `/members/:id`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body:**
```json
{
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "email": "string (optional)",
  "phone": "string (optional)",
  "gender": "string (optional)",
  "dob": "date (optional)",
  "marriageDate": "date (optional)",
  "houseNumber": "number (optional)",
  "avatarUrl": "string (optional)",
  "spouseId": "string (optional)",
  "role": "string (optional)",
  "isFamilyHead": "boolean (optional)",
  "isActive": "boolean (optional)"
}
```
- **Response (200):**
```json
{
  "success": true,
  "message": "Member updated successfully",
  "data": {
    "_id": "string",
    "firstName": "string",
    "lastName": "string",
    "fullName": "string",
    "churchId": "string",
    "divisionId": "string",
    "familyId": "string",
    "email": "string",
    "phone": "string",
    "gender": "string",
    "dob": "date",
    "age": "number",
    "role": "string",
    "isActive": "boolean",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

### Soft Delete Member (Deactivate)
- **Method:** `DELETE`
- **Endpoint:** `/members/:id`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response (200):**
```json
{
  "success": true,
  "message": "Member deleted successfully"
}
```

### Permanently Delete Member
- **Method:** `DELETE`
- **Endpoint:** `/members/:id/permanent`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response (200):**
```json
{
  "success": true,
  "message": "Member permanently deleted"
}
```

---

## 6. EVENT Routes

### Create Event
- **Method:** `POST`
- **Endpoint:** `/events`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body:**
```json
{
  "eventName": "string (required)",
  "date": "date (required, YYYY-MM-DD)",
  "time": "string (required, HH:mm format)"
}
```
- **Response (201):**
```json
{
  "success": true,
  "message": "Event created successfully",
  "data": {
    "_id": "string",
    "eventName": "string",
    "date": "date",
    "time": "string",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

### Get All Events
- **Method:** `GET`
- **Endpoint:** `/events`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Query Parameters:** None
- **Response (200):**
```json
{
  "success": true,
  "count": "number",
  "data": [
    {
      "_id": "string",
      "eventName": "string",
      "date": "date",
      "time": "string",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ]
}
```

### Get Event by ID
- **Method:** `GET`
- **Endpoint:** `/events/:id`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "string",
    "eventName": "string",
    "date": "date",
    "time": "string",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

### Update Event
- **Method:** `PUT`
- **Endpoint:** `/events/:id`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body:**
```json
{
  "eventName": "string (optional)",
  "date": "date (optional)",
  "time": "string (optional)"
}
```
- **Response (200):**
```json
{
  "success": true,
  "message": "Event updated successfully",
  "data": {
    "_id": "string",
    "eventName": "string",
    "date": "date",
    "time": "string",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

### Delete Event
- **Method:** `DELETE`
- **Endpoint:** `/events/:id`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response (200):**
```json
{
  "success": true,
  "message": "Event deleted successfully"
}
```

---

## Error Response Format

All endpoints follow this error response format on failure:

```json
{
  "success": false,
  "message": "Error message describing what went wrong",
  "error": "error_code (optional)"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Notes

1. All endpoints (except auth/register and auth/login) require `Authorization: Bearer <accessToken>` header
2. Date format: YYYY-MM-DD (e.g., 2026-02-26)
3. Time format: HH:mm (24-hour format, e.g., 14:30)
4. MongoDB IDs are 24-character hexadecimal strings
5. All timestamps are ISO 8601 format
6. Soft deletes (marking as inactive) are used for Members
7. Hard deletes (permanent removal) are available for Members via the `/permanent` endpoint
