export function getVerificationEmailTemplate(verificationUrl: string, userName?: string) {
  return {
    subject: "Verify your email address",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify your email</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <h1 style="color: #1a1a1a; margin-top: 0;">Welcome to Invoice Scanner!</h1>
            <p style="font-size: 16px; color: #555;">
              ${userName ? `Hi ${userName},` : 'Hi there,'}<br><br>
              Thanks for signing up! Please verify your email address to get started with Invoice Scanner.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: #0070f3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
                Verify Email Address
              </a>
            </div>
            <p style="font-size: 14px; color: #666;">
              Or copy and paste this link into your browser:<br>
              <a href="${verificationUrl}" style="color: #0070f3; word-break: break-all;">${verificationUrl}</a>
            </p>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              This link will expire in 24 hours for security reasons.
            </p>
          </div>
          <p style="font-size: 12px; color: #999; text-align: center;">
            If you didn't create an account, you can safely ignore this email.
          </p>
        </body>
      </html>
    `,
    text: `
Welcome to Invoice Scanner!

${userName ? `Hi ${userName},` : 'Hi there,'}

Thanks for signing up! Please verify your email address to get started with Invoice Scanner.

Click the link below to verify your email:
${verificationUrl}

This link will expire in 24 hours for security reasons.

If you didn't create an account, you can safely ignore this email.
    `,
  };
}

export function getPasswordResetEmailTemplate(resetUrl: string, userName?: string) {
  return {
    subject: "Reset your password",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset your password</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <h1 style="color: #1a1a1a; margin-top: 0;">Reset Your Password</h1>
            <p style="font-size: 16px; color: #555;">
              ${userName ? `Hi ${userName},` : 'Hi there,'}<br><br>
              We received a request to reset your password for your Invoice Scanner account.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #0070f3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
                Reset Password
              </a>
            </div>
            <p style="font-size: 14px; color: #666;">
              Or copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #0070f3; word-break: break-all;">${resetUrl}</a>
            </p>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              This link will expire in 1 hour for security reasons.
            </p>
          </div>
          <p style="font-size: 12px; color: #999; text-align: center;">
            If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
          </p>
        </body>
      </html>
    `,
    text: `
Reset Your Password

${userName ? `Hi ${userName},` : 'Hi there,'}

We received a request to reset your password for your Invoice Scanner account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
    `,
  };
}
