import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    FaArrowLeft, FaUserCircle, FaEnvelope, FaIdCard,
    FaUserTag, FaPhone, FaBuilding, FaBed, FaClock,
    FaCheckCircle, FaTimesCircle, FaEdit
} from 'react-icons/fa';
import '../styles/ViewProfile.css';

const API_BASE_URL =
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production'
        ? 'https://kanang-alalay-backend.onrender.com/api'
        : 'http://localhost:5000/api');

const ViewProfile = () => {
    const { user: ctxUser, logout } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');

    // Fetch fresh profile from backend
    useEffect(() => {
        const fetchProfile = async () => {
            const token = localStorage.getItem('token');
            try {
                const res  = await fetch(`${API_BASE_URL}/auth/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) setProfile(data.user);
                else setError('Failed to load profile.');
            } catch {
                // Fallback to context user
                setProfile(ctxUser);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [ctxUser]);

    const u = profile || ctxUser;

    const SHIFT_LABELS = {
        morning:   'Morning (6AM–2PM)',
        afternoon: 'Afternoon (2PM–10PM)',
        night:     'Night (10PM–6AM)',
        flexible:  'Flexible',
        rotating:  'Rotating',
    };

    const InfoBox = ({ icon, label, value }) => (
        <div className="info-box">
            <div className="info-icon">{icon}</div>
            <div className="info-text">
                <label>{label}</label>
                <p>{value || <span className="not-provided">Not provided</span>}</p>
            </div>
        </div>
    );

    if (loading) return (
        <div className="page-wrapper">
            <div className="content-container">
                <div style={{ textAlign:'center', padding:'60px 0', color:'#7A5C4E' }}>Loading profile…</div>
            </div>
        </div>
    );

    return (
        <div className="page-wrapper">
            <div className="content-container">
                <div className="page-header">
                    <button className="back-btn" onClick={() => navigate(-1)}>
                        <FaArrowLeft /> Back
                    </button>
                    <h2>My Profile</h2>
                </div>

                {error && <div className="profile-error-banner">{error}</div>}

                <div className="profile-card">
                    {/* Top section */}
                    <div className="profile-top">
                        <div className="profile-avatar-wrap">
                            <FaUserCircle className="profile-avatar" />
                            <span className={`profile-status-dot ${u?.isActive ? 'online' : 'offline'}`} title={u?.isActive ? 'Active' : 'Inactive'} />
                        </div>
                        <div className="profile-title">
                            <h1>{u?.firstName} {u?.lastName || ''}</h1>
                            <span className="role-badge">{u?.role?.toUpperCase() || 'STAFF'}</span>
                            <div className="profile-status-text">
                                {u?.isActive
                                    ? <><FaCheckCircle style={{color:'#1E7D56',marginRight:6}}/>Account Active</>
                                    : <><FaTimesCircle style={{color:'#C0392B',marginRight:6}}/>Account Inactive</>
                                }
                            </div>
                        </div>
                    </div>

                    {/* Info grid */}
                    <div className="profile-grid">
                        <InfoBox icon={<FaIdCard />}    label="Staff ID"        value={u?.staffId} />
                        <InfoBox icon={<FaUserTag />}   label="Username"        value={u?.username ? `@${u.username}` : null} />
                        <InfoBox icon={<FaEnvelope />}  label="Email Address"   value={u?.email} />
                        <InfoBox icon={<FaPhone />}     label="Contact Number"  value={u?.phone} />
                        {(u?.role === 'nurse' || u?.role === 'caregiver') && (
                            <>
                                <InfoBox icon={<FaBuilding />} label="Floor / Ward" value={u?.ward} />
                                <InfoBox icon={<FaClock />}    label="Shift"        value={SHIFT_LABELS[u?.shift] || u?.shift} />
                            </>
                        )}
                        {u?.department && (
                            <InfoBox icon={<FaBuilding />} label="Department" value={u?.department} />
                        )}
                    </div>

                    {/* Member since */}
                    {u?.createdAt && (
                        <div className="profile-member-since">
                            Member since {new Date(u.createdAt).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' })}
                        </div>
                    )}

                    <div className="profile-footer">
                        <button className="brand-btn" onClick={() => navigate('/settings')}>
                            <FaEdit /> Edit Settings
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ViewProfile;