import React, { useState, useEffect } from 'react';
import { FaTimes, FaEye, FaEyeSlash } from 'react-icons/fa';
import '../styles/UserRegistrationModal.css';
import axios from 'axios';

const API_BASE_URL =
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://kanang-alalay-backend.onrender.com/api' : 'http://localhost:5000/api');

const UserRegistrationModal = ({ isOpen, onClose, onRegister }) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('staff');
    const [code, setCode] = useState('');
    const [isCodeSent, setIsCodeSent] = useState(false);
    const [userId, setUserId] = useState('');    
    const [formData, setFormData] = useState({
        staffId: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
        phone: '',
        role: 'staff',
        shift: 'morning',
        ward: '',
        employeeType: 'permanent',
        hireDate: new Date().toISOString().split('T')[0],
        department: ''
    });

    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [registrationCode, setRegistrationCode] = useState('');
    const [generatedStaffId, setGeneratedStaffId] = useState('');

    // Auto-generate staff ID
    useEffect(() => {
        if (isOpen && !formData.staffId) {
            generateStaffId();
        }
    }, [isOpen]);

    const generateStaffId = () => {
        const prefix = 'LSAE';
        const year = new Date().getFullYear().toString().slice(-2);
        const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        const newStaffId = `${prefix}-${year}${month}-${random}`;
        setFormData(prev => ({ ...prev, staffId: newStaffId }));
        setGeneratedStaffId(newStaffId);
    };

    const validateForm = () => {
        const newErrors = {};
        
        // Standard email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!emailRegex.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        // Phone validation
        const phoneRegex = /^09\d{9}$/;
        if (formData.phone && !phoneRegex.test(formData.phone)) {
            newErrors.phone = 'Phone must be 11 digits starting with 09';
        }

        // Password validation
        if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        } else if (!/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])/.test(formData.password)) {
            newErrors.password = 'Password must contain uppercase, lowercase, number, and special character';
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        // Required fields
        const requiredFields = ['username', 'email', 'firstName', 'lastName', 'role'];
        requiredFields.forEach(field => {
            if (!formData[field]) {
                newErrors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validateRegistrationCode = async () => {
        if (!registrationCode) {
            setErrors(prev => ({ ...prev, registrationCode: 'Registration code is required' }));
            return false;
        }

        try {
            // 2. REPLACED LOCALHOST HERE
            const response = await fetch(`${API_BASE_URL}/auth/validate-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registrationCode })
            });

            const data = await response.json();
            
            if (!data.success) {
                setErrors(prev => ({ ...prev, registrationCode: data.message || 'Invalid code' }));
                return false;
            }

            // Auto-fill role from code
            setFormData(prev => ({ ...prev, role: data.role }));
            return true;
        } catch (error) {
            setErrors(prev => ({ ...prev, registrationCode: 'Failed to validate code' }));
            return false;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) return;
        
        // Validate registration code
        const codeValid = await validateRegistrationCode();
        if (!codeValid) return;

        setLoading(true);
        try {
            // 3. REPLACED LOCALHOST HERE
            const response = await fetch(`${API_BASE_URL}/auth/register-staff`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    registrationCode
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                alert(`User registered successfully!\nStaff ID: ${data.staffId}\nVerification email sent.`);
                onRegister(data);
                onClose();
                resetForm();
            } else {
                setErrors(prev => ({ ...prev, submit: data.message || 'Registration failed' }));
            }
        } catch (error) {
            setErrors(prev => ({ ...prev, submit: 'Network error' }));
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            staffId: '',
            username: '',
            email: '',
            password: '',
            confirmPassword: '',
            firstName: '',
            lastName: '',
            phone: '',
            role: 'staff',
            shift: 'morning',
            ward: '',
            employeeType: 'permanent',
            hireDate: new Date().toISOString().split('T')[0],
            department: ''
        });
        setRegistrationCode('');
        setErrors({});
    };

    // Send verification code
    const sendVerificationCode = async () => {
        if (!email) return alert('Enter an email');

        try {
            // 4. REPLACED LOCALHOST HERE
            const res = await axios.post(`${API_BASE_URL}/auth/register`, {
                email,
                password: 'TempPassword123!', // temporary password; will reset later
                firstName: 'Temp',
                lastName: 'User',
                role
            });

            setIsCodeSent(true);
            setUserId(res.data.userId);
            alert('Verification code sent to email! (Check dev console if in development)');
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Failed to send code');
        }
    };

   // Verify code and finalize registration
    const verifyAndRegister = async () => {
        try {
            // 5. REPLACED LOCALHOST HERE
            const res = await axios.post(`${API_BASE_URL}/auth/verify-email`, {
                email,
                code
            });

            alert(res.data.message);
            onRegister({ email, role });
            onClose();

        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Verification failed');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="registration-modal">
                <div className="modal-header">
                    <h3>Register New Staff Member</h3>
                    <button className="close-btn" onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-grid">
                        {/* Registration Code */}
                        <div className="form-group full-width">
                            <label>Registration Code *</label>
                            <input
                                type="text"
                                value={registrationCode}
                                onChange={(e) => setRegistrationCode(e.target.value.toUpperCase())}
                                placeholder="Enter registration code (e.g., LSAE-REG-XXXX)"
                                className={errors.registrationCode ? 'error' : ''}
                                required
                            />
                            {errors.registrationCode && (
                                <small className="error-text">{errors.registrationCode}</small>
                            )}
                            <small className="hint">Code will be validated and determines user role</small>
                        </div>

                        {/* Generated Staff ID */}
                        <div className="form-group">
                            <label>Staff ID (Auto-generated)</label>
                            <input
                                type="text"
                                value={formData.staffId}
                                readOnly
                                className="readonly-field"
                            />
                            <button 
                                type="button" 
                                className="regenerate-btn"
                                onClick={generateStaffId}
                            >
                                Regenerate
                            </button>
                        </div>

                        {/* Basic Information */}
                        <div className="form-group">
                            <label>First Name *</label>
                            <input
                                type="text"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                className={errors.firstName ? 'error' : ''}
                                required
                            />
                            {errors.firstName && <small className="error-text">{errors.firstName}</small>}
                        </div>

                        <div className="form-group">
                            <label>Last Name *</label>
                            <input
                                type="text"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                className={errors.lastName ? 'error' : ''}
                                required
                            />
                            {errors.lastName && <small className="error-text">{errors.lastName}</small>}
                        </div>

                        <div className="form-group">
                            <label>Username *</label>
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                className={errors.username ? 'error' : ''}
                                placeholder="e.g., juan.dela.cruz"
                                required
                            />
                            {errors.username && <small className="error-text">{errors.username}</small>}
                        </div>

                        <div className="form-group">
                            <label>Email *</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className={errors.email ? 'error' : ''}
                                placeholder="e.g., kanangalalaybugbytes@gmail.com"
                                required
                            />
                            {errors.email && <small className="error-text">{errors.email}</small>}
                        </div>

                        {/* Password Fields */}
                        <div className="form-group password-field">
                            <label>Password *</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className={errors.password ? 'error' : ''}
                                    required
                                />
                                <button 
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                            {errors.password && <small className="error-text">{errors.password}</small>}
                            <small className="hint">
                                Min 8 chars with uppercase, lowercase, number, and special character
                            </small>
                        </div>

                        <div className="form-group password-field">
                            <label>Confirm Password *</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className={errors.confirmPassword ? 'error' : ''}
                                    required
                                />
                                <button 
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                            {errors.confirmPassword && (
                                <small className="error-text">{errors.confirmPassword}</small>
                            )}
                        </div>

                        {/* Employment Details */}
                        <div className="form-group">
                            <label>Phone</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="09123456789"
                                className={errors.phone ? 'error' : ''}
                            />
                            {errors.phone && <small className="error-text">{errors.phone}</small>}
                        </div>

                        <div className="form-group">
                            <label>Role *</label>
                            <select
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                className={errors.role ? 'error' : ''}
                                required
                            >
                                <option value="staff">Staff</option>
                                <option value="nurse">Nurse</option>
                                <option value="caregiver">Caregiver</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Shift</label>
                            <select
                                name="shift"
                                value={formData.shift}
                                onChange={handleChange}
                            >
                                <option value="morning">Morning</option>
                                <option value="afternoon">Afternoon</option>
                                <option value="night">Night</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Employee Type</label>
                            <select
                                name="employeeType"
                                value={formData.employeeType}
                                onChange={handleChange}
                            >
                                <option value="permanent">Permanent</option>
                                <option value="contract">Contract</option>
                                <option value="volunteer">Volunteer</option>
                                <option value="intern">Intern</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Hire Date</label>
                            <input
                                type="date"
                                name="hireDate"
                                value={formData.hireDate}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label>Ward/Department</label>
                            <input
                                type="text"
                                name="ward"
                                value={formData.ward}
                                onChange={handleChange}
                                placeholder="e.g., Ward A, Accounting"
                            />
                        </div>
                    </div>

                    {/* Submit Error */}
                    {errors.submit && (
                        <div className="form-error">
                            <small className="error-text">{errors.submit}</small>
                        </div>
                    )}

                    {/* Modal Actions */}
                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn-cancel"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={loading}
                        >
                            {loading ? 'Registering...' : 'Register Staff'}
                        </button>
                    </div>

                    {/* Security Note */}
                    <div className="security-note">
                        <h4>INFORMATION ASSURANCE AND SECURITY</h4>
                        <p>✓ Email verification required before login</p>
                        <p>✓ OTP-based login for extra security</p>
                        <p>✓ Role-based access control (RBAC)</p>
                        <p>✓ Input validation & sanitization</p>
                        <p>✓ Audit logging enabled</p>
                        <p>✓ Password encryption in storage</p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserRegistrationModal;