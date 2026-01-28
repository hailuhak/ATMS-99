import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import sgMail from "@sendgrid/mail";

admin.initializeApp();

// Set SendGrid API key from Firebase environment
sgMail.setApiKey(functions.config().sendgrid.key);

// Cloud Function to send approval/rejection emails
export const handleUserAction = functions.https.onCall(async (data, context) => {
  const { to_name, to_email, message, action } = data;

  if (!to_name || !to_email || !message || !action) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields"
    );
  }

  const subject =
    action === "approve"
      ? "Your account has been approved"
      : "Your account registration was rejected";

  const email = {
    to: to_email,
    from: "your_verified_email@example.com", // Must be verified in SendGrid
    subject,
    text: `Hello ${to_name},\n\n${message}`,
    html: `<p>Hello <strong>${to_name}</strong>,</p><p>${message}</p>`,
  };

  try {
    await sgMail.send(email);
    console.log(`Email sent to ${to_email}`);
    return { success: true };
  } catch (err: any) {
    console.error("Error sending email:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});
