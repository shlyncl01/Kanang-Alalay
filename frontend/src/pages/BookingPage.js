import React, { useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/BookingPage.css';

// ── helpers ───────────────────────────────────────────────────────────────────
const uid = () => 'BK-' + Math.random().toString(36).slice(2, 9).toUpperCase();
const API_BASE = (() => {
    const raw =
        process.env.REACT_APP_API_BASE_URL ||
        process.env.REACT_APP_API_URL ||
        (process.env.NODE_ENV === 'production' ? 'https://kanang-alalay-backend.onrender.com/api' : 'http://localhost:5000/api');
    return raw.replace(/\/api\/?$/, '');
})();

const TIME_SLOTS = [
    { value: '09:00', label: '9:00 AM' },
    { value: '10:00', label: '10:00 AM' },
    { value: '11:00', label: '11:00 AM' },
    { value: '13:00', label: '1:00 PM' },
    { value: '14:00', label: '2:00 PM' },
    { value: '15:00', label: '3:00 PM' },
    { value: '16:00', label: '4:00 PM' },
];

const PURPOSES = [
    { value: 'tour',     label: 'Facility Tour' },
    { value: 'volunteer',label: 'Volunteer Inquiry' },
    { value: 'donation', label: 'Donation Delivery' },
    { value: 'meeting',  label: 'Administrative Meeting' },
];

const GUIDELINES = [
    { text: 'Monday – Friday, 9:00 AM – 4:00 PM' },
    { text: 'Please arrive 10 minutes early' },
    { text: 'Maximum of 10 visitors per group' },
    { text: 'Valid ID required upon arrival' },
    { text: 'No photography without permission' },
];

// ── Main Component ────────────────────────────────────────────────────────────
const BookingPage = () => {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        firstName: '',
        middleName: '',
        lastName: '',
        email: '',
        phone: '',
        visitTime: '09:00',
        purpose: 'tour',
        numberOfVisitors: 1,
        notes: '',
    });

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [errors, setErrors]     = useState({});
    const [apiError, setApiError] = useState('');
    const [loading, setLoading]   = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [receipt, setReceipt]   = useState(null);

    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleChange = e => {
        const { name, value } = e.target;
        if (name === 'phone') {
            const v = value.replace(/\D/g, '');
            if (v.length <= 11) set(name, v);
            return;
        }
        if (name === 'numberOfVisitors') {
            const n = Math.max(1, Math.min(10, Number(value)));
            set(name, n);
            return;
        }
        set(name, value);
        setErrors(p => ({ ...p, [name]: '' }));
    };

    const handleDateChange = date => {
        setSelectedDate(date);
        setErrors(p => ({ ...p, visitDate: '' }));
    };

    const validate = () => {
        const e = {};
        if (!form.firstName.trim()) e.firstName = 'Required';
        if (!form.lastName.trim())  e.lastName  = 'Required';
        if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email';
        if (!form.phone || form.phone.length < 10) e.phone = 'Enter a valid phone number';
        if (!selectedDate) e.visitDate = 'Please select a date';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async e => {
        e.preventDefault();
        setApiError('');
        if (!validate()) return;

        setLoading(true);
        try {
            const fullName = [form.firstName, form.middleName, form.lastName]
                .filter(Boolean).join(' ');

            const submissionData = {
                ...form,
                name: fullName,
                visitDate: selectedDate.toISOString(),
            };

            await axios.post(`${API_BASE}/api/bookings`, submissionData);

            setReceipt({
                refId: uid(),
                name: fullName,
                date: selectedDate.toLocaleDateString('en-PH', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                }),
                time: TIME_SLOTS.find(t => t.value === form.visitTime)?.label || form.visitTime,
                purpose: PURPOSES.find(p => p.value === form.purpose)?.label || form.purpose,
                visitors: form.numberOfVisitors,
            });
            setSubmitted(true);
        } catch (err) {
            console.error('Booking submission error:', err);
            setApiError(err.response?.data?.message || 'Booking failed. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    // ── helpers for live summary ──────────────────────────────────────────────
    const purposeLabel = PURPOSES.find(p => p.value === form.purpose)?.label || '—';
    const timeLabel    = TIME_SLOTS.find(t => t.value === form.visitTime)?.label || '—';
    const fullName     = [form.firstName, form.lastName].filter(Boolean).join(' ') || '—';
    const hasData      = form.firstName || form.email || form.phone;

    // ── Success Screen ────────────────────────────────────────────────────────
    if (submitted && receipt) return (
        <div className="bp-success">
            <div className="bp-success-card">
                <div className="bp-checkmark">✓</div>
                <h2>Booking Submitted!</h2>
                <p>
                    Your visit request has been received. We'll send a confirmation to
                    your email once it's approved.
                </p>
                <div className="bp-receipt">
                    {[
                        ['Reference',  receipt.refId],
                        ['Name',       receipt.name],
                        ['Date',       receipt.date],
                        ['Time',       receipt.time],
                        ['Purpose',    receipt.purpose],
                        ['Visitors',   receipt.visitors],
                    ].map(([l, v]) => (
                        <div className="bp-receipt-row" key={l}>
                            <span>{l}</span>
                            <strong>{v}</strong>
                        </div>
                    ))}
                </div>
                <div className="bp-btn-row">
                    <button
                        className="bp-btn-primary"
                        onClick={() => {
                            setSubmitted(false);
                            setForm(p => ({
                                ...p, firstName: '', lastName: '', middleName: '',
                                email: '', phone: '', notes: '', numberOfVisitors: 1,
                            }));
                            setSelectedDate(new Date());
                        }}
                    >
                        Book Again
                    </button>
                    <button className="bp-btn-secondary" onClick={() => navigate('/')}>
                        Go Home
                    </button>
                </div>
            </div>
        </div>
    );

    // ── Main Form ─────────────────────────────────────────────────────────────
    return (
        <div className="bp-shell">

            {/* ── Hero ── */}
            <div className="bp-hero">
                <button className="bp-back" onClick={() => navigate('/')}>←</button>
                <div className="bp-hero-inner">
                    <div className="bp-hero-badge"><span />Visit Scheduling</div>
                    <h1>Book a Visit<br />to Our Facility</h1>
                    <p>Schedule a tour, drop off a donation, or meet with our team. We'd love to welcome you.</p>
                    <div className="bp-hero-stats">
                        <div>
                            <div className="bp-stat-val">Mon–Fri</div>
                            <div className="bp-stat-lbl">Open Days</div>
                        </div>
                        <div>
                            <div className="bp-stat-val">9 AM – 4 PM</div>
                            <div className="bp-stat-lbl">Operating Hours</div>
                        </div>
                        <div>
                            <div className="bp-stat-val">≤ 10</div>
                            <div className="bp-stat-lbl">Visitors / Group</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Body ── */}
            <div className="bp-body">

                {/* ── Form Column ── */}
                <div className="bp-form-col">
                    <div className="bp-card">
                        <div className="bp-card-body">

                            {apiError && (
                                <div className="bp-alert danger">⚠ {apiError}</div>
                            )}

                            <form onSubmit={handleSubmit} noValidate>

                                {/* Visitor Information */}
                                <div className="bp-section-label">Visitor Information</div>

                                <div className="bp-row">
                                    {[
                                        { name: 'firstName',  label: 'First Name',  req: true  },
                                        { name: 'middleName', label: 'Middle Name', req: false },
                                        { name: 'lastName',   label: 'Last Name',   req: true  },
                                    ].map(({ name, label, req }) => (
                                        <div className="bp-group" key={name}>
                                            <label>
                                                {label}
                                                {req && <span className="req">*</span>}
                                            </label>
                                            <input
                                                className={`bp-input${errors[name] ? ' err' : ''}`}
                                                name={name}
                                                value={form[name]}
                                                onChange={handleChange}
                                                placeholder={req ? label : 'Optional'}
                                                disabled={loading}
                                            />
                                            {errors[name] && <div className="bp-err-msg">{errors[name]}</div>}
                                        </div>
                                    ))}
                                </div>

                                <div className="bp-row">
                                    <div className="bp-group">
                                        <label>Email Address<span className="req">*</span></label>
                                        <input
                                            className={`bp-input${errors.email ? ' err' : ''}`}
                                            type="email" name="email"
                                            value={form.email} onChange={handleChange}
                                            placeholder="your@email.com" disabled={loading}
                                        />
                                        {errors.email && <div className="bp-err-msg">{errors.email}</div>}
                                    </div>
                                    <div className="bp-group">
                                        <label>Phone Number<span className="req">*</span></label>
                                        <input
                                            className={`bp-input${errors.phone ? ' err' : ''}`}
                                            name="phone" value={form.phone}
                                            onChange={handleChange} placeholder="09XXXXXXXXX"
                                            maxLength={11} disabled={loading}
                                        />
                                        {errors.phone && <div className="bp-err-msg">{errors.phone}</div>}
                                    </div>
                                </div>

                                {/* Visit Details */}
                                <div className="bp-section-label" style={{ marginTop: 8 }}>Visit Details</div>

                                <div className="bp-row">
                                    <div className="bp-group">
                                        <label>Purpose of Visit<span className="req">*</span></label>
                                        <select
                                            className="bp-select" name="purpose"
                                            value={form.purpose} onChange={handleChange}
                                            disabled={loading}
                                        >
                                            {PURPOSES.map(p => (
                                                <option key={p.value} value={p.value}>{p.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="bp-group">
                                        <label>Preferred Time<span className="req">*</span></label>
                                        <select
                                            className="bp-select" name="visitTime"
                                            value={form.visitTime} onChange={handleChange}
                                            disabled={loading}
                                        >
                                            {TIME_SLOTS.map(t => (
                                                <option key={t.value} value={t.value}>{t.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="bp-row">
                                    <div className="bp-group" style={{ maxWidth: 200 }}>
                                        <label>Number of Visitors<span className="req">*</span></label>
                                        <input
                                            className="bp-input" type="number"
                                            name="numberOfVisitors" min="1" max="10"
                                            value={form.numberOfVisitors}
                                            onChange={handleChange} disabled={loading}
                                        />
                                        <div className="bp-hint">Max 10 per group</div>
                                    </div>
                                </div>

                                {/* Calendar */}
                                <div className="bp-section-label" style={{ marginTop: 8 }}>Select Date<span className="req" style={{ fontSize: 14 }}>*</span></div>
                                {errors.visitDate && <div className="bp-err-msg" style={{ marginBottom: 8 }}>⚠ {errors.visitDate}</div>}
                                <div className="bp-cal-wrap">
                                    <Calendar
                                        value={selectedDate}
                                        onChange={handleDateChange}
                                        minDate={new Date()}
                                    />
                                    {selectedDate && (
                                        <div className="bp-cal-selected-label">
                                            {selectedDate.toLocaleDateString('en-PH', {
                                                weekday: 'long', year: 'numeric',
                                                month: 'long', day: 'numeric',
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Notes */}
                                <div className="bp-group" style={{ marginTop: 24 }}>
                                    <label>Additional Notes (Optional)</label>
                                    <textarea
                                        className="bp-textarea" name="notes"
                                        value={form.notes} onChange={handleChange}
                                        placeholder="Special requests or additional information…"
                                        disabled={loading}
                                    />
                                </div>

                                <button type="submit" className="bp-submit" disabled={loading}>
                                    {loading
                                        ? <><div className="bp-spin" />Submitting Request…</>
                                        : 'Submit Booking →'}
                                </button>

                            </form>
                        </div>
                    </div>
                </div>

                {/* ── Side Column ── */}
                <div className="bp-side-col">

                    {/* Live Booking Summary */}
                    {hasData && (
                        <div className="bp-card">
                            <div className="bp-summary-box">
                                <h6>Booking Summary</h6>
                                {[
                                    ['Visitor',   fullName],
                                    ['Purpose',   purposeLabel],
                                    ['Date',      selectedDate
                                        ? selectedDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                                        : '—'],
                                    ['Time',      timeLabel],
                                    ['Group',     `${form.numberOfVisitors} visitor${form.numberOfVisitors > 1 ? 's' : ''}`],
                                ].map(([l, v]) => (
                                    <div className="bp-summary-row" key={l}>
                                        <span>{l}</span>
                                        <span>{v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Visit Guidelines */}
                    <div className="bp-card">
                        <div className="bp-guidelines">
                            <h5>Visit Guidelines</h5>
                            <ul className="bp-guidelines-list">
                                {GUIDELINES.map((g, i) => (
                                    <li key={i}>
                                        <div className="bp-guideline-icon">{g.icon}</div>
                                        <span>{g.text}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default BookingPage;