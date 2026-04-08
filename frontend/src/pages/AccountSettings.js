import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaShieldAlt } from 'react-icons/fa';
import '../styles/AccountSettings.css';

const AccountSettings = () => {
    const navigate = useNavigate();

    return (
        <div className="page-wrapper">
            <div className="content-container">
                <div className="page-header">
                    <button className="back-btn" onClick={() => navigate(-1)}>
                        <FaArrowLeft /> Back
                    </button>
                    <h2>Account Settings</h2>
                </div>

                <div className="settings-card">
                    <div className="card-header">
                        <FaShieldAlt className="header-icon" />
                        <h3>Update Password</h3>
                    </div>
                    
                    <form className="settings-form">
                        <div className="input-group">
                            <label>Current Password</label>
                            <input type="password" placeholder="Enter current password" />
                        </div>
                        <div className="input-group">
                            <label>New Password</label>
                            <input type="password" placeholder="Enter new password" />
                        </div>
                        <div className="input-group">
                            <label>Confirm New Password</label>
                            <input type="password" placeholder="Confirm new password" />
                        </div>
                        
                        <div className="form-actions">
                            <button type="button" className="cancel-btn" onClick={() => navigate(-1)}>Cancel</button>
                            <button type="submit" className="brand-btn">Save Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AccountSettings;