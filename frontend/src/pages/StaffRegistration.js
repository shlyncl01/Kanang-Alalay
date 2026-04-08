import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    FaArrowLeft, 
    FaLock, 
    FaEye, 
    FaEyeSlash, 
    FaQrcode,
    FaUser,
    FaEnvelope,
    FaPhone,
    FaIdCard,
    FaCalendarAlt,
    FaClock,
    FaHospital,
    FaUserTag,
    FaCheckCircle,
    FaExclamationTriangle
} from 'react-icons/fa';
import '../styles/StaffRegistration.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://kanang-alalay-backend.onrender.com/api';

const StaffRegistration = () => {
    const [formData, setFormData] = useState({
        registrationCode: '',
        staffId: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        
        // Formal name fields
        firstName: '',
        middleName: '',
        lastName: '',
        suffix: '', // e.g., Jr., Sr., III
        
        // Contact information
        phone: '',
        alternatePhone: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelation: '',
        
        // Professional information
        role: 'staff',
        employeeType: 'permanent',
        designation: '',
        department: '',
        shift: '',
        ward: '',
        
        // Employment details
        hireDate: new Date().toISOString().split('T')[0],
        employeeId: '',
        
        // Address
        address: '',
        city: '',
        province: '',
        zipCode: '',
        
        // Professional details
        licenseNumber: '',
        specialization: '',
        yearsOfExperience: '',
        
        // Account status
        isActive: true,
        requiresPasswordChange: true
    });
    
    const [errors, setErrors] = useState({});
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isCodeValid, setIsCodeValid] = useState(false);
    const [availableCodes, setAvailableCodes] = useState([]);
    const [generatedId, setGeneratedId] = useState('');
    const [passwordStrength, setPasswordStrength] = useState({
        score: 0,
        feedback: '',
        requirements: {
            length: false,
            uppercase: false,
            lowercase: false,
            number: false,
            special: false
        }
    });
    
    const navigate = useNavigate();

    // Fetch available registration codes
    useEffect(() => {
        fetchAvailableCodes();
    }, []);

    const fetchAvailableCodes = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/admin/registration-codes`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            setAvailableCodes(response.data.codes || []);
        } catch (error) {
            console.error('Error fetching codes:', error);
        }
    };

    const validateRegistrationCode = async (code) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/validate-code`, {
                registrationCode: code
            }, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.data.valid) {
                setIsCodeValid(true);
                setGeneratedId(response.data.generatedId);
                setFormData(prev => ({ 
                    ...prev, 
                    staffId: response.data.generatedId,
                    role: response.data.role || 'staff',
                    employeeId: response.data.generatedId
                }));
                setErrors(prev => ({ ...prev, registrationCode: '' }));
                return true;
            }
        } catch (error) {
            setIsCodeValid(false);
            setErrors(prev => ({ 
                ...prev, 
                registrationCode: error.response?.data?.message || 'Invalid registration code' 
            }));
            return false;
        }
    };

    const handleCodeChange = async (e) => {
        const code = e.target.value.toUpperCase();
        setFormData(prev => ({ ...prev, registrationCode: code }));
        
        if (code.length === 12) { // LSAE-REG-XXXX format
            await validateRegistrationCode(code);
        } else {
            setIsCodeValid(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ 
            ...prev, 
            [name]: value 
        }));
        
        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
        
        // Check password strength if password field changes
        if (name === 'password') {
            checkPasswordStrength(value);
        }
    };

    const checkPasswordStrength = (password) => {
        const requirements = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };
        
        const score = Object.values(requirements).filter(Boolean).length;
        
        let feedback = '';
        if (score <= 2) feedback = 'Weak';
        else if (score <= 3) feedback = 'Fair';
        else if (score <= 4) feedback = 'Good';
        else feedback = 'Strong';
        
        setPasswordStrength({ score, feedback, requirements });
    };

    const validateForm = () => {
        const newErrors = {};
        
        // Registration code validation
        if (!isCodeValid) {
            newErrors.registrationCode = 'Please enter a valid registration code';
        }
        
        // Name validations
        if (!formData.firstName.trim()) {
            newErrors.firstName = 'First name is required';
        } else if (formData.firstName.length < 2) {
            newErrors.firstName = 'First name must be at least 2 characters';
        } else if (!/^[A-Za-z\s-']+$/.test(formData.firstName)) {
            newErrors.firstName = 'First name can only contain letters, spaces, hyphens, and apostrophes';
        }
        
        if (!formData.lastName.trim()) {
            newErrors.lastName = 'Last name is required';
        } else if (formData.lastName.length < 2) {
            newErrors.lastName = 'Last name must be at least 2 characters';
        } else if (!/^[A-Za-z\s-']+$/.test(formData.lastName)) {
            newErrors.lastName = 'Last name can only contain letters, spaces, hyphens, and apostrophes';
        }
        
        if (formData.middleName && !/^[A-Za-z\s-']*$/.test(formData.middleName)) {
            newErrors.middleName = 'Middle name can only contain letters, spaces, hyphens, and apostrophes';
        }
        
        if (formData.suffix && !/^[A-Za-z.\s]*$/.test(formData.suffix)) {
            newErrors.suffix = 'Suffix can only contain letters, periods, and spaces';
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!emailRegex.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }
        
        // Password validation
        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        } else if (passwordStrength.score < 3) {
            newErrors.password = 'Password must meet at least 3 of the 5 strength requirements';
        }
        
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }
        
        // Phone validations
        const phoneRegex = /^09\d{9}$/;
        if (formData.phone && !phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
            newErrors.phone = 'Phone must be 11 digits starting with 09';
        }
        
        if (formData.alternatePhone && !phoneRegex.test(formData.alternatePhone.replace(/\s/g, ''))) {
            newErrors.alternatePhone = 'Alternate phone must be 11 digits starting with 09';
        }
        
        // Emergency contact validation
        if (!formData.emergencyContactName.trim()) {
            newErrors.emergencyContactName = 'Emergency contact name is required';
        }
        
        if (!formData.emergencyContactPhone.trim()) {
            newErrors.emergencyContactPhone = 'Emergency contact phone is required';
        } else if (!phoneRegex.test(formData.emergencyContactPhone.replace(/\s/g, ''))) {
            newErrors.emergencyContactPhone = 'Emergency contact phone must be 11 digits starting with 09';
        }
        
        if (!formData.emergencyContactRelation.trim()) {
            newErrors.emergencyContactRelation = 'Emergency contact relation is required';
        }
        
        // Address validation
        if (!formData.address.trim()) {
            newErrors.address = 'Address is required';
        }
        
        if (!formData.city.trim()) {
            newErrors.city = 'City is required';
        }
        
        if (!formData.province.trim()) {
            newErrors.province = 'Province is required';
        }
        
        if (!formData.zipCode.trim()) {
            newErrors.zipCode = 'ZIP code is required';
        } else if (!/^\d{4}$/.test(formData.zipCode)) {
            newErrors.zipCode = 'ZIP code must be 4 digits';
        }
        
        // Professional validation
        if (formData.role === 'nurse' && !formData.licenseNumber) {
            newErrors.licenseNumber = 'License number is required for nurses';
        }
        
        if (formData.yearsOfExperience && (isNaN(formData.yearsOfExperience) || formData.yearsOfExperience < 0)) {
            newErrors.yearsOfExperience = 'Please enter a valid number of years';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            // Scroll to first error
            const firstError = document.querySelector('.field-error');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }
        
        setLoading(true);
        setErrors({});
        
        try {
            // Construct full name
            const fullName = [
                formData.firstName,
                formData.middleName,
                formData.lastName,
                formData.suffix
            ].filter(Boolean).join(' ');
            
            const registrationData = {
                registrationCode: formData.registrationCode,
                staffId: generatedId,
                employeeId: generatedId,
                username: formData.username || formData.email.split('@')[0],
                email: formData.email,
                password: formData.password,
                
                // Name fields
                firstName: formData.firstName,
                middleName: formData.middleName || '',
                lastName: formData.lastName,
                suffix: formData.suffix || '',
                fullName: fullName,
                
                // Contact
                phone: formData.phone,
                alternatePhone: formData.alternatePhone,
                emergencyContact: {
                    name: formData.emergencyContactName,
                    phone: formData.emergencyContactPhone,
                    relation: formData.emergencyContactRelation
                },
                
                // Address
                address: {
                    street: formData.address,
                    city: formData.city,
                    province: formData.province,
                    zipCode: formData.zipCode
                },
                
                // Professional
                role: formData.role,
                employeeType: formData.employeeType,
                designation: formData.designation,
                department: formData.department,
                shift: formData.shift,
                ward: formData.ward,
                hireDate: formData.hireDate,
                
                // Professional details
                licenseNumber: formData.licenseNumber,
                specialization: formData.specialization,
                yearsOfExperience: formData.yearsOfExperience,
                
                // Account settings
                isActive: true,
                requiresPasswordChange: true
            };
            
            const response = await axios.post(
                `${API_BASE_URL}/auth/register-staff`, 
                registrationData,
                {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                }
            );
            
            if (response.data.success) {
                setSuccess(`
                    Staff registered successfully!
                    
                    Staff ID: ${response.data.staffId}
                    Employee ID: ${generatedId}
                    Name: ${fullName}
                    Email: ${formData.email}
                    Role: ${formData.role}
                    
                    Please save this information securely.
                    The staff member will need to change their password on first login.
                `);
                
                // Reset form
                setFormData({
                    registrationCode: '',
                    staffId: '',
                    username: '',
                    email: '',
                    password: '',
                    confirmPassword: '',
                    firstName: '',
                    middleName: '',
                    lastName: '',
                    suffix: '',
                    phone: '',
                    alternatePhone: '',
                    emergencyContactName: '',
                    emergencyContactPhone: '',
                    emergencyContactRelation: '',
                    role: 'staff',
                    employeeType: 'permanent',
                    designation: '',
                    department: '',
                    shift: '',
                    ward: '',
                    hireDate: new Date().toISOString().split('T')[0],
                    employeeId: '',
                    address: '',
                    city: '',
                    province: '',
                    zipCode: '',
                    licenseNumber: '',
                    specialization: '',
                    yearsOfExperience: '',
                    isActive: true,
                    requiresPasswordChange: true
                });
                setIsCodeValid(false);
                setGeneratedId('');
            }
        } catch (error) {
            console.error('Registration error:', error);
            setErrors({ 
                form: error.response?.data?.message || 'Registration failed. Please try again.' 
            });
        } finally {
            setLoading(false);
        }
    };

    const generatePassword = () => {
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const special = '!@#$%^&*';
        
        let password = '';
        
        // Ensure at least one of each
        password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
        password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
        password += numbers.charAt(Math.floor(Math.random() * numbers.length));
        password += special.charAt(Math.floor(Math.random() * special.length));
        
        // Fill the rest
        const allChars = uppercase + lowercase + numbers + special;
        for (let i = password.length; i < 12; i++) {
            password += allChars.charAt(Math.floor(Math.random() * allChars.length));
        }
        
        // Shuffle the password
        password = password.split('').sort(() => Math.random() - 0.5).join('');
        
        setFormData(prev => ({
            ...prev,
            password: password,
            confirmPassword: password
        }));
        
        checkPasswordStrength(password);
    };

    return (
        <div className="registration-wrapper">
            {/* SECURITY HEADER */}
            <div className="security-header">
                <FaLock />
                <span>Secure Staff Registration - LSAE System</span>
            </div>
            
            {/* BACK BUTTON */}
            <div className="back-button" onClick={() => navigate(-1)}>
                <FaArrowLeft />
                <span>Back to Dashboard</span>
            </div>
            
            <div className="registration-container">
                <div className="registration-header">
                    <div className="header-icon">
                        <FaQrcode />
                    </div>
                    <h1>Register New LSAE Staff</h1>
                    <p className="security-notice">
                        <FaLock /> Secure Registration - Complete all required fields
                    </p>
                </div>
                
                {/* STAFF ID DISPLAY */}
                {generatedId && (
                    <div className="staff-id-display">
                        <div className="id-badge">
                            <FaIdCard className="id-icon" />
                            <div className="id-info">
                                <span className="id-label">Assigned Staff ID:</span>
                                <span className="id-value">{generatedId}</span>
                            </div>
                        </div>
                        <p className="id-note">
                            <FaCheckCircle className="success-icon" />
                            This ID will be used for login, time tracking, and access control
                        </p>
                    </div>
                )}
                
                {success && (
                    <div className="success-card">
                        <h4>
                            <FaCheckCircle /> Registration Successful
                        </h4>
                        <pre>{success}</pre>
                        <div className="success-actions">
                            <button 
                                className="print-btn"
                                onClick={() => window.print()}
                            >
                                🖨️ Print Credentials
                            </button>
                            <button 
                                className="new-btn"
                                onClick={() => setSuccess('')}
                            >
                                Register Another Staff
                            </button>
                        </div>
                    </div>
                )}
                
                {errors.form && (
                    <div className="error-card">
                        <h4>
                            <FaExclamationTriangle /> Registration Error
                        </h4>
                        <p>{errors.form}</p>
                    </div>
                )}
                
                <form onSubmit={handleSubmit} className="registration-form">
                    {/* REGISTRATION CODE SECTION */}
                    <div className="form-section">
                        <h3>Step 1: Registration Code</h3>
                        <div className="form-group">
                            <label htmlFor="registrationCode">
                                <FaLock /> Registration Code *
                            </label>
                            <input
                                type="text"
                                id="registrationCode"
                                name="registrationCode"
                                value={formData.registrationCode}
                                onChange={handleCodeChange}
                                className={`form-control ${errors.registrationCode ? 'error' : ''} ${isCodeValid ? 'valid' : ''}`}
                                placeholder="Enter LSAE-REG-XXXX code"
                                maxLength="12"
                                style={{ textTransform: 'uppercase' }}
                            />
                            <div className="input-hint">
                                Format: LSAE-REG-XXXX (12 characters)
                            </div>
                            {errors.registrationCode && (
                                <span className="field-error">
                                    <FaExclamationTriangle /> {errors.registrationCode}
                                </span>
                            )}
                            {isCodeValid && (
                                <span className="field-success">
                                    <FaCheckCircle /> Code validated successfully
                                </span>
                            )}
                        </div>
                        
                        {/* Available codes (admin view only) */}
                        {availableCodes.length > 0 && (
                            <div className="available-codes">
                                <h4>Available Registration Codes:</h4>
                                <div className="codes-grid">
                                    {availableCodes.map((code, index) => (
                                        <div key={index} className="code-item">
                                            <span className="code">{code.code}</span>
                                            <span className={`role-badge ${code.role}`}>{code.role}</span>
                                            <span className={`status-badge ${code.status}`}>{code.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* PERSONAL INFORMATION */}
                    <div className="form-section">
                        <h3>Step 2: Personal Information</h3>
                        
                        {/* Formal Name Fields */}
                        <div className="form-group">
                            <label>
                                <FaUser /> Full Name *
                            </label>
                            <div className="name-fields-grid">
                                <input
                                    type="text"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    placeholder="First Name *"
                                    className={errors.firstName ? 'error' : ''}
                                />
                                <input
                                    type="text"
                                    name="middleName"
                                    value={formData.middleName}
                                    onChange={handleChange}
                                    placeholder="Middle Name (Optional)"
                                    className={errors.middleName ? 'error' : ''}
                                />
                                <input
                                    type="text"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    placeholder="Last Name *"
                                    className={errors.lastName ? 'error' : ''}
                                />
                                <input
                                    type="text"
                                    name="suffix"
                                    value={formData.suffix}
                                    onChange={handleChange}
                                    placeholder="Suffix (Jr., Sr., III)"
                                    className={errors.suffix ? 'error' : ''}
                                />
                            </div>
                            <div className="field-errors">
                                {errors.firstName && <span className="field-error">{errors.firstName}</span>}
                                {errors.middleName && <span className="field-error">{errors.middleName}</span>}
                                {errors.lastName && <span className="field-error">{errors.lastName}</span>}
                                {errors.suffix && <span className="field-error">{errors.suffix}</span>}
                            </div>
                        </div>
                        
                        {/* Contact Information */}
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="email">
                                    <FaEnvelope /> Email Address *
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className={errors.email ? 'error' : ''}
                                    placeholder="e.g., kanangalalaybugbytes@gmail.com"
                                />
                                {errors.email && <span className="field-error">{errors.email}</span>}
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="phone">
                                    <FaPhone /> Primary Phone
                                </label>
                                <input
                                    type="tel"
                                    id="phone"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className={errors.phone ? 'error' : ''}
                                    placeholder="09123456789"
                                />
                                {errors.phone && <span className="field-error">{errors.phone}</span>}
                            </div>
                        </div>
                        
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="alternatePhone">Alternate Phone</label>
                                <input
                                    type="tel"
                                    id="alternatePhone"
                                    name="alternatePhone"
                                    value={formData.alternatePhone}
                                    onChange={handleChange}
                                    className={errors.alternatePhone ? 'error' : ''}
                                    placeholder="09123456789"
                                />
                                {errors.alternatePhone && <span className="field-error">{errors.alternatePhone}</span>}
                            </div>
                        </div>
                        
                        {/* Emergency Contact */}
                        <div className="form-subsection">
                            <h4>Emergency Contact</h4>
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="emergencyContactName">Contact Name *</label>
                                    <input
                                        type="text"
                                        id="emergencyContactName"
                                        name="emergencyContactName"
                                        value={formData.emergencyContactName}
                                        onChange={handleChange}
                                        className={errors.emergencyContactName ? 'error' : ''}
                                        placeholder="Full name"
                                    />
                                    {errors.emergencyContactName && <span className="field-error">{errors.emergencyContactName}</span>}
                                </div>
                                
                                <div className="form-group">
                                    <label htmlFor="emergencyContactPhone">Contact Phone *</label>
                                    <input
                                        type="tel"
                                        id="emergencyContactPhone"
                                        name="emergencyContactPhone"
                                        value={formData.emergencyContactPhone}
                                        onChange={handleChange}
                                        className={errors.emergencyContactPhone ? 'error' : ''}
                                        placeholder="09123456789"
                                    />
                                    {errors.emergencyContactPhone && <span className="field-error">{errors.emergencyContactPhone}</span>}
                                </div>
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="emergencyContactRelation">Relationship *</label>
                                <input
                                    type="text"
                                    id="emergencyContactRelation"
                                    name="emergencyContactRelation"
                                    value={formData.emergencyContactRelation}
                                    onChange={handleChange}
                                    className={errors.emergencyContactRelation ? 'error' : ''}
                                    placeholder="e.g., Spouse, Parent, Sibling"
                                />
                                {errors.emergencyContactRelation && <span className="field-error">{errors.emergencyContactRelation}</span>}
                            </div>
                        </div>
                        
                        {/* Address */}
                        <div className="form-subsection">
                            <h4>Residential Address</h4>
                            <div className="form-group">
                                <label htmlFor="address">Street Address *</label>
                                <input
                                    type="text"
                                    id="address"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    className={errors.address ? 'error' : ''}
                                    placeholder="House/Unit No., Street"
                                />
                                {errors.address && <span className="field-error">{errors.address}</span>}
                            </div>
                            
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="city">City *</label>
                                    <input
                                        type="text"
                                        id="city"
                                        name="city"
                                        value={formData.city}
                                        onChange={handleChange}
                                        className={errors.city ? 'error' : ''}
                                        placeholder="City"
                                    />
                                    {errors.city && <span className="field-error">{errors.city}</span>}
                                </div>
                                
                                <div className="form-group">
                                    <label htmlFor="province">Province *</label>
                                    <input
                                        type="text"
                                        id="province"
                                        name="province"
                                        value={formData.province}
                                        onChange={handleChange}
                                        className={errors.province ? 'error' : ''}
                                        placeholder="Province"
                                    />
                                    {errors.province && <span className="field-error">{errors.province}</span>}
                                </div>
                                
                                <div className="form-group">
                                    <label htmlFor="zipCode">ZIP Code *</label>
                                    <input
                                        type="text"
                                        id="zipCode"
                                        name="zipCode"
                                        value={formData.zipCode}
                                        onChange={handleChange}
                                        className={errors.zipCode ? 'error' : ''}
                                        placeholder="4 digits"
                                        maxLength="4"
                                    />
                                    {errors.zipCode && <span className="field-error">{errors.zipCode}</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* PROFESSIONAL INFORMATION */}
                    <div className="form-section">
                        <h3>Step 3: Professional Information</h3>
                        
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="role">Role *</label>
                                <select
                                    id="role"
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    disabled={!isCodeValid}
                                >
                                    <option value="staff">General Staff</option>
                                    <option value="caregiver">Caregiver</option>
                                    <option value="nurse">Nurse</option>
                                    <option value="admin">Administrator</option>
                                    <option value="doctor">Doctor</option>
                                    <option value="therapist">Therapist</option>
                                </select>
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="employeeType">Employment Type</label>
                                <select
                                    id="employeeType"
                                    name="employeeType"
                                    value={formData.employeeType}
                                    onChange={handleChange}
                                >
                                    <option value="permanent">Permanent</option>
                                    <option value="probationary">Probationary</option>
                                    <option value="contract">Contract</option>
                                    <option value="volunteer">Volunteer</option>
                                    <option value="intern">Intern</option>
                                </select>
                            </div>
                        </div>
                        
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="designation">Designation/Title</label>
                                <input
                                    type="text"
                                    id="designation"
                                    name="designation"
                                    value={formData.designation}
                                    onChange={handleChange}
                                    placeholder="e.g., Head Nurse, Senior Caregiver"
                                />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="department">Department</label>
                                <input
                                    type="text"
                                    id="department"
                                    name="department"
                                    value={formData.department}
                                    onChange={handleChange}
                                    placeholder="e.g., Nursing, Administration, Kitchen"
                                />
                            </div>
                        </div>
                        
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="shift">
                                    <FaClock /> Shift
                                </label>
                                <select
                                    id="shift"
                                    name="shift"
                                    value={formData.shift}
                                    onChange={handleChange}
                                >
                                    <option value="">Select shift</option>
                                    <option value="morning">Morning (6:00 AM - 2:00 PM)</option>
                                    <option value="afternoon">Afternoon (2:00 PM - 10:00 PM)</option>
                                    <option value="night">Night (10:00 PM - 6:00 AM)</option>
                                    <option value="flexible">Flexible</option>
                                    <option value="rotating">Rotating</option>
                                </select>
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="ward">
                                    <FaHospital /> Ward/Area
                                </label>
                                <input
                                    type="text"
                                    id="ward"
                                    name="ward"
                                    value={formData.ward}
                                    onChange={handleChange}
                                    placeholder="e.g., Ward A, ICU, Kitchen"
                                />
                            </div>
                        </div>
                        
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="hireDate">
                                    <FaCalendarAlt /> Hire Date
                                </label>
                                <input
                                    type="date"
                                    id="hireDate"
                                    name="hireDate"
                                    value={formData.hireDate}
                                    onChange={handleChange}
                                />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="yearsOfExperience">Years of Experience</label>
                                <input
                                    type="number"
                                    id="yearsOfExperience"
                                    name="yearsOfExperience"
                                    value={formData.yearsOfExperience}
                                    onChange={handleChange}
                                    min="0"
                                    step="0.5"
                                    placeholder="e.g., 5.5"
                                />
                                {errors.yearsOfExperience && <span className="field-error">{errors.yearsOfExperience}</span>}
                            </div>
                        </div>
                        
                        {/* Professional License (for nurses/doctors) */}
                        {(formData.role === 'nurse' || formData.role === 'doctor') && (
                            <div className="form-subsection">
                                <h4>Professional License</h4>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="licenseNumber">License Number *</label>
                                        <input
                                            type="text"
                                            id="licenseNumber"
                                            name="licenseNumber"
                                            value={formData.licenseNumber}
                                            onChange={handleChange}
                                            className={errors.licenseNumber ? 'error' : ''}
                                            placeholder="PRC License Number"
                                        />
                                        {errors.licenseNumber && <span className="field-error">{errors.licenseNumber}</span>}
                                    </div>
                                    
                                    <div className="form-group">
                                        <label htmlFor="specialization">Specialization</label>
                                        <input
                                            type="text"
                                            id="specialization"
                                            name="specialization"
                                            value={formData.specialization}
                                            onChange={handleChange}
                                            placeholder="e.g., Geriatric Care"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* ACCOUNT SECURITY */}
                    <div className="form-section">
                        <h3>Step 4: Account Security</h3>
                        
                        <div className="password-generator">
                            <button 
                                type="button" 
                                className="generate-password-btn"
                                onClick={generatePassword}
                            >
                                🔐 Generate Secure Password
                            </button>
                        </div>
                        
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="username">
                                    <FaUserTag /> Username
                                </label>
                                <input
                                    type="text"
                                    id="username"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    placeholder="Auto-generated from email"
                                />
                                <span className="input-hint">Leave blank to auto-generate</span>
                            </div>
                        </div>
                        
                        <div className="form-row">
                            <div className="form-group password-group">
                                <label htmlFor="password">
                                    Password *
                                    {formData.password && (
                                        <span className={`password-strength ${passwordStrength.feedback.toLowerCase()}`}>
                                            Strength: {passwordStrength.feedback}
                                        </span>
                                    )}
                                </label>
                                <div className="password-input-wrapper">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className={errors.password ? 'error' : ''}
                                    />
                                    <button 
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                                {errors.password && <span className="field-error">{errors.password}</span>}
                            </div>
                            
                            <div className="form-group password-group">
                                <label htmlFor="confirmPassword">Confirm Password *</label>
                                <div className="password-input-wrapper">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        className={errors.confirmPassword ? 'error' : ''}
                                    />
                                    <button 
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    >
                                        {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                                {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
                            </div>
                        </div>
                        
                        <div className="password-requirements">
                            <h4>Password Requirements:</h4>
                            <ul>
                                <li className={passwordStrength.requirements.length ? 'met' : ''}>
                                    ✓ At least 8 characters
                                </li>
                                <li className={passwordStrength.requirements.uppercase ? 'met' : ''}>
                                    ✓ At least one uppercase letter
                                </li>
                                <li className={passwordStrength.requirements.lowercase ? 'met' : ''}>
                                    ✓ At least one lowercase letter
                                </li>
                                <li className={passwordStrength.requirements.number ? 'met' : ''}>
                                    ✓ At least one number
                                </li>
                                <li className={passwordStrength.requirements.special ? 'met' : ''}>
                                    ✓ At least one special character (!@#$%^&*)
                                </li>
                            </ul>
                        </div>
                    </div>
                    
                    <div className="form-actions">
                        <button 
                            type="button" 
                            className="cancel-btn"
                            onClick={() => navigate(-1)}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="register-btn"
                            disabled={loading || !isCodeValid}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner"></span>
                                    Registering Staff...
                                </>
                            ) : (
                                'Complete Registration'
                            )}
                        </button>
                    </div>
                </form>
                
                <div className="security-footer">
                    <h4>🔒 Security Protocols:</h4>
                    <ul>
                        <li>Each staff member receives a unique LSAE-#### ID</li>
                        <li>Registration codes are single-use and expire in 72 hours</li>
                        <li>First login requires password change</li>
                        <li>All activities are logged for audit purposes</li>
                        <li>Staff ID badges with QR codes will be issued</li>
                        <li>Emergency contact information is required for all staff</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default StaffRegistration;