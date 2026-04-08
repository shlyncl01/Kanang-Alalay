import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, Alert, Spinner } from 'react-bootstrap';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const VerifyEmail = () => {
    const { token } = useParams();
    const [status, setStatus] = useState('verifying');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const verifyEmail = async () => {
            try {
                const response = await axios.get(`https://kanang-alalay-backend.onrender.com/api/auth/verify-email/${token}`);
                setStatus('success');
                setMessage(response.data.message);
            } catch (error) {
                setStatus('error');
                setMessage(error.response?.data?.message || 'Verification failed');
            }
        };

        verifyEmail();
    }, [token]);

    return (
        <Container className="my-5">
            <Row className="justify-content-center">
                <Col md={6} lg={4}>
                    <Card className="text-center">
                        <Card.Body>
                            {status === 'verifying' && (
                                <>
                                    <Spinner animation="border" className="mb-3" />
                                    <h5>Verifying your email...</h5>
                                </>
                            )}
                            
                            {status === 'success' && (
                                <>
                                    <div className="text-success mb-3" style={{ fontSize: '3rem' }}>
                                        ✓
                                    </div>
                                    <h5>Email Verified!</h5>
                                    <p className="mb-4">{message}</p>
                                    <Link to="/login" className="btn btn-primary">
                                        Go to Login
                                    </Link>
                                </>
                            )}
                            
                            {status === 'error' && (
                                <>
                                    <div className="text-danger mb-3" style={{ fontSize: '3rem' }}>
                                        ✗
                                    </div>
                                    <h5>Verification Failed</h5>
                                    <Alert variant="danger" className="mb-4">
                                        {message}
                                    </Alert>
                                    <Link to="/login" className="btn btn-secondary">
                                        Back to Login
                                    </Link>
                                </>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default VerifyEmail;
