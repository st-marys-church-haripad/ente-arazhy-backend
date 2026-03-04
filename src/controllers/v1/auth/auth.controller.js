const Member = require('../../../models/member.model');
const Token = require('../../../models/token.model');
const bcrypt = require('bcrypt');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} = require('../../../lib/jwt');

// Register a new member
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
      role
    } = req.body;

    // Check if member already exists
    if (email) {
      const existingMember = await Member.findOne({ email });
      if (existingMember) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
    }

    // Create fullName
    const fullName = lastName ? `${firstName} ${lastName}` : firstName;

    // Create new member
    const member = new Member({
      churchId,
      divisionId,
      familyId,
      firstName,
      lastName,
      fullName,
      email,
      phone,
      password,
      gender,
      dob,
      role: role || 'MEMBER',
      mustResetPassword: true
    });

    await member.save();

    // Generate tokens
    const payload = {
      id: member._id,
      role: member.role,
      churchId: member.churchId
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Save refresh token
    await Token.create({ user: member._id, token: refreshToken });

    // Remove password from response
    const memberObj = member.toObject();
    delete memberObj.password;

    res.status(201).json({
      success: true,
      message: 'Member registered successfully',
      data: {
        member: memberObj,
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login
exports.login = async (req, res, next) => {
  try {
    const { houseNumber, password } = req.body;

    if (!houseNumber || !password) {
      return res.status(400).json({
        success: false,
        message: 'House number and password are required'
      });
    }

    // Find member by house number
    const member = await Member.findOne({ houseNumber });

    if (!member) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if member is active
    if (!member.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, member.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const payload = {
      id: member._id,
      role: member.role,
      churchId: member.churchId
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Save refresh token
    await Token.create({ user: member._id, token: refreshToken });

    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Remove password from response
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

// Refresh token
exports.refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Check if token exists in database
    const tokenDoc = await Token.findOne({ token: refreshToken, user: decoded.id });
    if (!tokenDoc) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const payload = {
      id: decoded.id,
      role: decoded.role,
      churchId: decoded.churchId
    };

    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    // Delete old refresh token and save new one
    await Token.deleteOne({ token: refreshToken });
    await Token.create({ user: decoded.id, token: newRefreshToken });

    // Set new refresh token as HTTP-only cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
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

// Logout
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Delete refresh token from database
    await Token.deleteOne({ token: refreshToken });

    // Clear cookie
    res.clearCookie('refreshToken');

    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
};

// Change password
exports.changePassword = async (req, res, next) => {
  try {
    const { memberId } = req.params;
    const { oldPassword, newPassword } = req.body;

    const member = await Member.findById(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Verify old password
    const isPasswordValid = await bcrypt.compare(oldPassword, member.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
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

// Reset password (for admin/vicar)
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

    // Update password
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

// Forgot password - send reset email
// exports.forgotPassword = async (req, res, next) => {
//   try {
//     const { email } = req.body;

//     if (!email) {
//       return res.status(400).json({
//         success: false,
//         message: 'Email is required'
//       });
//     }

//     // Find member by email
//     const member = await Member.findOne({ email: email.toLowerCase() });

//     // Always return success message to prevent email enumeration
//     if (!member) {
//       return res.status(200).json({
//         success: true,
//         message: 'If an account exists with this email, a password reset link has been sent'
//       });
//     }

//     // Check if member is active
//     if (!member.isActive) {
//       return res.status(200).json({
//         success: true,
//         message: 'If an account exists with this email, a password reset link has been sent'
//       });
//     }

//     // Generate reset token
//     const resetToken = crypto.randomBytes(32).toString('hex');
//     const hashedToken = crypto
//       .createHash('sha256')
//       .update(resetToken)
//       .digest('hex');

//     // Store hashed token in database with 1 hour expiry
//     const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
//     await Token.create({
//       user: member._id,
//       token: hashedToken,
//       type: 'passwordReset',
//       expiresAt
//     });

//     // Send email with reset token (not hashed)
//     try {
//       await sendPasswordResetEmail(
//         member.email,
//         resetToken,
//         member.fullName || member.firstName
//       );
//     } catch (emailError) {
//       console.error('Failed to send password reset email:', emailError);
//       // Delete the token if email failed
//       await Token.deleteOne({ token: hashedToken });
//       return res.status(500).json({
//         success: false,
//         message: 'Failed to send password reset email. Please try again later.'
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: 'Password reset link has been sent to your email'
//     });
//   } catch (error) {
//     next(error);
//   }
// };

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
