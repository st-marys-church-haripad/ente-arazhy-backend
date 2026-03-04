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
transporter.verify((error, success) => {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

/**
 * Send password reset email
 * @param {string} to - Recipient email address
 * @param {string} resetToken - Password reset token
 * @param {string} userName - User's name
 */
const sendPasswordResetEmail = async (to, resetToken, userName) => {
  try {
    // You can customize this URL to match your frontend
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: `"Ente Arazhy" <${config.EMAIL_FROM}>`,
      to: to,
      subject: 'Password Reset Request',
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
            .button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #4CAF50;
              color: white !important;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 12px;
              color: #666;
            }
            .token-box {
              background-color: #e8f5e9;
              padding: 15px;
              border-left: 4px solid #4CAF50;
              margin: 20px 0;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              
              <p>We received a request to reset your password for your Ente Arazhy account. If you didn't make this request, you can safely ignore this email.</p>
              
              <p>To reset your password, click the button below:</p>
              
              <center>
                <a href="${resetUrl}" class="button">Reset Password</a>
              </center>
              
              <p>Or copy and paste this link into your browser:</p>
              <div class="token-box">
                ${resetUrl}
              </div>
              
              <p><strong>This link will expire in 1 hour.</strong></p>
              
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
        
        To reset your password, visit this link:
        ${resetUrl}
        
        This link will expire in 1 hour.
        
        If you did not request a password reset, please ignore this email.
        
        © ${new Date().getFullYear()} Ente Arazhy. All rights reserved.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

module.exports = {
  transporter,
  sendPasswordResetEmail
};
