import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaLifeRing, FaBook, FaHeadset } from 'react-icons/fa';
import '../styles/HelpCenter.css';

const HelpCenter = () => {
    const navigate = useNavigate();

    return (
        <div className="page-wrapper">
            <div className="content-container">
                <div className="page-header">
                    <button className="back-btn" onClick={() => navigate(-1)}>
                        <FaArrowLeft /> Back
                    </button>
                    <h2>Help & Support</h2>
                </div>

                <div className="help-hero-banner">
                    <FaLifeRing className="hero-icon" />
                    <h1>How can we assist you?</h1>
                    <p>Find guides, manuals, and contact information for the Kanang-Alalay system.</p>
                </div>

                <div className="help-card-grid">
                    <div className="support-card">
                        <div className="support-icon-wrapper"><FaBook /></div>
                        <h3>System Documentation</h3>
                        <p>Learn how to navigate the dashboard, manage residents, and handle bookings.</p>
                        <button className="outline-btn">Read Guides</button>
                    </div>

                    <div className="support-card">
                        <div className="support-icon-wrapper"><FaHeadset /></div>
                        <h3>IT Support</h3>
                        <p>Experiencing technical difficulties? Contact the master administrator.</p>
                        <button className="outline-btn">Contact Support</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HelpCenter;