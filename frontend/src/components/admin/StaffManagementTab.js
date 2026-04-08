import React from 'react';
import { FaUserPlus, FaIdCard, FaUserMd, FaUserTag, FaUserCircle, FaClock, FaBan, FaCheckCircle, FaTrash } from 'react-icons/fa';

const StaffManagementTab = ({ 
    staff, setShowRegistrationModal, generateRegistrationCode, 
    handleMarkAttendance, toggleStaffStatus, deleteStaff,
    otpSent, registeredUserId, registeredName, registeredEmail, 
    otpCode, setOtpCode, verifyOtp, handleResendOTP, otpMessage 
}) => {
    return (
        <div className="staff-management">
            <div className="card-white">
                <div className="card-header">
                    <h5>Staff Management</h5>
                    <button className="btn-success-sm" onClick={() => setShowRegistrationModal(true)}>
                        <FaUserPlus /> Add New Staff
                    </button>
                </div>

                <div className="quick-code-section" style={{ marginBottom: '20px' }}>
                    <h6>Generate Registration Codes</h6>
                    <div className="code-buttons" style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn-outline-sm" onClick={() => generateRegistrationCode('staff')}><FaIdCard /> Staff Code</button>
                        <button className="btn-outline-sm" onClick={() => generateRegistrationCode('nurse')}><FaUserMd /> Nurse Code</button>
                        <button className="btn-outline-sm" onClick={() => generateRegistrationCode('admin')}><FaUserTag /> Admin Code</button>
                    </div>
                </div>

                <table className="custom-table">
                    <thead>
                        <tr><th>Name</th><th>Contact</th><th>Role</th><th>Status</th><th>Actions</th></tr>
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
                                    <td><span className={`status ${member.isActive ? 'active' : 'inactive'}`}>
                                        {member.isActive ? 'Active' : 'Inactive'}
                                    </span></td>
                                    <td className="actions">
                                        <span className="edit" onClick={() => handleMarkAttendance(member._id, member.firstName)} title="Mark Attendance"><FaClock /></span>
                                        {member.isActive ? (
                                            <span className="deactivate" onClick={() => toggleStaffStatus(member._id, 'active')} title="Deactivate"><FaBan /></span>
                                        ) : (
                                            <span className="activate" onClick={() => toggleStaffStatus(member._id, 'inactive')} title="Activate"><FaCheckCircle /></span>
                                        )}
                                        <span className="delete" onClick={() => deleteStaff(member._id)} title="Delete"><FaTrash /></span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* OTP PANEL */}
                {otpSent && registeredUserId && (
                    <div className="otp-management card-white" style={{ marginTop: '20px', border: '2px solid #b85c2d' }}>
                        <h5>Activate New Account ({registeredName})</h5>
                        <p>OTP code sent to: <strong>{registeredEmail}</strong></p>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input type="text" placeholder="6-digit OTP" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} maxLength="6" className="form-control-custom" style={{ width: '200px', margin: 0 }} />
                            <button className="btn-primary-sm" onClick={verifyOtp}>Verify Account</button>
                            <button className="btn-outline-sm" onClick={handleResendOTP}>Resend OTP</button>
                        </div>
                        {otpMessage && <p style={{ color: otpMessage.includes('verified') ? 'green' : (otpMessage.includes('❌') ? 'red' : '#666'), marginTop: '10px', fontWeight: 'bold' }}>{otpMessage}</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StaffManagementTab;