const Member = require('../../../models/member.model');
const Family = require('../../../models/family.model');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const {
  sendTemporaryPasswordEmail,
  sendPasswordResetEmail
} = require('../../../lib/nodemailer');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} = require('../../../lib/jwt');

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_CODE_TTL_MS = 60 * 60 * 1000;

// Controller-local session/reset stores to avoid a separate token collection.
const refreshTokenStore = new Map(); // token -> { userId, expiresAt }
const userRefreshIndex = new Map(); // userId -> Set(token)
const passwordResetStore = new Map(); // userId -> { hashedCode, expiresAt }

const cleanupRefreshTokens = () => {
  const now = Date.now();
  for (const [token, payload] of refreshTokenStore.entries()) {
    if (payload.expiresAt <= now) {
      refreshTokenStore.delete(token);
      const tokens = userRefreshIndex.get(payload.userId);
      if (tokens) {
        tokens.delete(token);
        if (tokens.size === 0) userRefreshIndex.delete(payload.userId);
      }
    }
  }
};

const cleanupResetCodes = () => {
  const now = Date.now();
  for (const [userId, payload] of passwordResetStore.entries()) {
    if (payload.expiresAt <= now) {
      passwordResetStore.delete(userId);
    }
  }
};

const storeRefreshToken = (userId, token) => {
  cleanupRefreshTokens();
  const expiresAt = Date.now() + REFRESH_TTL_MS;
  refreshTokenStore.set(token, { userId: String(userId), expiresAt });

  if (!userRefreshIndex.has(String(userId))) {
    userRefreshIndex.set(String(userId), new Set());
  }
  userRefreshIndex.get(String(userId)).add(token);
};

const revokeRefreshToken = (token) => {
  const payload = refreshTokenStore.get(token);
  if (!payload) return;

  refreshTokenStore.delete(token);
  const tokens = userRefreshIndex.get(payload.userId);
  if (tokens) {
    tokens.delete(token);
    if (tokens.size === 0) userRefreshIndex.delete(payload.userId);
  }
};

const isRefreshTokenActive = (userId, token) => {
  cleanupRefreshTokens();
  const payload = refreshTokenStore.get(token);
  if (!payload) return false;
  return payload.userId === String(userId) && payload.expiresAt > Date.now();
};

const storeResetCode = (userId, hashedCode) => {
  cleanupResetCodes();
  passwordResetStore.set(String(userId), {
    hashedCode,
    expiresAt: Date.now() + RESET_CODE_TTL_MS
  });
};

const getResetCode = (userId) => {
  cleanupResetCodes();
  return passwordResetStore.get(String(userId));
};

const clearResetCode = (userId) => {
  passwordResetStore.delete(String(userId));
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

    const normalizedDob = dob || birthday;
    const normalizedRole = (role || 'MEMBER').toUpperCase();
    const hasIsActive = isActive !== undefined;
    const normalizedIsActive =
      typeof isActive === 'string' ? isActive.toLowerCase() === 'true' : Boolean(isActive);
    const normalizedDateOfDeath = dateOfDeath || null;

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

    if (email) {
      const existingMember = await Member.findOne({ email });
      if (existingMember) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
    }

    const fullName = lastName ? `${firstName} ${lastName}` : firstName;

    const member = new Member({
      churchId,
      divisionId,
      familyId,
      firstName,
      lastName,
      fullName,
      email,
      phone,
      houseNumber: normalizedHouseNumber,
      password: password || null,
      gender,
      dob: normalizedDob,
      marriageDate,
      maritalStatus,
      spouseId,
      role: normalizedRole,
      isFamilyHead: Boolean(isFamilyHead) || normalizedRole === 'FAMILY_HEAD',
      isActive: hasIsActive ? normalizedIsActive : !normalizedDateOfDeath,
      dateOfDeath: normalizedDateOfDeath,
      mustResetPassword: true,
      bloodGroup,
      profession
    });

    await member.save();

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

    if (houseNumber == null || !password || Number.isNaN(normalizedHouseNumber)) {
      return res.status(400).json({
        success: false,
        message: 'House number and password are required'
      });
    }

    const member = await Member.findOne({ houseNumber: normalizedHouseNumber });

    if (!member) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!member.password) {
      return res.status(403).json({
        success: false,
        message: 'Login is not enabled for this account yet. Please contact admin for a temporary password.'
      });
    }

    if (!member.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, member.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const payload = {
      id: member._id,
      role: member.role,
      churchId: member.churchId
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    storeRefreshToken(member._id, refreshToken);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TTL_MS
    });

    const memberObj = member.toObject();
    delete memberObj.password;

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
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (_error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    if (!isRefreshTokenActive(decoded.id, refreshToken)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    const payload = {
      id: decoded.id,
      role: decoded.role,
      churchId: decoded.churchId
    };

    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    revokeRefreshToken(refreshToken);
    storeRefreshToken(decoded.id, newRefreshToken);

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TTL_MS
    });

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
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    revokeRefreshToken(refreshToken);

    res.clearCookie('refreshToken');

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

    if (!oldPassword || !newPassword || newPassword.length < 6) {
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

    const isPasswordValid = await bcrypt.compare(oldPassword, member.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    member.password = newPassword;
    member.mustResetPassword = false;
    await member.save();

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

    if (!oldPassword || !newPassword || newPassword.length < 6) {
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

    const isPasswordValid = await bcrypt.compare(oldPassword, member.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    member.password = newPassword;
    member.mustResetPassword = false;
    await member.save();

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
    const { memberId } = req.params;
    const { newPassword } = req.body;
    const member = await Member.findById(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    member.password = newPassword;
    member.mustResetPassword = false;
    await member.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot password - send reset code by email
 * POST /forgot-password
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const member = await Member.findOne({ email: normalizedEmail });

    if (!member || !member.isActive) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent'
      });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = crypto
      .createHash('sha256')
      .update(resetCode)
      .digest('hex');

    storeResetCode(member._id, hashedCode);

    try {
      await sendPasswordResetEmail(
        member.email,
        resetCode,
        member.fullName || member.firstName
      );
    } catch (_emailError) {
      clearResetCode(member._id);
      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset email. Please try again later.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'A password reset code has been sent to your email.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password with code
 * POST /reset-password-with-code
 */
exports.resetPasswordWithCode = async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, code, and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const member = await Member.findOne({ email: String(email).trim().toLowerCase() });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const storedCode = getResetCode(member._id);
    if (!storedCode || storedCode.expiresAt <= Date.now()) {
      clearResetCode(member._id);
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    const hashedCode = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');

    if (hashedCode !== storedCode.hashedCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    member.password = newPassword;
    member.mustResetPassword = false;
    await member.save();

    clearResetCode(member._id);

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    next(error);
  }
};
