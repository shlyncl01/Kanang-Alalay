import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaArrowLeft, FaUserCircle, FaEnvelope, FaIdCard, FaUserTag, FaPhone } from 'react-icons/fa';
import '../styles/ViewProfile.css';

const ViewProfile = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="page-wrapper">
            <div className="content-container">
                <div className="page-header">
                    <button className="back-btn" onClick={() => navigate(-1)}>
                        <FaArrowLeft /> Back
                    </button>
                    <h2>My Profile</h2>
                </div>

                <div className="profile-card">
                    <div className="profile-top">
                        <FaUserCircle className="profile-avatar" />
                        <div className="profile-title">
                            <h1>{user?.firstName} {user?.lastName || 'Staff Member'}</h1>
                            <span className="role-badge">{user?.role?.toUpperCase() || 'STAFF'}</span>
                        </div>
                    </div>

                    <div className="profile-grid">
                        <div className="info-box">
                            <div className="info-icon"><FaIdCard /></div>
                            <div className="info-text">
                                <label>Staff ID</label>
                                <p>{user?.staffId || 'Not Assigned'}</p>
                            </div>
                        </div>
                        <div className="info-box">
                            <div className="info-icon"><FaUserTag /></div>
                            <div className="info-text">
                                <label>Username</label>
                                <p>@{user?.username || 'user'}</p>
                            </div>
                        </div>
                        <div className="info-box">
                            <div className="info-icon"><FaEnvelope /></div>
                            <div className="info-text">
                                <label>Email Address</label>
                                <p>{user?.email || 'No email provided'}</p>
                            </div>
                        </div>
                        <div className="info-box">
                            <div className="info-icon"><FaPhone /></div>
                            <div className="info-text">
                                <label>Contact Number</label>
                                <p>{user?.phone || 'Not provided'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="profile-footer">
                        <button className="brand-btn" onClick={() => navigate('/settings')}>
                            Edit Settings
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ViewProfile;