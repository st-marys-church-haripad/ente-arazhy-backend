const Member = require('../../../models/member.model');
const Token = require('../../../models/token.model');
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

    /* Check if member already exists */
    if (email) {
      const existingMember = await Member.findOne({ email });
      if (existingMember) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
    }

    // const existingHouseNumberMember = await Member.findOne({
    //   houseNumber: normalizedHouseNumber
    // });

    // if (existingHouseNumberMember) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'House number already registered'
    //   });
    // }

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
    if (houseNumber == null || !password || Number.isNaN(normalizedHouseNumber)) {
      return res.status(400).json({
        success: false,
        message: 'House number and password are required'
      });
    }

    /* Lookup member by house number */
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
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    /* Generate JWT tokens */
    const payload = {
      id: member._id,
      role: member.role,
      churchId: member.churchId
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    /* Store refresh token in database */
    await Token.create({ user: member._id, token: refreshToken });

    /* Set secure HTTP-only cookie with refresh token */
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 /* 7 days */
    });

    /* Exclude password from response */
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
    const tokenDoc = await Token.findOne({ token: refreshToken, user: decoded.id });
    if (!tokenDoc) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    /* Generate new token pair */
    const payload = {
      id: decoded.id,
      role: decoded.role,
      churchId: decoded.churchId
    };

    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    /* Rotate refresh token: delete old, save new */
    await Token.deleteOne({ token: refreshToken });
    await Token.create({ user: decoded.id, token: newRefreshToken });

    /* Set new refresh token as secure HTTP-only cookie */
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 /* 7 days */
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

    /* Revoke refresh token from database */
    await Token.deleteOne({ token: refreshToken });

    /* Clear refresh token cookie */
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

    /* Validate current password */
    const isPasswordValid = await bcrypt.compare(oldPassword, member.password);
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

    /* Update password (pre-save hook will hash it) */
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
 * Forgot password - send reset email
 * POST /forgot-password
 */
// exports.forgotPassword = async (req, res, next) => {
//   try {
//     const { email } = req.body;

//     if (!email) {
//       return res.status(400).json({
//         success: false,
//         message: 'Email is required'
//       });
//     }

//     const normalizedEmail = String(email).trim().toLowerCase();

//     // Always return success message to prevent email enumeration.
//     const genericSuccess = {
//       success: true,
//       message: 'If an account exists with this email, a password reset link has been sent'
//     };

//     const member = await Member.findOne({ email: normalizedEmail });

//     if (!member || !member.isActive) {
//       return res.status(200).json(genericSuccess);
//     }

//     const resetToken = crypto.randomBytes(32).toString('hex');
//     const hashedToken = crypto
//       .createHash('sha256')
//       .update(resetToken)
//       .digest('hex');

//     const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

//     await Token.create({
//       user: member._id,
//       token: hashedToken,
//       type: 'passwordReset',
//       expiresAt
//     });

//     try {
//       await sendPasswordResetEmail(
//         member.email,
//         resetToken,
//         member.fullName || member.firstName
//       );
//     } catch (_emailError) {
//       await Token.deleteOne({ token: hashedToken, type: 'passwordReset' });
//       return res.status(500).json({
//         success: false,
//         message: 'Failed to send password reset email. Please try again later.'
//       });
//     }

//     return res.status(200).json(genericSuccess);
//   } catch (error) {
//     next(error);
//   }
// };

// Forgot password - send reset email
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find member by email
    const member = await Member.findOne({ email: email.toLowerCase() });

    // Always return success message to prevent email enumeration
    if (!member) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent'
      });
    }

    // Check if member is active
    if (!member.isActive) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent'
      });
    }

    // Generate a 6-digit numeric code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = crypto
      .createHash('sha256')
      .update(resetCode)
      .digest('hex');

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
      // Delete the token if email failed
      await Token.deleteOne({ token: hashedCode });
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

// // Reset password with token
// exports.resetPasswordWithToken = async (req, res, next) => {
//   try {
//     const { token, newPassword } = req.body;

//     if (!token || !newPassword) {
//       return res.status(400).json({
//         success: false,
//         message: 'Token and new password are required'
//       });
//     }

//     // Validate password strength
//     if (newPassword.length < 6) {
//       return res.status(400).json({
//         success: false,
//         message: 'Password must be at least 6 characters long'
//       });
//     }

//     // Hash the token to compare with stored hash
//     const hashedToken = crypto
//       .createHash('sha256')
//       .update(token)
//       .digest('hex');

//     // Find token in database
//     const tokenDoc = await Token.findOne({
//       token: hashedToken,
//       type: 'passwordReset',
//       expiresAt: { $gt: new Date() }
//     });

//     if (!tokenDoc) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid or expired reset token'
//       });
//     }

//     // Find member and update password
//     const member = await Member.findById(tokenDoc.user);
//     if (!member) {
//       return res.status(404).json({
//         success: false,
//         message: 'Member not found'
//       });
//     }

//     // Update password
//     member.password = newPassword;
//     member.mustResetPassword = false;
//     await member.save();

//     // Delete the used token
//     await Token.deleteOne({ _id: tokenDoc._id });

//     // Optionally, delete all other password reset tokens for this user
//     await Token.deleteMany({
//       user: member._id,
//       type: 'passwordReset'
//     });

//     res.status(200).json({
//       success: true,
//       message: 'Password has been reset successfully. You can now login with your new password.'
//     });
//   } catch (error) {
//     next(error);
//   }
// };
