const Member = require('../../../models/member.model');
const Token = require('../../../models/token.model');
const Family = require('../../../models/family.model');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const config = require('../../../config');
const {
  sendTemporaryPasswordEmail,
  sendPasswordResetEmail
} = require('../../../lib/nodemailer');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} = require('../../../lib/jwt');

/* ========== Helpers ========== */

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const MAX_RESET_ATTEMPTS = 5;
const RESET_COOLDOWN_MS = 60 * 1000;

const COOKIE_BASE = {
  httpOnly: true,
  secure: config.NODE_ENV !== 'development',
  sameSite: 'strict'
};
const REFRESH_COOKIE_OPTIONS = { ...COOKIE_BASE, maxAge: 7 * 24 * 60 * 60 * 1000 }; /* 7 days */

/* Keeps login timing similar when a house number does not exist */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const isStr = (value) => typeof value === 'string';
const isAdminOrVicar = (user) => user?.role === 'ADMIN' || user?.role === 'VICAR';
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const isValidNewPassword = (password) =>
  isStr(password) && password.length >= 6 && password.length <= 72;

/* Matches a stored refresh token (hashed, or plain text from before this update) */
const tokenMatch = (token) => ({ $in: [hashToken(token), token] });

const revokeRefreshTokens = (userId, keepToken) => {
  const filter = { user: userId, type: 'refresh' };
  if (keepToken) filter.token = { $nin: [hashToken(keepToken), keepToken] };
  return Token.deleteMany(filter);
};

const unlinkSpouseIfLinkedToMember = async (spouseId, memberId) => {
  if (!spouseId) return;

  await Member.updateOne(
    { _id: spouseId, spouseId: memberId },
    { $unset: { spouseId: 1 } }
  );
};

/**
 * Register a new member
 * POST /register
 */
exports.register = async (req, res, next) => {
  try {
    const {
      churchId,
      divisionId,
      familyId,
      firstName,
      lastName,
      email,
      phone,
      password,
      gender,
      dob,
      birthday,
      houseNumber,
      userName,
      spouseId,
      isFamilyHead,
      role,
      marriageDate,
      maritalStatus,
      isActive,
      dateOfDeath,
      bloodGroup,
      profession
    } = req.body;

    const normalizedHouseNumber = Number(
      houseNumber != null ? houseNumber : userName
    );

    if (Number.isNaN(normalizedHouseNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Valid house number is required'
      });
    }

    if ((email != null && !isStr(email)) || (password != null && !isStr(password))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password format'
      });
    }

    /* Only admin/vicar can choose roles or flags; everyone else is always a plain MEMBER */
    const privileged = isAdminOrVicar(req.user);
    const normalizedRole = privileged && isStr(role) ? role.toUpperCase() : 'MEMBER';

    if (normalizedRole === 'ADMIN' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only an admin can create an admin account'
      });
    }

    const normalizedDob = dob || birthday;
    const hasIsActive = privileged && isActive !== undefined;
    const normalizedIsActive =
      typeof isActive === 'string' ? isActive.toLowerCase() === 'true' : Boolean(isActive);
    const normalizedDateOfDeath = dateOfDeath || null;
    const normalizedEmail = isStr(email) ? email.trim().toLowerCase() : email;

    let spouse = null;
    if (spouseId) {
      spouse = await Member.findById(spouseId).select('_id spouseId');
      if (!spouse) {
        return res.status(400).json({
          success: false,
          message: 'Invalid spouseId: spouse member not found'
        });
      }
    }

    /* Check if member already exists */
    if (normalizedEmail) {
      const existingMember = await Member.exists({ email: normalizedEmail });
      if (existingMember) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
    }

    /* Construct full name */
    const fullName = lastName ? `${firstName} ${lastName}` : firstName;

    /* Create new member document */
    const member = new Member({
      churchId,
      divisionId,
      familyId,
      firstName,
      lastName,
      fullName,
      email: normalizedEmail,
      phone,
      houseNumber: normalizedHouseNumber,
      password: password || null,
      gender,
      dob: normalizedDob,
      marriageDate,
      maritalStatus,
      spouseId,
      role: normalizedRole,
      isFamilyHead: (privileged && Boolean(isFamilyHead)) || normalizedRole === 'FAMILY_HEAD',
      isActive: hasIsActive ? normalizedIsActive : !normalizedDateOfDeath,
      dateOfDeath: normalizedDateOfDeath,
      mustResetPassword: true,
      bloodGroup,
      profession
    });

    await member.save();

    // Map this member to the family's memberIds array if familyId is provided
    if (familyId) {
      await Family.findByIdAndUpdate(
        familyId,
        { $addToSet: { memberIds: member._id } },
        { new: true }
      );
    }

    if (spouse) {
      if (spouse.spouseId && spouse.spouseId.toString() !== member._id.toString()) {
        await unlinkSpouseIfLinkedToMember(spouse.spouseId, spouse._id);
      }

      await Member.findByIdAndUpdate(spouse._id, { spouseId: member._id });
    }

    /* Exclude password from response */
    const memberObj = member.toObject();
    delete memberObj.password;

    res.status(201).json({
      success: true,
      message: 'Member registered successfully',
      data: {
        member: memberObj
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login member and issue JWT tokens
 * POST /login
 */
exports.login = async (req, res, next) => {
  try {
    const { houseNumber, password } = req.body;
    const normalizedHouseNumber = Number(houseNumber);

    /* Check for null/undefined explicitly (0 is valid for admin) */
    if (houseNumber == null || !isStr(password) || !password || Number.isNaN(normalizedHouseNumber)) {
      return res.status(400).json({
        success: false,
        message: 'House number and password are required'
      });
    }

    /* Lookup member by house number (family head first, so the result is always the same member) */
    const member = await Member.findOne({ houseNumber: normalizedHouseNumber })
      .sort({ isFamilyHead: -1, _id: 1 })
      .select('+failedLoginAttempts +lockUntil')
      .lean();

    if (!member) {
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (member.lockUntil && new Date(member.lockUntil) > new Date()) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please try again in a few minutes.'
      });
    }

    if (!member.password) {
      return res.status(403).json({
        success: false,
        message: 'Login is not enabled for this account yet. Please contact admin for a temporary password.'
      });
    }

    /* Verify member is active */
    if (!member.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    /* Validate password */
    const isPasswordValid = await bcrypt.compare(password, member.password);

    if (!isPasswordValid) {
      const attempts = (member.failedLoginAttempts || 0) + 1;
      await Member.updateOne(
        { _id: member._id },
        attempts >= MAX_FAILED_LOGINS
          ? { $set: { failedLoginAttempts: 0, lockUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) } }
          : { $inc: { failedLoginAttempts: 1 } }
      );

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (member.failedLoginAttempts || member.lockUntil) {
      await Member.updateOne(
        { _id: member._id },
        { $unset: { failedLoginAttempts: 1, lockUntil: 1 } }
      );
    }

    /* Generate JWT tokens */
    const payload = {
      id: member._id,
      role: member.role,
      churchId: member.churchId
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    /* Store refresh token (hashed) in database */
    await Token.create({ user: member._id, token: hashToken(refreshToken) });

    /* Set secure HTTP-only cookie with refresh token */
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

    const memberObj = await Member.populate(member, {
      path: 'familyId',
      populate: {
        path: 'memberIds',
        select:
          'firstName lastName fullName gender dob marriageDate maritalStatus spouseId isFamilyHead isActive dateOfDeath',
      },
    });

    /* Exclude sensitive fields from response */
    delete memberObj.password;
    delete memberObj.failedLoginAttempts;
    delete memberObj.lockUntil;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        member: memberObj,
        accessToken,
        mustResetPassword: member.mustResetPassword
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token using refresh token
 * POST /refresh
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken || !isStr(refreshToken)) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    /* Validate refresh token signature */
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    /* Verify token exists in database */
    const tokenDoc = await Token.findOne({
      user: decoded.id,
      type: 'refresh',
      token: tokenMatch(refreshToken)
    });
    if (!tokenDoc) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    /* Use the member's current role and status, not what the old token says */
    const member = await Member.findById(decoded.id).select('role churchId isActive').lean();
    if (!member || !member.isActive) {
      await revokeRefreshTokens(decoded.id);
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    /* Generate new token pair */
    const payload = {
      id: decoded.id,
      role: member.role,
      churchId: member.churchId
    };

    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    /* Rotate refresh token: delete old, save new */
    await Token.deleteOne({ _id: tokenDoc._id });
    await Token.create({ user: decoded.id, token: hashToken(newRefreshToken) });

    /* Set new refresh token as secure HTTP-only cookie */
    res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout member and invalidate refresh token
 * POST /logout
 */
exports.logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken || !isStr(refreshToken)) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    /* Revoke refresh token from database */
    await Token.deleteOne({ type: 'refresh', token: tokenMatch(refreshToken) });

    /* Clear refresh token cookie */
    res.clearCookie('refreshToken', COOKIE_BASE);

    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change password for authenticated member
 * POST /change-password/:memberId
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { memberId } = req.params;
    const { oldPassword, newPassword } = req.body;

    if (!isStr(oldPassword) || !oldPassword || !isValidNewPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Old password and a new password (minimum 6 characters) are required'
      });
    }

    const isSameUser = String(req.userId) === String(memberId);
    const canManageOthers = req.user?.role === 'ADMIN' || req.user?.role === 'VICAR';

    if (!isSameUser && !canManageOthers) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to change this password'
      });
    }

    const member = await Member.findById(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    /* Only an admin can change an admin's password */
    if (!isSameUser && member.role === 'ADMIN' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to change this password'
      });
    }

    /* Validate current password */
    const isPasswordValid = member.password
      ? await bcrypt.compare(oldPassword, member.password)
      : false;
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    /* Update password (pre-save hook will hash it) */
    member.password = newPassword;
    member.mustResetPassword = false;
    await member.save();

    /* Sign out other sessions (keep the caller's own session) */
    await revokeRefreshTokens(member._id, isSameUser ? req.cookies?.refreshToken : null);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change password for the currently authenticated member
 * POST /change-password-me
 */
exports.changePasswordMe = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!isStr(oldPassword) || !oldPassword || !isValidNewPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Old password and a new password (minimum 6 characters) are required'
      });
    }

    const member = await Member.findById(req.userId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const isPasswordValid = member.password
      ? await bcrypt.compare(oldPassword, member.password)
      : false;
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    member.password = newPassword;
    member.mustResetPassword = false;
    await member.save();

    /* Sign out other sessions (keep this one) */
    await revokeRefreshTokens(member._id, req.cookies?.refreshToken);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send temporary passwords to family heads (max 10 per request)
 * POST /family-heads/send-temporary-passwords
 */
exports.sendFamilyHeadTemporaryPasswords = async (req, res, next) => {
  try {
    if (!isAdminOrVicar(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { memberIds } = req.body;

    if (memberIds !== undefined && !Array.isArray(memberIds)) {
      return res.status(400).json({
        success: false,
        message: 'memberIds must be an array'
      });
    }

    if (Array.isArray(memberIds) && memberIds.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'A maximum of 10 members can be processed per request'
      });
    }

    if (Array.isArray(memberIds) && !memberIds.every((id) => isStr(id) && mongoose.isValidObjectId(id))) {
      return res.status(400).json({
        success: false,
        message: 'memberIds must contain valid member IDs'
      });
    }

    const query = {
      isFamilyHead: true,
      isActive: true,
      email: { $exists: true, $nin: [null, ''] }
    };

    if (Array.isArray(memberIds) && memberIds.length > 0) {
      query._id = { $in: memberIds };
    }

    const fetchLimit = Array.isArray(memberIds) && memberIds.length > 0
      ? memberIds.length
      : 10;

    const members = await Member.find(query).limit(fetchLimit);

    if (!members.length) {
      return res.status(404).json({
        success: false,
        message: 'No eligible family heads found'
      });
    }

    const sent = [];
    const failed = [];

    for (const member of members) {
      const previousPasswordHash = member.password;
      const previousMustReset = member.mustResetPassword;
      const temporaryPassword = `Ea${crypto.randomBytes(4).toString('hex')}!9`;

      member.password = temporaryPassword;
      member.mustResetPassword = true;
      await member.save();

      try {
        await sendTemporaryPasswordEmail(
          member.email,
          temporaryPassword,
          member.fullName || member.firstName,
          member.houseNumber
        );

        /* The old password no longer works, so end old sessions too */
        await revokeRefreshTokens(member._id);

        sent.push({
          memberId: member._id,
          email: member.email,
          houseNumber: member.houseNumber
        });
      } catch (_error) {
        await Member.updateOne(
          { _id: member._id },
          {
            $set: {
              password: previousPasswordHash,
              mustResetPassword: previousMustReset
            }
          }
        );

        failed.push({
          memberId: member._id,
          email: member.email
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: failed.length
        ? 'Temporary passwords sent with partial failures'
        : 'Temporary passwords sent successfully',
      data: {
        processed: members.length,
        sentCount: sent.length,
        failedCount: failed.length,
        sent,
        failed
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password for a member (admin/vicar only)
 * POST /reset-password/:memberId
 */
exports.resetPassword = async (req, res, next) => {
  try {
    if (!isAdminOrVicar(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { memberId } = req.params;
    const { newPassword } = req.body;

    if (!isValidNewPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'A new password (minimum 6 characters) is required'
      });
    }

    const member = await Member.findById(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    /* Only an admin can reset an admin's password */
    if (member.role === 'ADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only an admin can reset an admin password'
      });
    }

    /* Update password (pre-save hook will hash it) */
    member.password = newPassword;
    member.mustResetPassword = false;
    await member.save();

    await revokeRefreshTokens(member._id);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Forgot password - send reset email
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !isStr(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    /* Same answer whether or not the account exists, to prevent email enumeration */
    const genericSuccess = {
      success: true,
      message: 'If an account exists with this email, a password reset code has been sent'
    };

    const member = await Member.findOne({ email: email.trim().toLowerCase() })
      .select('email fullName firstName isActive')
      .lean();

    if (!member || !member.isActive) {
      return res.status(200).json(genericSuccess);
    }

    /* One code per minute per account (stops email flooding) */
    const recentToken = await Token.exists({
      user: member._id,
      type: 'passwordReset',
      createdAt: { $gt: new Date(Date.now() - RESET_COOLDOWN_MS) }
    });
    if (recentToken) {
      return res.status(200).json(genericSuccess);
    }

    /* Only the newest code is valid */
    await Token.deleteMany({ user: member._id, type: 'passwordReset' });

    // Generate a 6-digit numeric code (cryptographically secure)
    const resetCode = crypto.randomInt(100000, 1000000).toString();
    const hashedCode = hashToken(resetCode);

    // Store hashed code in database with 1 hour expiry
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await Token.create({
      user: member._id,
      token: hashedCode,
      type: 'passwordReset',
      expiresAt
    });

    // Send email with the code (not hashed)
    try {
      await sendPasswordResetEmail(
        member.email,
        resetCode, // send the code, not a link
        member.fullName || member.firstName
      );
    } catch (emailError) {
      console.error('Password reset email failed:', emailError.message);
      // Delete the token if email failed
      await Token.deleteOne({ token: hashedCode, type: 'passwordReset' });
      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset email. Please try again later.'
      });
    }

    res.status(200).json(genericSuccess);
  } catch (error) {
    next(error);
  }
};


// Reset password with code
exports.resetPasswordWithCode = async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!isStr(email) || !isStr(code) || !email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, code, and new password are required'
      });
    }

    if (!isValidNewPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be between 6 and 72 characters long'
      });
    }

    const invalidCode = () =>
      res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code'
      });

    const member = await Member.findOne({ email: email.trim().toLowerCase() });
    if (!member || !member.isActive) {
      return invalidCode();
    }

    /* Check only the newest unexpired code for this account */
    const tokenDoc = await Token.findOne({
      user: member._id,
      type: 'passwordReset',
      expiresAt: { $gt: new Date() }
    }).sort({ _id: -1 });

    if (!tokenDoc || (tokenDoc.attempts || 0) >= MAX_RESET_ATTEMPTS) {
      return invalidCode();
    }

    const givenHash = Buffer.from(hashToken(code.trim()), 'hex');
    const storedHash = Buffer.from(tokenDoc.token, 'hex');
    const isMatch =
      givenHash.length === storedHash.length && crypto.timingSafeEqual(givenHash, storedHash);

    if (!isMatch) {
      await Token.updateOne({ _id: tokenDoc._id }, { $inc: { attempts: 1 } });
      return invalidCode();
    }

    // Update password
    member.password = newPassword;
    member.mustResetPassword = false;
    await member.save();

    // Delete all reset codes and sign out every session
    await Token.deleteMany({ user: member._id, type: 'passwordReset' });
    await revokeRefreshTokens(member._id);

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    next(error);
  }
};