import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    FaArrowLeft, FaBook, FaUserShield, FaUsers, FaPills,
    FaCalendarCheck, FaBoxOpen, FaChartBar, FaKey
} from 'react-icons/fa';
import '../styles/DocumentationGuide.css';

// Each guide is grouped by the role it's most relevant to, mirroring the
// Help Center FAQ's own grouping so the two stay easy to keep in sync.
const GUIDE_SECTIONS = [
    {
        id: 'account',
        icon: <FaKey />,
        title: 'Account basics',
        audience: 'All staff',
        steps: [
            'Sign in with your username or email and password on the staff login screen.',
            'First time signing in? You\'ll be asked to set a permanent password and confirm your details before continuing.',
            'Forgot your password? Use "Forgot Password" on the login screen — a 6-digit code is emailed to your registered address.',
            'Update your contact number or password any time from Account Settings, reachable from the profile menu in the top right.',
        ],
    },
    {
        id: 'personnel',
        icon: <FaUserShield />,
        title: 'Personnel Management',
        audience: 'Admin',
        steps: [
            'Open Personnel Management from the sidebar to see every staff account, their role, and status.',
            'Click "Add New Personnel" to create an account — choose a role (Nurse, Caregiver, or Admin) and fill in their details.',
            'A one-time activation code is emailed to the new staff member automatically.',
            'To change someone\'s role or status, use the dropdown in their row. A confirmation dialog appears before anything is saved.',
        ],
    },
    {
        id: 'residents',
        icon: <FaUsers />,
        title: 'Residents & vitals',
        audience: 'Nurse / Caregiver',
        steps: [
            'The Residents tab lists every resident, with quick filters for floor, room, and assigned caregiver.',
            'Open a resident\'s profile to see their care history, then click "Log Vital Signs" to record a new reading.',
            'At least one vital is required per entry — the form won\'t submit until that\'s filled in.',
            'Recent readings are shown on the resident\'s timeline so trends are easy to spot at a glance.',
        ],
    },
    {
        id: 'medicines',
        icon: <FaPills />,
        title: 'Medication schedules',
        audience: 'Nurse / Caregiver',
        steps: [
            'Go to the Medicines tab and click "+ Add Medication" to schedule a new dose.',
            'Select the resident, medication, date, time, and dosage, then save.',
            'When a dose is due, find it in the list and click "Administer" or "Verify Now" — you\'ll be asked to confirm before it\'s logged.',
            'A schedule that passes its time without being marked administered turns into a red "Overdue" badge automatically.',
        ],
    },
    {
        id: 'bookings',
        icon: <FaCalendarCheck />,
        title: 'Booking Management',
        audience: 'Admin',
        steps: [
            'Booking Management lists every visitor booking with its current status.',
            'Open a booking to review the details, then click "Approve" or "Reject".',
            'Rejecting a booking notifies the visitor by email automatically — no separate message is needed.',
        ],
    },
    {
        id: 'inventory',
        icon: <FaBoxOpen />,
        title: 'Inventory',
        audience: 'Admin',
        steps: [
            'The Inventory section lists all tracked supplies with current stock levels.',
            'Add, edit, or remove items directly from the table — set a minimum threshold to flag low stock automatically.',
            'Items nearing their expiration date are highlighted so they can be used or replaced in time.',
        ],
    },
    {
        id: 'reports',
        icon: <FaChartBar />,
        title: 'Reports',
        audience: 'Admin',
        steps: [
            'Reports live inside the Overview tab of the Admin Dashboard.',
            'Use them to review facility-wide activity — staffing, bookings, inventory, and donations — at a glance.',
        ],
    },
];

const DocumentationGuide = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="page-wrapper">
            <div className="content-container guide-container">
                <div className="page-header">
                    <button className="back-btn" onClick={() => navigate('/help')}>
                        <FaArrowLeft /> Back
                    </button>
                    <h2>System Documentation</h2>
                </div>

                <div className="guide-hero-banner">
                    <FaBook className="hero-icon" />
                    <h1>Guides for using Kanang-Alalay</h1>
                    <p>Short, practical walkthroughs for the tasks staff do most often. Jump to any section below.</p>
                </div>

                <nav className="guide-toc" aria-label="Guide sections">
                    {GUIDE_SECTIONS.map(s => (
                        <a key={s.id} href={`#${s.id}`} className="guide-toc-link">
                            <span className="guide-toc-icon">{s.icon}</span>
                            {s.title}
                        </a>
                    ))}
                </nav>

                <div className="guide-sections">
                    {GUIDE_SECTIONS.map(s => (
                        <section key={s.id} id={s.id} className="guide-section">
                            <div className="guide-section-header">
                                <span className="guide-section-icon">{s.icon}</span>
                                <div>
                                    <h3>{s.title}</h3>
                                    <span className="guide-audience-tag">{s.audience}</span>
                                </div>
                            </div>
                            <ol className="guide-steps">
                                {s.steps.map((step, i) => <li key={i}>{step}</li>)}
                            </ol>
                        </section>
                    ))}
                </div>

                <div className="guide-footer-note">
                    Still stuck? Head back to <button className="guide-inline-link" onClick={() => navigate('/help')}>Help &amp; Support</button> and reach IT Support directly.
                    {user?.role && <> You're signed in as <strong>{user.role.replace('_', ' ').toUpperCase()}</strong>.</>}
                </div>
            </div>
        </div>
    );
};

export default DocumentationGuide;