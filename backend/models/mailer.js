const nodemailer = require('nodemailer');
require('dotenv').config();

const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS 
        }
    });
};

// Professional HTML Template for Kanang-Alalay
const generateOtpTemplate = (otp, type = 'Activation') => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #b85c2d; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Kanang-Alalay</h1>
            <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 14px;">Little Sisters of the Abandoned Elderly</p>
        </div>
        
        <div style="padding: 30px; background-color: #ffffff;">
            <h2 style="color: #333333; margin-top: 0;">Account ${type}</h2>
            <p style="color: #555555; font-size: 16px; line-height: 1.5;">
                Hello, <br><br>
                Here is your 6-digit One-Time Password (OTP) for the Kanang-Alalay system. 
                Please enter this code to proceed.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #b85c2d; background-color: #f9f2ef; padding: 15px 30px; border-radius: 8px; border: 2px dashed #b85c2d;">
                    ${otp}
                </span>
            </div>
            
            <p style="color: #777777; font-size: 14px; text-align: center;">
                <em>This code will expire in 15 minutes.</em><br>
                If you did not request this, please ignore this email.
            </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="color: #999999; font-size: 12px; margin: 0;">
                &copy; ${new Date().getFullYear()} Kanang-Alalay. All rights reserved.
            </p>
        </div>
    </div>
`;

const sendEmail = async (to, subject, htmlContent) => {
    try {
        const transporter = createTransporter();
        const mailOptions = {
            from: `"Kanang Alalay Admin" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html: htmlContent
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email successfully sent to ${to}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Email failed to send:', error);
        return { success: false, error: error.message };
    }
};

module.exports = { sendEmail, generateOtpTemplate };