import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './ResetPassword.css'; // Optional: Create for styling

const API_BASE_URL =
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://kanang-alalay-backend.onrender.com/api' : 'http://localhost:5000/api');

const ResetPasswordWithOtp = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const emailFromState = location.state?.email || '';
    
    const [step, setStep] = useState(1); // 1: Enter OTP, 2: Reset Password
    const [formData, setFormData] = useState({
        email: emailFromState,
        otp: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ 
            ...prev, 
            [name]: value 
        }));
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!formData.email) {
            setError('Email is required');
            return;
        }
        
        if (formData.otp.length !== 6) {
            setError('OTP must be 6 digits');
            return;
        }

        setLoading(true);
        
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/verify-reset-otp`, {
                email: formData.email,
                otp: formData.otp
            });
            
            if (response.data.success) {
                setOtpVerified(true);
                setStep(2); // Move to password reset step
                setMessage('OTP verified. Now set your new password.');
            } else {
                setError(response.data.message || 'Invalid OTP');
            }
        } catch (error) {
            setError(error.response?.data?.message || 'OTP verification failed');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!otpVerified) {
            setError('Please verify OTP first');
            return;
        }
        
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        
        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/reset-password-with-otp`, {
                email: formData.email,
                otp: formData.otp,
                password: formData.password
            });
            
            if (response.data.success) {
                setMessage('Password reset successful! Redirecting to login...');
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } else {
                setError(response.data.message || 'Password reset failed');
            }
        } catch (error) {
            setError(error.response?.data?.message || 'Password reset failed');
        } finally {
            setLoading(false);
        }
    };

    const resendOtp = async () => {
        setError('');
        setMessage('Resending OTP...');
        
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/resend-reset-otp`, {
                email: formData.email
            });
            
            if (response.data.success) {
                setMessage('New OTP sent to your email');
            } else {
                setError(response.data.message || 'Failed to resend OTP');
            }
        } catch (error) {
            setError(error.response?.data?.message || 'Failed to resend OTP');
        }
    };

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!formData.email) {
            setError('Please enter your email');
            return;
        }

        setLoading(true);
        
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/forgot-password`, {
                email: formData.email
            });
            
            if (response.data.success) {
                setMessage('OTP sent to your email. Please check and enter below.');
                setStep(1);
            } else {
                setError(response.data.message || 'Failed to send OTP');
            }
        } catch (error) {
            setError(error.response?.data?.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container className="reset-password-container">
            <Row className="justify-content-center">
                <Col md={6} lg={4}>
                    <Card className="reset-password-card">
                        <Card.Body>
                            {!emailFromState && step === 0 ? (
                                // Email Entry Step (if email not passed from login)
                                <>
                                    <h4 className="text-center mb-4">Reset Password</h4>
                                    <p className="text-center mb-4">
                                        Enter your email to receive OTP
                                    </p>
                                    
                                    {error && <Alert variant="danger">{error}</Alert>}
                                    {message && <Alert variant="success">{message}</Alert>}
                                    
                                    <Form onSubmit={handleEmailSubmit}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Email Address</Form.Label>
                                            <Form.Control
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                required
                                                placeholder="Enter your email"
                                            />
                                        </Form.Group>
                                        
                                        <Button 
                                            type="submit" 
                                            variant="primary" 
                                            className="w-100 mb-3"
                                            disabled={loading}
                                        >
                                            {loading ? 'Sending OTP...' : 'Send OTP'}
                                        </Button>
                                        
                                        <Button 
                                            type="button" 
                                            variant="outline-secondary" 
                                            className="w-100"
                                            onClick={() => navigate('/login')}
                                        >
                                            Back to Login
                                        </Button>
                                    </Form>
                                </>
                            ) : step === 1 ? (
                                // OTP Verification Step
                                <>
                                    <h4 className="text-center mb-4">Verify OTP</h4>
                                    <p className="text-center mb-4">
                                        Enter the 6-digit OTP sent to<br />
                                        <strong>{formData.email}</strong>
                                    </p>
                                    
                                    {error && <Alert variant="danger">{error}</Alert>}
                                    {message && <Alert variant="success">{message}</Alert>}
                                    
                                    <Form onSubmit={handleOtpSubmit}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>6-digit OTP</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="otp"
                                                value={formData.otp}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                                    setFormData(prev => ({ ...prev, otp: value }));
                                                }}
                                                required
                                                placeholder="Enter 6-digit OTP"
                                                maxLength="6"
                                                pattern="\d{6}"
                                            />
                                            <Form.Text className="text-muted">
                                                OTP expires in 15 minutes
                                            </Form.Text>
                                        </Form.Group>
                                        
                                        <div className="mb-3 text-center">
                                            <Button 
                                                variant="link" 
                                                onClick={resendOtp}
                                                disabled={loading}
                                            >
                                                Resend OTP
                                            </Button>
                                        </div>
                                        
                                        <Button 
                                            type="submit" 
                                            variant="primary" 
                                            className="w-100 mb-3"
                                            disabled={loading || formData.otp.length !== 6}
                                        >
                                            {loading ? 'Verifying...' : 'Verify OTP'}
                                        </Button>
                                        
                                        <div className="d-flex gap-2">
                                            <Button 
                                                type="button" 
                                                variant="outline-secondary" 
                                                className="w-50"
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, email: '', otp: '' }));
                                                    setStep(0);
                                                }}
                                            >
                                                Change Email
                                            </Button>
                                            <Button 
                                                type="button" 
                                                variant="outline-secondary" 
                                                className="w-50"
                                                onClick={() => navigate('/login')}
                                            >
                                                Back to Login
                                            </Button>
                                        </div>
                                    </Form>
                                </>
                            ) : (
                                // Password Reset Step
                                <>
                                    <h4 className="text-center mb-4">Set New Password</h4>
                                    <p className="text-center mb-4">
                                        For account: <strong>{formData.email}</strong>
                                    </p>
                                    
                                    {error && <Alert variant="danger">{error}</Alert>}
                                    {message && <Alert variant="success">{message}</Alert>}
                                    
                                    <Form onSubmit={handlePasswordSubmit}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>New Password</Form.Label>
                                            <Form.Control
                                                type="password"
                                                name="password"
                                                value={formData.password}
                                                onChange={handleChange}
                                                required
                                                placeholder="Enter new password"
                                                minLength="6"
                                            />
                                            <Form.Text className="text-muted">
                                                Minimum 6 characters
                                            </Form.Text>
                                        </Form.Group>
                                        
                                        <Form.Group className="mb-4">
                                            <Form.Label>Confirm Password</Form.Label>
                                            <Form.Control
                                                type="password"
                                                name="confirmPassword"
                                                value={formData.confirmPassword}
                                                onChange={handleChange}
                                                required
                                                placeholder="Confirm new password"
                                                minLength="6"
                                            />
                                        </Form.Group>
                                        
                                        <Button 
                                            type="submit" 
                                            variant="primary" 
                                            className="w-100 mb-3"
                                            disabled={loading}
                                        >
                                            {loading ? 'Resetting...' : 'Reset Password'}
                                        </Button>
                                        
                                        <Button 
                                            type="button" 
                                            variant="outline-secondary" 
                                            className="w-100"
                                            onClick={() => setStep(1)}
                                        >
                                            Back to OTP
                                        </Button>
                                    </Form>
                                </>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default ResetPasswordWithOtp;