import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    FaArrowLeft, FaUserCircle, FaEnvelope, FaIdCard,
    FaUserTag, FaPhone, FaBuilding, FaBed, FaClock,
    FaCheckCircle, FaTimesCircle, FaEdit, FaCamera, FaSpinner
} from 'react-icons/fa';
import '../styles/ViewProfile.css';

const API_BASE_URL =
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production'
        ? 'https://kanang-alalay-backend.onrender.com/api'
        : 'http://localhost:5000/api');

const ViewProfile = () => {
    const { user: ctxUser, logout, patchUser } = useAuth();
    const navigate = useNavigate();

    // Keep a live reference to ctxUser for the catch-block fallback below,
    // without making the fetch effect depend on it (see note by the
    // useEffect for why that matters).
    const ctxUserRef = useRef(ctxUser);
    useEffect(() => { ctxUserRef.current = ctxUser; }, [ctxUser]);

    // Back always returns through the user's dashboard (not raw browser
    // history) so it can never leave the app or land on a blank page.
    // replace:true removes this page from history entirely, so the
    // browser's forward/back buttons can't bring the user back to it.
    const goBack = () => navigate(ctxUser?.role === 'admin' ? '/admin' : '/head-caregiver', { replace: true });
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');

    // Fetch fresh profile from backend.
    //
    // Deliberately runs ONCE on mount ([] deps), not on every ctxUser
    // change. patchUser() below updates ctxUser, and ctxUser was
    // previously in this effect's dependency array — so every fetch
    // triggered another fetch, forever (visible in devtools as
    // continuous /auth/profile requests). ctxUserRef (set up above) gives
    // the catch-block fallback fresh data without re-creating that loop.
    useEffect(() => {
        const fetchProfile = async () => {
            const token = localStorage.getItem('token');
            try {
                const res  = await fetch(`${API_BASE_URL}/auth/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) {
                    // The backend is the single source of truth for photoUrl.
                    // Never fall back to a cached/localStorage value here — a
                    // shared, unscoped cache key is exactly what let one
                    // account's photo bleed into another account's profile.
                    setProfile({ ...data.user, photoUrl: data.user.photoUrl || null });
                    // /auth/profile is returning richer data than
                    // /validate-token gave AuthContext at login — share the
                    // photo with the rest of the app (topbar avatar) so it
                    // doesn't look stale next to this page.
                    patchUser({ photoUrl: data.user.photoUrl || null });
                }
                else setError('Failed to load profile.');
            } catch {
                // Fallback to context user
                setProfile(ctxUserRef.current);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const u = profile || ctxUser;

    // ── Profile photo (staged until "Save Photo" is clicked) ────────────────
    const fileInputRef = useRef(null);
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState('');
    const [photoUploading, setPhotoUploading] = useState(false);
    const [photoMsg, setPhotoMsg] = useState('');

    const pickPhoto = () => { if (!photoUploading) fileInputRef.current?.click(); };

    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setPhotoMsg('error:Please choose an image file.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setPhotoMsg('error:Image must be smaller than 5MB.');
            return;
        }

        if (photoPreview) URL.revokeObjectURL(photoPreview);
        setPhotoPreview(URL.createObjectURL(file));
        setPhotoFile(file);
        setPhotoMsg('');
    };

    const discardPhotoEdit = () => {
        if (photoPreview) URL.revokeObjectURL(photoPreview);
        setPhotoPreview('');
        setPhotoFile(null);
    };

    useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

    const savePhotoEdit = async () => {
        if (!photoFile) return;
        setPhotoUploading(true);
        setPhotoMsg('');
        try {
            const token = localStorage.getItem('token');
            const body = new FormData();
            body.append('photo', photoFile);
            const res  = await fetch(`${API_BASE_URL}/users/photo`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` },
                body,
            });
            const data = await res.json();
            if (data.success) {
                // Only React state is updated — the backend record (persisted
                // via the PUT above) is the source of truth. No localStorage
                // write, so no stale/shared cache can leak into another
                // account's profile later.
                setProfile(p => ({ ...(p || ctxUser), photoUrl: data.photoUrl }));
                patchUser({ photoUrl: data.photoUrl });
                if (photoPreview) URL.revokeObjectURL(photoPreview);
                setPhotoPreview('');
                setPhotoFile(null);
                setPhotoMsg('success:Profile photo updated.');
                setTimeout(() => setPhotoMsg(''), 4000);
            } else {
                setPhotoMsg(`error:${data.message || 'Failed to upload photo.'}`);
            }
        } catch {
            setPhotoMsg('error:Network error. Please try again.');
        } finally {
            setPhotoUploading(false);
        }
    };

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
                    <button className="back-btn" onClick={goBack}>
                        <FaArrowLeft /> Back
                    </button>
                    <h2>My Profile</h2>
                </div>

                {error && <div className="profile-error-banner">{error}</div>}

                {photoMsg && (
                    <div className={photoMsg.startsWith('success:') ? 'profile-success-banner' : 'profile-error-banner'}>
                        {photoMsg.startsWith('success:') ? <FaCheckCircle /> : <FaTimesCircle />} {photoMsg.slice(photoMsg.indexOf(':') + 1)}
                    </div>
                )}

                {photoFile && (
                    <div className="profile-photo-pending-bar">
                        <span className="profile-photo-pending-text"><FaCamera /> New profile photo selected</span>
                        <div className="profile-photo-pending-actions">
                            <button type="button" className="cancel-btn" onClick={discardPhotoEdit} disabled={photoUploading}>Discard</button>
                            <button type="button" className="brand-btn" onClick={savePhotoEdit} disabled={photoUploading}>
                                {photoUploading ? 'Saving…' : 'Save Photo'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="profile-card">
                    {/* Top section */}
                    <div className="profile-top">
                        <div className="profile-avatar-col">
                            <div
                                className="profile-avatar-wrap"
                                onClick={pickPhoto}
                                role="button"
                                tabIndex={0}
                                title="Change photo"
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') pickPhoto(); }}
                                style={{ cursor: photoUploading ? 'default' : 'pointer' }}
                            >
                                {(photoPreview || u?.photoUrl) ? (
                                    <img
                                        src={photoPreview || u.photoUrl}
                                        alt={`${u?.firstName || ''} ${u?.lastName || ''}`.trim()}
                                        className="profile-avatar-photo"
                                    />
                                ) : (
                                    <FaUserCircle className="profile-avatar" />
                                )}
                                <span className={`profile-status-dot ${u?.isActive ? 'online' : 'offline'}`} title={u?.isActive ? 'Active' : 'Inactive'} />
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handlePhotoChange}
                                />
                                {photoUploading && <div className="profile-avatar-uploading"><FaSpinner className="spin" /></div>}
                            </div>
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