const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendEmail = async (to, subject, htmlContent) => {
    try {
        const mailOptions = {
            from: `"Kanang-Alalay Admin" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: htmlContent
        };
        await transporter.sendMail(mailOptions);
        console.log('Automated email sent SUCCESSFULLY to:', to);
        return true;
    } catch (error) {
        console.error('ERROR sending automated email:', error);
        throw error;
    }
};

// OTP Email Template
const generateOtpTemplate = (otpCode) => {
     return `
    <div style="background-color: #f7f7f7; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333;">
        <div style="max-width: 550px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
            
            <h2 style="color: #333; margin-top: 0; font-size: 24px; display: flex; align-items: center; gap: 10px;">
                Kanang-Alalay
            </h2>

            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 25px; color: #444;">
                Welcome to Kanang-Alalay!
            </p>

            <p style="font-size: 15px; line-height: 1.6; margin-bottom: 35px; color: #444;">
                You're receiving this message because you've recently been registered for a staff account. Please confirm your email address and activate your account by entering the code below into your dashboard.
            </p>

            <div style="text-align: center; margin: 40px 0;">
                <div style="background-color: #b85c2d; color: #ffffff; padding: 15px 40px; border-radius: 6px; display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px;">
                    ${otpCode}
                </div>
            </div>

            <p style="font-size: 14px; line-height: 1.6; color: #666; margin-bottom: 20px;">
                This step adds extra security to your account by verifying you own this email address and ensures you have access to all the features available within your role.
            </p>

            <p style="font-size: 14px; line-height: 1.6; color: #666; margin-bottom: 40px;">
                If you have questions about why you're receiving this email, or if you're having any trouble verifying your account, please contact your system administrator.
            </p>

            <p style="font-size: 14px; line-height: 1.6; color: #444; margin: 0;">Cheers,</p>
            <p style="font-size: 14px; line-height: 1.6; color: #444; margin: 0;">The Kanang-Alalay Admin Team</p>
        </div>
    </div>
    `;
};

// Booking Email Template
const generateBookingTemplate = (booking) => `
<div style="background-color: #fcf8f5; padding: 40px 20px; font-family: 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 550px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; border-top: 5px solid #b85c2d; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <h2 style="color: #b85c2d; margin-top: 0;">Booking Received!</h2>
        <p style="color: #444; font-size: 16px;">Hi ${booking.name},</p>
        <p style="color: #444; font-size: 16px;">Thank you for scheduling a visit to Kanang-Alalay. Your request is currently <strong>pending approval</strong> by our administration team.</p>
        
        <div style="background-color: #fff3ea; padding: 20px; border-radius: 6px; margin: 25px 0;">
            <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(booking.visitDate).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${booking.visitTime}</p>
            <p style="margin: 5px 0;"><strong>Purpose:</strong> ${booking.purpose.toUpperCase()}</p>
            <p style="margin: 5px 0;"><strong>Visitors:</strong> ${booking.numberOfVisitors} pax</p>
        </div>
        
        <p style="color: #666; font-size: 14px;">We will send you another email as soon as your booking is confirmed. If you have any questions, please reply directly to this email.</p>
        <br/>
        <p style="color: #444; margin: 0;">Warm regards,</p>
        <p style="color: #444; font-weight: bold; margin: 0;">Kanang-Alalay Admin Team</p>
    </div>
</div>`;

// Donation Thank You Email Template
const generateDonationTemplate = (donation) => `
<div style="background-color: #fcf8f5; padding: 40px 20px; font-family: 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 550px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; border-top: 5px solid #ff8c42; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <h2 style="color: #ff8c42; margin-top: 0;">Thank You for Your Generosity!</h2>
        <p style="color: #444; font-size: 16px;">Dear ${donation.donorName},</p>
        <p style="color: #444; font-size: 16px;">We have successfully received your donation details. Your support helps us provide continuous care and dignity to our elderly residents.</p>
        
        <div style="background-color: #fff3ea; padding: 20px; border-radius: 6px; margin: 25px 0;">
            <p style="margin: 5px 0; font-size: 18px;"><strong>Amount:</strong> ₱${donation.amount.toLocaleString()}</p>
            <p style="margin: 5px 0;"><strong>Type:</strong> ${donation.donationType.toUpperCase()}</p>
            <p style="margin: 5px 0;"><strong>Reference ID:</strong> ${donation.donationId}</p>
        </div>
        
        <p style="color: #666; font-size: 14px;">${donation.donationType === 'online' ? 'Your online payment is being processed.' : 'We look forward to seeing you at your scheduled appointment.'}</p>
        <br/>
        <p style="color: #444; margin: 0;">With deep gratitude,</p>
        <p style="color: #444; font-weight: bold; margin: 0;">Kanang-Alalay Admin Team</p>
    </div>
</div>`;

module.exports = { sendEmail, generateOtpTemplate, generateBookingTemplate, generateDonationTemplate };