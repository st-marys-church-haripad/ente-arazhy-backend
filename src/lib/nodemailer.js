
const nodemailer = require('nodemailer');
const config = require('../config');

// Ente Arazhy brand colours
const COLORS = {
  primary: '#7CC957',
  primaryDark: '#5DA83D',
  background: '#F1F5EC',
  card: '#FFFFFF',
  text: '#253244',
  muted: '#647084',
  border: '#E2E8DF',
  softGreen: '#EAF5E2',
};

// Create reusable transporter
const emailPort = Number(config.EMAIL_PORT);

const transporter = nodemailer.createTransport({
  host: config.EMAIL_HOST,
  port: emailPort,
  secure: emailPort === 465,
  requireTLS: emailPort === 587, // never fall back to unencrypted SMTP
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
  auth: {
    user: config.EMAIL_USER,
    pass: config.EMAIL_PASSWORD,
  },
});

// Verify SMTP configuration locally only (on Cloud Functions it would add an
// SMTP round trip to every cold start)
if (!process.env.K_SERVICE && !process.env.FUNCTION_TARGET) {
  transporter.verify((error) => {
    if (error) {
      console.error('Email transporter verification failed:', error.message);
    } else {
      console.log('Email transporter is ready');
    }
  });
}

// Escape dynamic values before inserting them into HTML
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (character) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[character];
  });

// Shared email layout matching the mobile app
const createEmailTemplate = ({
  preheader,
  title,
  subtitle,
  content,
  footer = 'St. Mary’s Orthodox Church, Haripad',
}) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(title)}</title>
</head>

<body style="
  margin: 0;
  padding: 0;
  background-color: ${COLORS.background};
  font-family: Arial, Helvetica, sans-serif;
  color: ${COLORS.text};
  -webkit-text-size-adjust: 100%;
">

  <!-- Hidden inbox preview -->
  <div style="
    display: none;
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    color: transparent;
  ">
    ${escapeHtml(preheader)}
  </div>

  <table role="presentation" width="100%" cellpadding="0"
    cellspacing="0" border="0"
    style="background-color: ${COLORS.background};">
    <tr>
      <td align="center" style="padding: 32px 14px;">

        <table role="presentation" width="100%" cellpadding="0"
          cellspacing="0" border="0"
          style="max-width: 600px;">

          <!-- Brand header -->
          <tr>
            <td align="center" style="padding: 8px 12px 26px;">
              <table role="presentation" cellpadding="0"
                cellspacing="0" border="0">
                <tr>
                  <td align="center" valign="middle"
                    width="44" height="44"
                    style="
                      width: 44px;
                      height: 44px;
                      background-color: ${COLORS.primary};
                      border-radius: 14px;
                      color: #FFFFFF;
                      font-size: 24px;
                      font-weight: bold;
                    ">
                    E
                  </td>
                  <td style="padding-left: 12px;">
                    <div style="
                      font-size: 22px;
                      font-weight: bold;
                      color: ${COLORS.text};
                      letter-spacing: -0.5px;
                    ">
                      Ente Arazhy
                    </div>
                    <div style="
                      margin-top: 4px;
                      font-size: 12px;
                      color: ${COLORS.muted};
                    ">
                      Your church community
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="
              background-color: ${COLORS.card};
              border: 1px solid ${COLORS.border};
              border-radius: 24px;
              overflow: hidden;
            ">

              <!-- Green banner -->
              <table role="presentation" width="100%" cellpadding="0"
                cellspacing="0" border="0">
                <tr>
                  <td style="
                    background-color: ${COLORS.primary};
                    padding: 28px 26px;
                  ">
                    <div style="
                      color: #FFFFFF;
                      font-size: 12px;
                      font-weight: bold;
                      letter-spacing: 1.5px;
                      text-transform: uppercase;
                    ">
                      ENTE ARAZHY
                    </div>

                    <h1 style="
                      margin: 12px 0 0;
                      color: #FFFFFF;
                      font-size: 27px;
                      line-height: 1.3;
                      font-weight: bold;
                    ">
                      ${escapeHtml(title)}
                    </h1>

                    <p style="
                      margin: 10px 0 0;
                      color: #FFFFFF;
                      font-size: 15px;
                      line-height: 1.7;
                    ">
                      ${escapeHtml(subtitle)}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Email body -->
              <table role="presentation" width="100%" cellpadding="0"
                cellspacing="0" border="0">
                <tr>
                  <td style="
                    padding: 30px 26px;
                    font-size: 15px;
                    line-height: 1.8;
                    color: ${COLORS.text};
                  ">
                    ${content}
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 12px 8px;">
              <p style="
                margin: 0;
                font-size: 13px;
                line-height: 1.7;
                color: ${COLORS.muted};
              ">
                Made for our church community
              </p>

              <p style="
                margin: 8px 0 0;
                font-size: 12px;
                line-height: 1.7;
                color: ${COLORS.muted};
              ">
                ${escapeHtml(footer)}
              </p>

              <p style="
                margin: 8px 0 0;
                font-size: 11px;
                color: ${COLORS.muted};
              ">
                &copy; ${new Date().getFullYear()} Ente Arazhy.
                All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/**
 * Send password reset email.
 * @param {string} to - Recipient email address
 * @param {string} resetToken - Password reset code
 * @param {string} userName - Recipient's name
 */
const sendPasswordResetEmail = async (to, resetToken, userName) => {
  const safeName = escapeHtml(userName);
  const safeToken = escapeHtml(resetToken);

  const content = `
    <p style="margin: 0 0 18px;">
      Hello <strong>${safeName}</strong>,
    </p>

    <p style="margin: 0 0 18px; color: ${COLORS.muted};">
      We received a request to reset the password for your
      Ente Arazhy account. Use the code below to continue.
    </p>

    <table role="presentation" width="100%" cellpadding="0"
      cellspacing="0" border="0"
      style="
        background-color: ${COLORS.softGreen};
        border: 1px solid ${COLORS.border};
        border-radius: 16px;
      ">
      <tr>
        <td align="center" style="padding: 24px 16px;">
          <p style="
            margin: 0 0 12px;
            font-size: 12px;
            font-weight: bold;
            color: ${COLORS.muted};
            letter-spacing: 1.2px;
            text-transform: uppercase;
          ">
            Password reset code
          </p>

          <div style="
            font-size: 30px;
            line-height: 1.4;
            font-weight: bold;
            letter-spacing: 5px;
            color: ${COLORS.text};
            overflow-wrap: anywhere;
          ">
            ${safeToken}
          </div>

          <p style="
            margin: 12px 0 0;
            font-size: 13px;
            color: ${COLORS.muted};
          ">
            This code expires in 1 hour.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin: 22px 0 0; color: ${COLORS.muted};">
      If you did not request a password reset, you can ignore
      this email. Never share your reset code with anyone.
    </p>
  `;

  const html = createEmailTemplate({
    preheader: 'Your Ente Arazhy password reset code.',
    title: 'Reset your password',
    subtitle: 'Let’s help you get back into your account.',
    content,
  });

  const text = `
Hello ${userName},

We received a request to reset your Ente Arazhy password.

Your password reset code is: ${resetToken}

This code expires in 1 hour. Never share it with anyone.

If you did not request a reset, you can ignore this email.

© ${new Date().getFullYear()} Ente Arazhy.
  `.trim();

  const info = await transporter.sendMail({
    from: `"Ente Arazhy" <${config.EMAIL_FROM}>`,
    to,
    subject: 'Reset your Ente Arazhy password',
    html,
    text,
  });

  return { success: true, messageId: info.messageId };
};

/**
 * Send onboarding email with a temporary password.
 * @param {string} to - Recipient email address
 * @param {string} temporaryPassword - Temporary password
 * @param {string} userName - Recipient's name
 * @param {number|string} houseNumber - Login house number
 */
const sendTemporaryPasswordEmail = async (
  to,
  temporaryPassword,
  userName,
  houseNumber
) => {
  const safeName = escapeHtml(userName);
  const safeHouseNumber = escapeHtml(houseNumber);
  const safePassword = escapeHtml(temporaryPassword);

  const content = `
    <p style="margin: 0 0 18px;">
      Welcome, <strong>${safeName}</strong>!
    </p>

    <p style="margin: 0 0 22px; color: ${COLORS.muted};">
      Your Ente Arazhy account has been created successfully
      as Family Head. Use the credentials below to sign in.
    </p>

    <table role="presentation" width="100%" cellpadding="0"
      cellspacing="0" border="0"
      style="
        background-color: ${COLORS.softGreen};
        border: 1px solid ${COLORS.border};
        border-radius: 16px;
      ">
      <tr>
        <td style="padding: 22px 20px;">
          <p style="
            margin: 0 0 6px;
            font-size: 12px;
            color: ${COLORS.muted};
            font-weight: bold;
            letter-spacing: 1px;
            text-transform: uppercase;
          ">
            Your login details
          </p>

          <p style="
            margin: 18px 0 6px;
            font-size: 13px;
            color: ${COLORS.muted};
          ">
            Login house number
          </p>

          <p style="
            margin: 0;
            font-size: 21px;
            font-weight: bold;
            color: ${COLORS.text};
          ">
            ${safeHouseNumber}
          </p>

          <div style="
            margin: 20px 0;
            border-top: 1px solid ${COLORS.border};
          "></div>

          <p style="
            margin: 0 0 6px;
            font-size: 13px;
            color: ${COLORS.muted};
          ">
            Temporary password
          </p>

          <p style="
            margin: 0;
            font-size: 18px;
            line-height: 1.6;
            font-weight: bold;
            color: ${COLORS.text};
            overflow-wrap: anywhere;
          ">
            ${safePassword}
          </p>
        </td>
      </tr>
    </table>

    <p style="margin: 22px 0 0;">
      <strong>Important:</strong> Please sign in and change your
      temporary password immediately. Your account requires a
      password reset on first login.
    </p>

    <p style="
      margin: 18px 0 0;
      color: ${COLORS.muted};
      font-size: 13px;
    ">
      For your security, do not share your password with anyone.
    </p>
  `;

  const html = createEmailTemplate({
    preheader: 'Your Ente Arazhy account is ready.',
    title: 'Welcome to Ente Arazhy!',
    subtitle: 'Your account is ready. Here are your login details.',
    content,
  });

  const text = `
Hello ${userName},

Your Ente Arazhy account has been created successfully as Family Head.

Login house number: ${houseNumber}
Temporary password: ${temporaryPassword}

Please sign in and change your temporary password immediately.
Your account requires a password reset on first login.

Do not share your password with anyone.

© ${new Date().getFullYear()} Ente Arazhy.
  `.trim();

  const info = await transporter.sendMail({
    from: `"Ente Arazhy" <${config.EMAIL_FROM}>`,
    to,
    subject: 'Welcome to Ente Arazhy - Your Account Is Ready',
    html,
    text,
  });

  return { success: true, messageId: info.messageId };
};

module.exports = {
  transporter,
  sendPasswordResetEmail,
  sendTemporaryPasswordEmail,
};
