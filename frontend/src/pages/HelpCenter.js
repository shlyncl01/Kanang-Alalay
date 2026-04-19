import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    FaArrowLeft, FaLifeRing, FaBook, FaHeadset,
    FaChevronDown, FaChevronUp, FaEnvelope, FaPhone,
    FaUserShield, FaUsers, FaPills, FaCalendarCheck,
    FaBoxOpen, FaChartBar
} from 'react-icons/fa';
import '../styles/HelpCenter.css';

const FAQ_DATA = [
    {
        section: 'General',
        items: [
            { q:'How do I log in?', a:'Go to the login page and enter your username/email and password. If your account is not yet activated, contact your administrator.' },
            { q:'I forgot my password. What do I do?', a:'Click "Forgot Password" on the login page and enter your registered email. You will receive a 6-digit OTP to reset your password.' },
            { q:'How do I update my contact number?', a:'Go to Account Settings from the top-right dropdown. Update your phone number under the Contact Number section.' },
        ]
    },
    {
        section: 'Nurse / Caregiver',
        items: [
            { q:'How do I add a medication schedule?', a:'Go to the Medicines tab → click "+ Add Medication". Select the resident, medication, date & time, and dosage then click Save.' },
            { q:'How do I mark a medication as administered?', a:'In the Medicines tab, find the schedule entry and click "Administer" or "Verify Now". A confirmation dialog will appear before saving.' },
            { q:'What does "Overdue" status mean?', a:'A medication is automatically marked Overdue when its scheduled time has passed and it has not been administered. Check the Medicines tab for red Overdue badges.' },
            { q:'How do I log vital signs?', a:'Go to the Residents tab, find the resident, and click "Log Vital Signs". Fill in at least one vital and click Save.' },
            { q:'How does voice documentation work?', a:'Click the microphone icon in the topbar or Quick Actions. Tap the mic button to record — your speech is transcribed automatically. You can also type manually.' },
        ]
    },
    {
        section: 'Admin',
        items: [
            { q:'How do I add a new user?', a:'Go to Personnel Management → click "Add New Personnel". Select the role (Nurse, Caregiver, Admin), fill in their details, and click Save. An OTP will be sent to activate the account.' },
            { q:'How do I change a user\'s role?', a:'In Personnel Management, find the user and use the role dropdown in their row. A confirmation dialog will appear before the change is saved.' },
            { q:'How do I approve or reject a booking?', a:'Go to Booking Management, find the booking, and click "Approve" or "Reject". A confirmation dialog will appear and the visitor will be notified by email if rejected.' },
            { q:'How do I manage inventory?', a:'Go to the Inventory section. You can add, edit, or delete items. Low stock and expiring items are highlighted automatically.' },
        ]
    },
];

const HelpCenter = () => {
    const { user } = useAuth();
    const navigate  = useNavigate();
    const [openIdx, setOpenIdx] = useState({});

    const toggle = (si, qi) => {
        const key = `${si}-${qi}`;
        setOpenIdx(p => ({ ...p, [key]: !p[key] }));
    };

    const QUICK_LINKS = [
        { icon:<FaUserShield />,    label:'Personnel',   action:'Go to Admin → Personnel Management' },
        { icon:<FaUsers />,         label:'Residents',   action:'Go to Nurse Dashboard → Residents tab' },
        { icon:<FaPills />,         label:'Medicines',   action:'Go to Nurse Dashboard → Medicines tab' },
        { icon:<FaCalendarCheck />, label:'Bookings',    action:'Go to Admin Dashboard → Booking Management' },
        { icon:<FaBoxOpen />,       label:'Inventory',   action:'Go to Admin Dashboard → Inventory' },
        { icon:<FaChartBar />,      label:'Reports',     action:'Go to Admin Dashboard → Reports' },
    ];

    return (
        <div className="page-wrapper">
            <div className="content-container help-container">
                <div className="page-header">
                    <button className="back-btn" onClick={() => navigate(-1)}>
                        <FaArrowLeft /> Back
                    </button>
                    <h2>Help &amp; Support</h2>
                </div>

                {/* Hero */}
                <div className="help-hero-banner">
                    <FaLifeRing className="hero-icon" />
                    <h1>How can we assist you?</h1>
                    <p>Find guides, answers, and contact information for the Kanang-Alalay system.</p>
                </div>

                {/* Quick links */}
                <div className="help-quick-links">
                    {QUICK_LINKS.map(l => (
                        <div key={l.label} className="quick-link-chip">
                            <span className="quick-link-icon">{l.icon}</span>
                            <div>
                                <div className="quick-link-label">{l.label}</div>
                                <div className="quick-link-action">{l.action}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* FAQ */}
                <div className="help-faq-section">
                    <h3 className="help-section-title">Frequently Asked Questions</h3>
                    {FAQ_DATA.map((section, si) => (
                        <div key={si} className="faq-section">
                            <div className="faq-section-label">{section.section}</div>
                            {section.items.map((item, qi) => {
                                const isOpen = openIdx[`${si}-${qi}`];
                                return (
                                    <div key={qi} className={`faq-item ${isOpen ? 'open' : ''}`}>
                                        <button className="faq-question" onClick={() => toggle(si, qi)}>
                                            <span>{item.q}</span>
                                            {isOpen ? <FaChevronUp /> : <FaChevronDown />}
                                        </button>
                                        {isOpen && <div className="faq-answer">{item.a}</div>}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {/* Contact cards */}
                <div className="help-card-grid">
                    <div className="support-card">
                        <div className="support-icon-wrapper"><FaBook /></div>
                        <h3>System Documentation</h3>
                        <p>Learn how to navigate the dashboard, manage residents, and handle bookings.</p>
                        <button className="outline-btn" onClick={() => window.open('https://docs.google.com', '_blank')}>
                            Read Guides
                        </button>
                    </div>
                    <div className="support-card">
                        <div className="support-icon-wrapper"><FaHeadset /></div>
                        <h3>IT Support</h3>
                        <p>Experiencing technical difficulties? Contact the master administrator.</p>
                        <button className="outline-btn" onClick={() => window.location.href = 'mailto:support@kanangalalay.org'}>
                            <FaEnvelope style={{marginRight:6}}/> Contact Support
                        </button>
                    </div>
                </div>

                {/* User info */}
                <div className="help-user-info">
                    Signed in as <strong>{user?.firstName} {user?.lastName}</strong> · Role: <strong>{user?.role?.toUpperCase()}</strong>
                    {user?.staffId && <> · ID: <strong>{user.staffId}</strong></>}
                </div>
            </div>
        </div>
    );
};

export default HelpCenter;