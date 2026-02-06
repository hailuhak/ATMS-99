import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "hailukassa992@gmail.com",        // admin email
    pass: "ecwr yfyp lzhs dcxk",     // new app password
  },
});

export const handleUserAction = onCall(async (request) => {
  const { to_email, message, action } = request.data;

  if (!to_email) {
    throw new Error("Missing email address");
  }

  const subject =
    action === "approve"
      ? "Your account has been approved"
      : "Your account has been rejected";

  const mailOptions = {
    from: `"ATMS Admin" <hailukassa992@gmail.com>`,
    to: to_email,
    subject,
    text: message,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info("Email sent to", to_email);
    return { success: true };
  } catch (error) {
    logger.error("Email failed", error);
    throw new Error("Email sending failed");
  }
});
