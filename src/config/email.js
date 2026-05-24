import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '../../.env');

console.log('🔍 Looking for .env at:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Failed to load .env:', result.error.message);
} else {
  console.log('✅ .env loaded successfully from:', envPath);
}

console.log('📧 Email config check:');
console.log('- EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Missing');
console.log('- EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ Set' : '❌ Missing');

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },

  logger: true,
  debug: true,
});
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Email server error:', error.message);
  } else {
    console.log('✅ Email server ready');
  }
});

export const sendEmail = async () => {
  try {
    console.log("Attempting SMTP connection...");

    // Verify SMTP first
    await transporter.verify();

    console.log("SMTP verification successful");

    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "yourtestemail@gmail.com",
      subject: "Test Email",
      text: "Hello from Render",
    });

    console.log("Email sent successfully");
    console.log("Message ID:", info.messageId);
    console.log("Response:", info.response);

  } catch (error) {
    console.error("EMAIL ERROR START");
    console.error(error);

    // More detailed logging
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    console.error("SMTP response:", error.response);
    console.error("Stack:", error.stack);

    console.error("EMAIL ERROR END");
  }
};