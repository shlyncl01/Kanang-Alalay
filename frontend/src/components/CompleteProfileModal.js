import React, { useState } from 'react';
import axios from 'axios';
import { useAuth, API_BASE_URL } from '../context/AuthContext';

// Shown when user.needsProfileUpdate === true (see ProtectedRoute.js). Fields
// match what the rest of the app already treats as "the profile" — same set
// used by the Admin "Edit User" modal and backed by PUT /auth/update-profile.
//
// Intentionally has no close/cancel affordance: the user must not be able to
// permanently bypass required profile completion.
const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    border: '1.5px solid #E8D6CC',
    borderRadius: 10,
    fontSize: '.9rem',
    background: '#FFF8F3',
    color: '#1A0A00',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'var(--d-font-body)',
};

const labelStyle = {
    display: 'block',
    fontSize: '.76rem',
    fontWeight: 700,
    color: '#2c3e50',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    marginBottom: 5,
};

const CompleteProfileModal = () => {
    const { user, token, patchUser } = useAuth();

    const [form, setForm] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        middleName: user?.middleName || '',
        phone: user?.phone || '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const setField = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (error) setError('');
    };

    const handleSave = async () => {
        if (!form.firstName.trim() || !form.lastName.trim()) {
            setError('First and last name are required.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const response = await axios.put(`${API_BASE_URL}/auth/update-profile`, form, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.data.success) {
                // Merge the freshly-saved fields (including
                // needsProfileUpdate: false) into context. ProtectedRoute
                // re-renders on this change and the modal disappears.
                patchUser(response.data.user);
            } else {
                setError(response.data.message || 'Failed to update profile.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 10050 }}>
            <div className="registration-modal" style={{ maxWidth: 480, padding: 0 }}>
                <div style={{ padding: '20px 26px', background: 'linear-gradient(135deg,#b85c2d,#7d3a06)', borderRadius: '20px 20px 0 0' }}>
                    <h4 style={{ margin: 0, color: '#fff', fontFamily: 'var(--d-font-head)', fontSize: '1.1rem' }}>
                        Complete Your Profile
                    </h4>
                    <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,.85)', fontSize: '.82rem' }}>
                        Please confirm your details to continue to your dashboard.
                    </p>
                </div>
                <div style={{ padding: '24px 26px' }}>
                    {error && (
                        <div style={{ background: '#f8d7da', color: '#721c24', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: '.85rem' }}>
                            ⚠️ {error}
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                        <div>
                            <label style={labelStyle}>First Name *</label>
                            <input
                                style={inputStyle}
                                value={form.firstName}
                                onChange={(e) => setField('firstName', e.target.value)}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Last Name *</label>
                            <input
                                style={inputStyle}
                                value={form.lastName}
                                onChange={(e) => setField('lastName', e.target.value)}
                            />
                        </div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                        <label style={labelStyle}>Middle Name</label>
                        <input
                            style={inputStyle}
                            value={form.middleName}
                            onChange={(e) => setField('middleName', e.target.value)}
                        />
                    </div>
                    <div style={{ marginBottom: 6 }}>
                        <label style={labelStyle}>Phone</label>
                        <input
                            style={inputStyle}
                            value={form.phone}
                            onChange={(e) => setField('phone', e.target.value.replace(/\D/g, '').slice(0, 11))}
                            placeholder="09XXXXXXXXX"
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22, paddingTop: 16, borderTop: '1.5px solid var(--d-border)' }}>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            style={{
                                padding: '9px 22px',
                                borderRadius: 10,
                                border: 'none',
                                background: saving ? '#ccc' : 'linear-gradient(135deg,#F96B38,#D94E1B)',
                                color: '#fff',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                fontWeight: 700,
                                fontFamily: 'var(--d-font-body)',
                            }}
                        >
                            {saving ? 'Saving…' : '✓ Save & Continue'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompleteProfileModal;