const nodemailer = require('nodemailer');
const config = require('../config');

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: config.EMAIL_HOST,
  port: config.EMAIL_PORT,
  secure: config.EMAIL_PORT === 465, // true for 465, false for other ports
  auth: {
    user: config.EMAIL_USER,
    pass: config.EMAIL_PASSWORD
  }
});

// Verify transporter configuration
transporter.verify((_error, _success) => {
});

/**
 * Send password reset email
 * @param {string} to - Recipient email address
 * @param {string} resetToken - Password reset token
 * @param {string} userName - User's name
 */
const sendPasswordResetEmail = async (to, resetToken, userName) => {
  try {
    const mailOptions = {
      from: `"Ente Arazhy" <${config.EMAIL_FROM}>`,
      to: to,
      subject: 'Password Reset Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #4CAF50;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: #f9f9f9;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .code-box {
              background-color: #e8f5e9;
              padding: 15px;
              border-left: 4px solid #4CAF50;
              margin: 20px 0;
              font-size: 1.5em;
              letter-spacing: 4px;
              text-align: center;
              font-weight: bold;
            }
            .footer {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Code</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>We received a request to reset your password for your Ente Arazhy account. If you didn't make this request, you can safely ignore this email.</p>
              <p>Use the following code to reset your password. This code will expire in 1 hour.</p>
              <div class="code-box">
                ${resetToken}
              </div>
              <div class="footer">
                <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
                <p>&copy; ${new Date().getFullYear()} Ente Arazhy. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hello ${userName},
        
        We received a request to reset your password for your Ente Arazhy account.
        
        Use the following code to reset your password (valid for 1 hour):
        ${resetToken}
        
        If you did not request a password reset, please ignore this email.
        
        © ${new Date().getFullYear()} Ente Arazhy. All rights reserved.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    throw error;
  }
};

/**
 * Send onboarding email with a temporary password
 * @param {string} to - Recipient email address
 * @param {string} temporaryPassword - Generated temporary password
 * @param {string} userName - User's name
 * @param {number} houseNumber - Login identifier
 */
const sendTemporaryPasswordEmail = async (to, temporaryPassword, userName, houseNumber) => {
  const mailOptions = {
    from: `"Ente Arazhy" <${config.EMAIL_FROM}>`,
    to,
    subject: 'Your Account Is Ready - Temporary Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1f6f8b; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .box { background-color: #e7f3f8; border-left: 4px solid #1f6f8b; padding: 14px; margin: 16px 0; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Welcome to Ente Arazhy</h2>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>Your account has been created successfully as Family Head.</p>
            <div class="box">
              <p><strong>Login House Number:</strong> ${houseNumber}</p>
              <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
            </div>
            <p>Please login using these credentials and change your password immediately.</p>
            <p>Your account is configured to require password reset on first login.</p>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Ente Arazhy. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hello ${userName},

Your account has been created successfully as Family Head.

Login House Number: ${houseNumber}
Temporary Password: ${temporaryPassword}

Please login and change your password immediately.
Your account requires password reset on first login.

© ${new Date().getFullYear()} Ente Arazhy. All rights reserved.
    `
  };

  const info = await transporter.sendMail(mailOptions);
  return { success: true, messageId: info.messageId };
};

module.exports = {
  transporter,
  sendPasswordResetEmail,
  sendTemporaryPasswordEmail
};
