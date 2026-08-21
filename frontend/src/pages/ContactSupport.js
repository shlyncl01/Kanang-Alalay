import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    FaArrowLeft, FaHeadset, FaPaperPlane, FaCheckCircle,
    FaExclamationCircle, FaEnvelope, FaPhone
} from 'react-icons/fa';
import '../styles/ContactSupport.css';

const API_BASE_URL =
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production'
        ? 'https://kanang-alalay-backend.onrender.com/api'
        : 'http://localhost:5000/api');

const CATEGORIES = [
    'Login / Account access',
    'Bug or error',
    'Feature question',
    'Data issue',
    'Other',
];

const ContactSupport = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Contact Support is reached only from Help Center, so back always
    // returns there. replace:true drops this page from history the same
    // way Profile/Help Center do, so it can't be re-entered via
    // forward/back once the user has left it.
    const goBack = () => navigate('/help', { replace: true });

    const [category, setCategory] = useState(CATEGORIES[0]);
    const [subject, setSubject]   = useState('');
    const [message, setMessage]   = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState(null); // 'success' | 'error' | null
    const [statusMsg, setStatusMsg] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!subject.trim() || !message.trim()) {
            setStatus('error');
            setStatusMsg('Please fill in both a subject and a message.');
            return;
        }

        setSubmitting(true);
        setStatus(null);
        const token = localStorage.getItem('token');

        try {
            const res = await fetch(`${API_BASE_URL}/support/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ category, subject, message }),
            });
            const data = await res.json();

            if (res.ok && data.success) {
                setStatus('success');
                setStatusMsg("Thanks — your message has been sent. We'll get back to you soon.");
                setSubject('');
                setMessage('');
                setCategory(CATEGORIES[0]);
            } else {
                setStatus('error');
                setStatusMsg(data.message || 'Something went wrong sending your message. Please try again.');
            }
        } catch {
            setStatus('error');
            setStatusMsg('Could not reach the server. Please check your connection and try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="page-wrapper">
            <div className="content-container">
                <div className="page-header">
                    <button className="back-btn" onClick={goBack}>
                        <FaArrowLeft /> Back
                    </button>
                    <h2>Contact Support</h2>
                </div>

                <div className="help-hero-banner">
                    <FaHeadset className="hero-icon" />
                    <h1>Need a hand?</h1>
                    <p>Send a message to the master administrator and we'll follow up by email.</p>
                </div>

                <div className="contact-card">
                    {status && (
                        <div className={`contact-status-banner ${status}`}>
                            {status === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />}
                            <span>{statusMsg}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="contact-form">
                        <div className="contact-field">
                            <label>Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                disabled={submitting}
                            >
                                {CATEGORIES.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <div className="contact-field">
                            <label>Subject</label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Briefly describe the issue"
                                disabled={submitting}
                                maxLength={120}
                            />
                        </div>

                        <div className="contact-field">
                            <label>Message</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Tell us what's happening — the more detail, the faster we can help."
                                rows={6}
                                disabled={submitting}
                            />
                        </div>

                        <div className="contact-sender-note">
                            Sending as <strong>{user?.firstName} {user?.lastName}</strong>
                            {user?.email && <> · {user.email}</>}
                            {user?.staffId && <> · ID: {user.staffId}</>}
                        </div>

                        <button type="submit" className="brand-btn" disabled={submitting}>
                            <FaPaperPlane /> {submitting ? 'Sending…' : 'Send Message'}
                        </button>
                    </form>

                    <div className="contact-alt-methods">
                        <div className="contact-alt-item">
                            <FaEnvelope />
                            <a href="mailto:support@kanangalalay.org">support@kanangalalay.org</a>
                        </div>
                        <div className="contact-alt-item">
                            <FaPhone />
                            <span>Prefer to call? Reach your facility admin directly.</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactSupport;