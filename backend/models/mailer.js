const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const { Resend } = require('resend');

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const emailUser = (process.env.EMAIL_USER || '').trim();
const emailPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
const sendgridApiKey = (process.env.SENDGRID_API_KEY || '').trim();
const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
const fromEmail = process.env.FROM_EMAIL || emailUser;

// Provider priority: Resend > SendGrid > Gmail.
// SendGrid support is kept only for backward compatibility in case that
// key ever reappears in an environment — Resend is the preferred provider.
const useResend = Boolean(resendApiKey);
const useSendGrid = !useResend && Boolean(sendgridApiKey);

let resendClient = null;
if (useResend) {
    resendClient = new Resend(resendApiKey);
} else if (useSendGrid) {
    sgMail.setApiKey(sendgridApiKey.replace(/\s+/g, ''));
}

const provider = useResend ? 'resend-api' : useSendGrid ? 'sendgrid-api' : 'gmail';

console.log('Mailer config:', {
    NODE_ENV: process.env.NODE_ENV,
    EMAIL_USER: emailUser ? emailUser.substring(0, 3) + '***' : 'not set',
    EMAIL_PROVIDER: provider,
    FROM_EMAIL: fromEmail ? fromEmail : 'not set',
    EMAIL_PASS_length: emailPass.length,
    SENDGRID_API_KEY_length: sendgridApiKey ? sendgridApiKey.length : 0,
    RESEND_API_KEY_length: resendApiKey ? resendApiKey.length : 0
});

const transporter = (!useResend && !useSendGrid)
    ? nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: emailUser,
            pass: emailPass
        },
        requireTLS: true,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000
    })
    : null;

if (useResend) {
    console.log('Resend API mode active. Mailer is ready.');
    if (!fromEmail) {
        console.error('RESEND CONFIG WARNING: FROM_EMAIL is not set.');
        console.error('   → Resend requires a "from" address on a domain you have verified in the Resend dashboard.');
    }
} else if (useSendGrid) {
    console.log('SendGrid Web API mode active. Mailer is ready.');
} else {
    if (!emailUser || !emailPass) {
        console.error('GMAIL CONFIG MISSING: EMAIL_USER and/or EMAIL_PASS are not set.');
        console.error('   → Set both in Render → Environment before emails can send.');
    }
    transporter.verify((error) => {
        if (error) {
            console.error('SMTP CONNECTION FAILED:', error.message);
            console.error('   → Check EMAIL_USER and EMAIL_PASS in your Render environment variables');
            console.error('   → Gmail app passwords may be shown with spaces; the service will strip whitespace automatically');
            console.error('   → Gmail requires an App Password, NOT your account password');
            console.error('   → Steps: Enable 2FA on Gmail → myaccount.google.com/apppasswords → create App Password');
        } else {
            console.log('SMTP connection verified. Mailer is ready (Gmail mode).');
        }
    });
}

const sendEmail = async (to, subject, htmlContent) => {
    try {
        const mailOptions = {
            from: `"Kanang-Alalay Admin" <${fromEmail}>`,
            to,
            subject,
            html: htmlContent
        };

        if (useResend) {
            const { data, error } = await resendClient.emails.send({
                from: mailOptions.from,
                to: mailOptions.to,
                subject: mailOptions.subject,
                html: mailOptions.html
            });
            if (error) {
                // Resend doesn't throw on API errors — it returns an `error` object instead,
                // so this has to be checked and thrown manually to hit the catch block below.
                throw new Error(error.message || 'Resend API returned an error');
            }
            console.log('Resend email sent successfully to:', to, 'id:', data && data.id);
        } else if (useSendGrid) {
            await sgMail.send(mailOptions);
            console.log('SendGrid email sent successfully to:', to);
        } else {
            await transporter.sendMail(mailOptions);
            console.log('Email sent successfully to:', to);
        }

        return true;
    } catch (error) {
        console.error('Error sending email:', error);
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

// Booking Confirmation Email Template (for approved bookings)
const generateBookingConfirmationTemplate = (booking) => `
<div style="background-color: #fcf8f5; padding: 40px 20px; font-family: 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 550px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; border-top: 5px solid #28a745; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <h2 style="color: #28a745; margin-top: 0;">Booking Confirmed!</h2>
        <p style="color: #444; font-size: 16px;">Hi ${booking.name},</p>
        <p style="color: #444; font-size: 16px;">Great news! Your booking has been <strong>approved and confirmed</strong>. We look forward to welcoming you to Kanang-Alalay.</p>
        
        <div style="background-color: #fff3ea; padding: 20px; border-radius: 6px; margin: 25px 0;">
            <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(booking.visitDate).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${booking.visitTime}</p>
            <p style="margin: 5px 0;"><strong>Purpose:</strong> ${booking.purpose.toUpperCase()}</p>
            <p style="margin: 5px 0;"><strong>Visitors:</strong> ${booking.numberOfVisitors} pax</p>
        </div>
        
        <p style="color: #666; font-size: 14px;">Please arrive on time for your scheduled visit. If you need to reschedule or have any questions, please contact us at least 24 hours in advance.</p>
        <br/>
        <p style="color: #444; margin: 0;">Best regards,</p>
        <p style="color: #444; font-weight: bold; margin: 0;">Kanang-Alalay Admin Team</p>
    </div>
</div>`;

// Booking Rejection Email Template
const generateBookingRejectionTemplate = (booking, reason = '') => `
<div style="background-color: #fcf8f5; padding: 40px 20px; font-family: 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 550px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; border-top: 5px solid #dc3545; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <h2 style="color: #dc3545; margin-top: 0;">Booking Update</h2>
        <p style="color: #444; font-size: 16px;">Hi ${booking.name || 'Valued Visitor'},</p>
        <p style="color: #444; font-size: 16px;">We regret to inform you that your booking request has been <strong>declined</strong>.</p>
        
        ${reason ? `<p style="color: #666; font-size: 14px; background: #f8f9fa; padding: 12px; border-radius: 6px;"><strong>Reason provided:</strong> ${reason}</p>` : ''}
        
        <div style="background-color: #fff3ea; padding: 20px; border-radius: 6px; margin: 25px 0;">
            <p style="margin: 5px 0;"><strong>Requested Date:</strong> ${new Date(booking.visitDate).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Requested Time:</strong> ${booking.visitTime}</p>
            <p style="margin: 5px 0;"><strong>Purpose:</strong> ${(booking.purpose || '').toUpperCase()}</p>
        </div>
        
        <p style="color: #666; font-size: 14px;">Please feel free to submit another booking request with a different date or time. If you have any questions, don't hesitate to contact us at <a href="mailto:${process.env.EMAIL_USER}">${process.env.EMAIL_USER}</a>.</p>
        
        <hr style="margin: 30px 0; border-color: #eee;" />
        
        <p style="color: #444; margin: 0;">Thank you for your understanding,</p>
        <p style="color: #444; font-weight: bold; margin: 0;">Kanang-Alalay Admin Team</p>
    </div>
</div>`;

// Booking Cancellation Email Template
// (previously missing — bookingRoutes.js imports and calls this but mailer.js never defined it,
// which caused every cancellation email to throw "generateBookingCancelledTemplate is not a function")
const generateBookingCancelledTemplate = (booking) => `
<div style="background-color: #fcf8f5; padding: 40px 20px; font-family: 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 550px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; border-top: 5px solid #dc3545; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <h2 style="color: #dc3545; margin-top: 0;">Booking Cancelled</h2>
        <p style="color: #444; font-size: 16px;">Hi ${booking.name || 'Valued Visitor'},</p>
        <p style="color: #444; font-size: 16px;">Your booking to Kanang-Alalay has been <strong>cancelled</strong>.</p>
        
        <div style="background-color: #fff3ea; padding: 20px; border-radius: 6px; margin: 25px 0;">
            <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(booking.visitDate).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${booking.visitTime}</p>
            <p style="margin: 5px 0;"><strong>Purpose:</strong> ${(booking.purpose || '').toUpperCase()}</p>
        </div>
        
        <p style="color: #666; font-size: 14px;">If this was a mistake or you'd like to schedule a new visit, please feel free to submit another booking request.</p>
        
        <hr style="margin: 30px 0; border-color: #eee;" />
        
        <p style="color: #444; margin: 0;">Thank you for your understanding,</p>
        <p style="color: #444; font-weight: bold; margin: 0;">Kanang-Alalay Admin Team</p>
    </div>
</div>`;

module.exports = { 
    sendEmail, 
    generateOtpTemplate, 
    generateBookingTemplate, 
    generateDonationTemplate,
    generateBookingConfirmationTemplate,
    generateBookingRejectionTemplate,
    generateBookingCancelledTemplate
};