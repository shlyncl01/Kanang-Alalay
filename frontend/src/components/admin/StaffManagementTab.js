import React, { useState, useRef } from 'react';
import { FaUserPlus, FaIdCard, FaUserMd, FaUserTag, FaUserCircle, FaBan, FaCheckCircle, FaTrash, FaPrint, FaExclamationTriangle } from 'react-icons/fa';

const getAccountStatus = (m) => {
    if (m.status) return m.status;
    if (!m.isVerified && !m.isActive) return 'pending';
    if (m.isActive) return 'active';
    return 'deactivated';
};
const STATUS_BADGE = {
    active:      { bg: '#EEFBF5', color: '#1E7D56', label: 'Active' },
    pending:     { bg: '#FFF8E1', color: '#B8860B', label: 'Pending' },
    restricted:  { bg: '#FFF3E0', color: '#E65100', label: 'Restricted' },
    suspended:   { bg: '#FFF3CD', color: '#856404', label: 'Suspended' },
    deactivated: { bg: '#FFF0F0', color: '#C0392B', label: 'Deactivated' },
    on_leave:    { bg: '#E8F4FD', color: '#1565C0', label: 'On Leave' },
    terminated:  { bg: '#F3F4F6', color: '#4B5563', label: 'Terminated' },
};

// ── Delete Confirmation Modal ──────────────────────────────────────────────────
const DeleteStaffModal = ({ member, onConfirm, onClose }) => {
    const [reason, setReason] = useState('');
    const [reasonError, setReasonError] = useState('');

    const PRESET_REASONS = [
        'Resignation',
        'End of contract',
        'Terminated for cause',
        'Retirement',
        'Transferred to another facility',
        'Other',
    ];

    const handleConfirm = () => {
        if (!reason.trim()) {
            setReasonError('Please select or enter a reason for removal.');
            return;
        }
        onConfirm(member._id, reason);
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 10002 }}>
            <div className="registration-modal" style={{ maxWidth: 460, padding: 0 }}>
                {/* Header */}
                <div style={{
                    padding: '20px 26px',
                    background: 'linear-gradient(135deg, #dc3545, #a71d2a)',
                    borderRadius: '20px 20px 0 0',
                    display: 'flex', alignItems: 'center', gap: 12,
                }}>
                    <FaExclamationTriangle style={{ color: '#fff', fontSize: '1.2rem' }} />
                    <h4 style={{ margin: 0, color: '#fff', fontFamily: "'Playfair Display', serif" }}>
                        Remove Staff Member
                    </h4>
                </div>

                <div style={{ padding: '24px 28px' }}>
                    <p style={{ color: '#555', marginBottom: 6, fontSize: '.92rem' }}>
                        You are about to remove <strong>{member.firstName} {member.lastName}</strong> ({member.role}).
                        This action cannot be undone.
                    </p>
                    <p style={{ color: '#dc3545', fontSize: '.82rem', marginBottom: 20 }}>
                        Please provide a reason for this removal.
                    </p>

                    {/* Preset reasons */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                        {PRESET_REASONS.map(r => (
                            <button
                                key={r}
                                onClick={() => { setReason(r); setReasonError(''); }}
                                style={{
                                    padding: '6px 14px', borderRadius: 20, fontSize: '.78rem',
                                    cursor: 'pointer', fontWeight: 600,
                                    border: `1.5px solid ${reason === r ? '#dc3545' : '#E8D6CC'}`,
                                    background: reason === r ? '#fdecea' : '#FFF8F3',
                                    color: reason === r ? '#dc3545' : '#7A5C4E',
                                    transition: 'all .15s',
                                }}
                            >
                                {r}
                            </button>
                        ))}
                    </div>

                    {/* Custom reason textarea */}
                    <div style={{ marginBottom: 6 }}>
                        <label style={{
                            display: 'block', fontSize: '.78rem', fontWeight: 700,
                            color: '#2c3e50', textTransform: 'uppercase',
                            letterSpacing: '.04em', marginBottom: 6,
                        }}>
                            Reason for Removal <span style={{ color: '#dc3545' }}>*</span>
                        </label>
                        <textarea
                            rows={3}
                            value={reason}
                            onChange={e => { setReason(e.target.value); setReasonError(''); }}
                            placeholder="Type or select a reason above…"
                            style={{
                                width: '100%', padding: '10px 14px',
                                border: `1.5px solid ${reasonError ? '#dc3545' : '#E8D6CC'}`,
                                borderRadius: 10, fontSize: '.9rem',
                                background: '#FFF8F3', color: '#1A0A00',
                                outline: 'none', boxSizing: 'border-box', resize: 'vertical',
                                fontFamily: "'DM Sans', system-ui, sans-serif",
                            }}
                        />
                        {reasonError && (
                            <small style={{ color: '#dc3545', fontSize: '.76rem', marginTop: 3, display: 'block' }}>
                                {reasonError}
                            </small>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 18, borderTop: '1.5px solid #E8D6CC', marginTop: 18 }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '10px 22px', borderRadius: 10,
                                border: '1.5px solid #E8D6CC', background: 'transparent',
                                cursor: 'pointer', fontWeight: 600, color: '#7A5C4E',
                                fontFamily: "'DM Sans', system-ui, sans-serif",
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            style={{
                                padding: '10px 22px', borderRadius: 10, border: 'none',
                                background: 'linear-gradient(135deg, #dc3545, #a71d2a)',
                                color: '#fff', cursor: 'pointer', fontWeight: 700,
                                fontFamily: "'DM Sans', system-ui, sans-serif",
                                boxShadow: '0 4px 12px rgba(220,53,69,.3)',
                            }}
                        >
                            <FaTrash style={{ marginRight: 6 }} /> Confirm Removal
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StaffManagementTab = ({
    staff, setShowRegistrationModal, generateRegistrationCode,
    toggleStaffStatus, deleteStaff,
    otpSent, registeredUserId, registeredName, registeredEmail,
    otpCode, setOtpCode, verifyOtp, handleResendOTP, otpMessage
}) => {
    const [deleteTarget, setDeleteTarget] = useState(null);
    const printRef = useRef(null);

    const handleDeleteRequest = (member) => {
        setDeleteTarget(member);
    };

    const handleDeleteConfirm = (memberId, reason) => {
        deleteStaff(memberId, reason);
        setDeleteTarget(null);
    };

    const handlePrint = () => {
        const printContent = printRef.current;
        const win = window.open('', '_blank');
        win.document.write(`
            <html>
            <head>
                <title>Staff Management Report</title>
                <style>
                    body { font-family: 'DM Sans', sans-serif; padding: 24px; color: #1A0A00; }
                    h2 { color: #b85c2d; font-family: 'Playfair Display', serif; margin-bottom: 4px; }
                    p.sub { color: #7A5C4E; font-size: .85rem; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: .88rem; }
                    th { background: #b85c2d; color: #fff; padding: 10px 12px; text-align: left; font-weight: 700; }
                    td { padding: 9px 12px; border-bottom: 1px solid #E8D6CC; vertical-align: top; }
                    tr:nth-child(even) td { background: #FFF8F3; }
                    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: .76rem; font-weight: 700; }
                    @media print { body { padding: 10px; } }
                </style>
            </head>
            <body>
                <h2>Kanang-Alalay — Staff Management Report</h2>
                <p class="sub">Generated: ${new Date().toLocaleString('en-PH')} &nbsp;|&nbsp; Total staff: ${staff.length}</p>
                ${printContent.innerHTML}
            </body>
            </html>
        `);
        win.document.close();
        win.focus();
        win.print();
        win.close();
    };

    return (
        <div className="staff-management">
            <div className="card-white">
                <div className="card-header">
                    <h5>Staff Management</h5>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-outline-sm" onClick={handlePrint} title="Print Report">
                            <FaPrint /> Print Report
                        </button>
                        <button className="btn-success-sm" onClick={() => setShowRegistrationModal(true)}>
                            <FaUserPlus /> Add New Staff
                        </button>
                    </div>
                </div>

                <div className="quick-code-section" style={{ marginBottom: '20px' }}>
                    <h6>Generate Registration Codes</h6>
                    <div className="code-buttons" style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn-outline-sm" onClick={() => generateRegistrationCode('staff')}><FaIdCard /> Staff Code</button>
                        <button className="btn-outline-sm" onClick={() => generateRegistrationCode('nurse')}><FaUserMd /> Nurse Code</button>
                        <button className="btn-outline-sm" onClick={() => generateRegistrationCode('admin')}><FaUserTag /> Admin Code</button>
                    </div>
                </div>

                <div ref={printRef}>
                    <table className="custom-table">
                        <thead>
                            <tr><th>Name</th><th>Contact</th><th>Role</th><th>Status</th><th className="no-print">Actions</th></tr>
                        </thead>
                        <tbody>
                            {staff.length === 0 ? (
                                <tr><td colSpan="5" className="text-center">No staff found.</td></tr>
                            ) : (
                                staff.map(member => (
                                    <tr key={member._id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <FaUserCircle size={30} color="#ccc" />
                                                <div>
                                                    <strong>{member.firstName} {member.lastName}</strong><br />
                                                    <small className="text-muted">@{member.username}</small>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{member.email}</td>
                                        <td><span className={`badge-custom ${member.role}`}>{member.role}</span></td>
                                        <td>{(() => {
                                            const s = STATUS_BADGE[getAccountStatus(member)] || STATUS_BADGE.pending;
                                            return (
                                                <span style={{
                                                    display: 'inline-block', padding: '4px 12px', borderRadius: 20,
                                                    fontSize: '.78rem', fontWeight: 600,
                                                    background: s.bg, color: s.color,
                                                }}>
                                                    {s.label}
                                                </span>
                                            );
                                        })()}</td>
                                        <td className="actions no-print">
                                            {member.isActive ? (
                                                <span className="deactivate" onClick={() => toggleStaffStatus(member._id, 'active')} title="Deactivate"><FaBan /></span>
                                            ) : (
                                                <span className="activate" onClick={() => toggleStaffStatus(member._id, 'inactive')} title="Activate"><FaCheckCircle /></span>
                                            )}
                                            <span
                                                className="delete"
                                                onClick={() => handleDeleteRequest(member)}
                                                title="Remove"
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <FaTrash />
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* OTP PANEL */}
                {otpSent && registeredUserId && (
                    <div className="otp-management card-white" style={{ marginTop: '20px', border: '2px solid #b85c2d' }}>
                        <h5>Activate New Account ({registeredName})</h5>
                        <p>OTP code sent to: <strong>{registeredEmail}</strong></p>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input
                                type="text"
                                placeholder="6-digit OTP"
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value)}
                                maxLength="6"
                                className="form-control-custom"
                                style={{ width: '200px', margin: 0 }}
                            />
                            <button className="btn-primary-sm" onClick={verifyOtp}>Verify Account</button>
                            <button className="btn-outline-sm" onClick={handleResendOTP}>Resend OTP</button>
                        </div>
                        {otpMessage && (
                            <p style={{
                                color: otpMessage.includes('verified') ? 'green' : (otpMessage.includes('❌') ? 'red' : '#666'),
                                marginTop: '10px', fontWeight: 'bold',
                            }}>
                                {otpMessage}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <DeleteStaffModal
                    member={deleteTarget}
                    onConfirm={handleDeleteConfirm}
                    onClose={() => setDeleteTarget(null)}
                />
            )}
        </div>
    );
};

export default StaffManagementTab;