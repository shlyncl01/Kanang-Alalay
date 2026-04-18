// DonationPage.js - Complete working version

import React, { useState, useRef } from 'react';
import axios from 'axios';
import '../styles/DonationPage.css';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => `₱${Number(n).toLocaleString()}`;
const today = () => new Date().toISOString().split('T')[0];
const API_BASE = (() => {
  const raw =
    process.env.REACT_APP_API_BASE_URL ||
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://kanang-alalay-backend.onrender.com/api'
      : 'http://localhost:5000/api');
  return raw.replace(/\/api\/?$/, '');
})();

const PRESETS = [500, 1000, 2000, 5000, 10000];
const TIMES = ['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'];

// ── Philippine Mobile Number Validation ──────────────────────────────────────
const validatePhilippineNumber = (raw) => {
  const cleaned = raw.replace(/\D/g, '');
  if (cleaned.length === 10 && cleaned.startsWith('9')) {
    return { isValid: true, e164: `+63${cleaned}` };
  }
  if (cleaned.length === 11 && cleaned.startsWith('09')) {
    return { isValid: true, e164: `+63${cleaned.slice(1)}` };
  }
  if (cleaned.length === 12 && cleaned.startsWith('639')) {
    return { isValid: true, e164: `+63${cleaned.slice(2)}` };
  }
  return { isValid: false, e164: '' };
};

const formatPhoneDisplay = (digits) => {
  if (digits.startsWith('09')) {
    if (digits.length <= 4) return digits;
    if (digits.length <= 7)  return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`;
  }
  if (digits.startsWith('9')) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6)  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
  }
  return digits;
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function DonationPage() {
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    firstName: '', middleName: '', lastName: '', email: '', phone: '',
    amount: '', donationType: 'online',
    notes: '', anonymous: false, appointmentDate: '', appointmentTime: ''
  });
  const [proofFile, setProofFile]       = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [errors, setErrors]             = useState({});
  const [apiError, setApiError]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [receipt, setReceipt]           = useState(null);

  const setFormField = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setAmt = v => { setFormField('amount', v.toString()); setErrors(p => ({ ...p, amount: '' })); };

  const handleChange = e => {
    const { name, value, type, checked } = e.target;

    if (name === 'phone') {
      const digits = value.replace(/\D/g, '');
      if (digits.length > 12) return;
      const display = formatPhoneDisplay(digits);
      setFormField('phone', display);
      setErrors(p => ({ ...p, phone: '' }));
      return;
    }

    setFormField(name, type === 'checkbox' ? checked : value);
    setErrors(p => ({ ...p, [name]: '' }));
  };

  const handleProofUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setErrors(p => ({ ...p, proof: 'Only JPG, PNG, GIF, WEBP, or PDF files are allowed.' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors(p => ({ ...p, proof: 'File must be under 5 MB.' }));
      return;
    }
    setErrors(p => ({ ...p, proof: '' }));
    setProofFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => setProofPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setProofPreview('pdf');
    }
  };

  const removeProof = () => {
    setProofFile(null);
    setProofPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim())  e.lastName  = 'Required';
    if (!form.email.trim())     e.email     = 'Required';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Invalid email';

    if (!form.phone) {
      e.phone = 'Mobile number is required';
    } else {
      const { isValid } = validatePhilippineNumber(form.phone);
      if (!isValid) {
        e.phone = 'Enter a valid PH mobile number (e.g. 09123456789 or 9123456789)';
      }
    }

    if (!form.amount || Number(form.amount) < 100) e.amount = 'Minimum ₱100';

    if (form.donationType === 'cash') {
      if (!form.appointmentDate) e.appointmentDate = 'Required';
      if (!form.appointmentTime) e.appointmentTime = 'Required';
    }

    if (form.donationType === 'online' && !proofFile) {
      e.proof = 'Please upload your QRPH payment screenshot or receipt.';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitDonation = async () => {
    setLoading(true);
    setApiError('');

    try {
      const fullName = `${form.firstName}${form.middleName ? ' ' + form.middleName : ''} ${form.lastName}`.trim();
      const { e164: formattedPhone } = validatePhilippineNumber(form.phone);
      const finalPhone = formattedPhone || form.phone.replace(/\D/g, '');

      const formData = new FormData();
      
      // Append all fields as strings
      formData.append('firstName', form.firstName.trim());
      formData.append('lastName', form.lastName.trim());
      formData.append('donorName', fullName);
      formData.append('email', form.email.trim().toLowerCase());
      formData.append('phone', finalPhone);
      formData.append('donationType', form.donationType);
      formData.append('amount', String(Number(form.amount)));
      
      // Optional fields - always include to avoid undefined
      formData.append('middleName', form.middleName?.trim() || '');
      formData.append('notes', form.notes?.trim() || '');
      formData.append('anonymous', form.anonymous ? 'true' : 'false');
      
      // Payment method for online donations
      if (form.donationType === 'online') {
        formData.append('paymentMethod', 'qrph');
      }
      
      // Appointment for cash donations
      if (form.donationType === 'cash') {
        if (form.appointmentDate) {
          formData.append('appointmentDate', form.appointmentDate);
        }
        if (form.appointmentTime) {
          formData.append('appointmentTime', form.appointmentTime);
        }
      }

      // Attach proof file if provided
      if (proofFile) {
        formData.append('proofOfPayment', proofFile);
      }

      // Debug log
      console.log('=== Sending Donation Data ===');
      for (let pair of formData.entries()) {
        if (pair[0] !== 'proofOfPayment') {
          console.log(`${pair[0]}: "${pair[1]}"`);
        } else {
          console.log(`proofOfPayment: ${pair[1].name} (${pair[1].size} bytes)`);
        }
      }

      const response = await axios.post(`${API_BASE}/api/donations`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000, // 30 second timeout
      });

      console.log('Response:', response.data);

      if (response.data.success) {
        const method = form.donationType === 'online' ? 'QRPH' : 'Cash';
        setReceipt({
          refId: response.data.donationId,
          name: fullName,
          amount: Number(form.amount),
          type: form.donationType,
          method,
          date: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
          email: form.email,
          checkoutUrl: response.data.checkoutUrl,
          proofUploaded: !!proofFile,
        });
        setSubmitted(true);
      } else {
        throw new Error(response.data.message || 'Donation submission failed');
      }
    } catch (err) {
      console.error('Submission error:', err);
      let errorMessage = 'Donation submission failed. Please try again.';
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Please check your connection and try again.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setApiError(errorMessage);
      
      if (err.response?.data) {
        console.error('Server response:', err.response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = e => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;
    submitDonation();
  };

  const resetForm = () => {
    setSubmitted(false);
    setReceipt(null);
    setProofFile(null);
    setProofPreview(null);
    setForm({
      firstName: '', middleName: '', lastName: '', email: '', phone: '',
      amount: '', donationType: 'online',
      notes: '', anonymous: false, appointmentDate: '', appointmentTime: ''
    });
  };

  // ── Success Screen ───────────────────────────────────────────────────────────
  if (submitted && receipt) return (
    <div className="dp-success">
      <div className="dp-success-card">
        <div className="dp-checkmark">✓</div>
        <h2>Thank You, {receipt.name.split(' ')[0]}!</h2>
        <p>Your donation has been received. A confirmation receipt has been sent to your email address.</p>
        <div className="dp-receipt">
          {[
            ['Reference ID', receipt.refId],
            ['Amount',       fmt(receipt.amount)],
            ['Type',         receipt.type.toUpperCase()],
            ['Payment',      receipt.method],
            ['Date',         receipt.date],
          ].map(([l, v]) => (
            <div className="dp-receipt-row" key={l}>
              <span>{l}</span><strong>{v}</strong>
            </div>
          ))}
          {receipt.proofUploaded && (
            <div className="dp-receipt-row">
              <span>Proof</span><strong style={{ color: '#2AA87E' }}>✓ Uploaded</strong>
            </div>
          )}
        </div>
        <div className="dp-btn-row">
          <button className="dp-btn-primary" onClick={resetForm}>Donate Again</button>
          <button className="dp-btn-secondary" onClick={() => window.history.back()}>Go Back</button>
        </div>
      </div>
    </div>
  );

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <div className="dp-shell">

      {/* ── Hero ── */}
      <div className="dp-hero">
        <button className="dp-back" onClick={() => window.history.back()}>←</button>
        <div className="dp-hero-inner">
          <div className="dp-hero-badge"><span />Secure Donations</div>
          <h1>Support Our Mission<br />to Care for the Elderly</h1>
          <p>Every peso you give provides meals, medications, and moments of joy to residents who need it most.</p>
        </div>
      </div>

      {/* ── Body — full-width, no card wrapper ── */}
      <div className="dp-body">

        {/* ── Form Column ── */}
        <div className="dp-form-col">
          {/* API error alert */}
          {apiError && (
            <div className="dp-alert danger" style={{ marginBottom: 20 }}>
              ⚠ {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            {/* ── Donor Information ── */}
            <div className="dp-section-panel">
              <div className="dp-section-label">Donor Information</div>

              <div className="dp-row">
                <div className="dp-group">
                  <label>First Name<span className="req">*</span></label>
                  <input 
                    className={`dp-input${errors.firstName ? ' err' : ''}`}
                    name="firstName" 
                    value={form.firstName} 
                    onChange={handleChange}
                    placeholder="First Name" 
                    disabled={loading} 
                    required
                  />
                  {errors.firstName && <div className="dp-err-msg">{errors.firstName}</div>}
                </div>
                <div className="dp-group">
                  <label>Last Name<span className="req">*</span></label>
                  <input 
                    className={`dp-input${errors.lastName ? ' err' : ''}`}
                    name="lastName" 
                    value={form.lastName} 
                    onChange={handleChange}
                    placeholder="Last Name" 
                    disabled={loading} 
                    required
                  />
                  {errors.lastName && <div className="dp-err-msg">{errors.lastName}</div>}
                </div>
              </div>

              <div className="dp-group">
                <label>Middle Name</label>
                <input 
                  className="dp-input" 
                  name="middleName" 
                  value={form.middleName}
                  onChange={handleChange} 
                  placeholder="Middle Name (Optional)" 
                  disabled={loading} 
                />
              </div>

              <div className="dp-row">
                <div className="dp-group">
                  <label>Email Address<span className="req">*</span></label>
                  <input 
                    className={`dp-input${errors.email ? ' err' : ''}`} 
                    name="email" 
                    type="email"
                    value={form.email} 
                    onChange={handleChange} 
                    placeholder="your@email.com" 
                    disabled={loading} 
                    required
                  />
                  {errors.email && <div className="dp-err-msg">{errors.email}</div>}
                </div>
                <div className="dp-group">
                  <label>Phone Number<span className="req">*</span></label>
                  <input
                    className={`dp-input${errors.phone ? ' err' : ''}`}
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="09123456789"
                    inputMode="numeric"
                    maxLength={14}
                    disabled={loading}
                    required
                  />
                  {errors.phone
                    ? <div className="dp-err-msg">{errors.phone}</div>
                    : <div className="dp-hint phone-hint">✓ Format: 09XXXXXXXXX or 9XXXXXXXXX (PH mobile)</div>
                  }
                </div>
              </div>
            </div>

            {/* ── Donation Type ── */}
            <div className="dp-section-panel">
              <div className="dp-section-label">Donation Type</div>
              <div className="dp-tabs">
                {[
                  { v: 'online', l: '💳 QRPH (Online)' }, 
                  { v: 'cash', l: '💵 In-Person / Cash' }
                ].map(t => (
                  <div 
                    key={t.v} 
                    className={`dp-tab${form.donationType === t.v ? ' active' : ''}`}
                    onClick={() => !loading && setFormField('donationType', t.v)}
                  >
                    {t.l}
                  </div>
                ))}
              </div>

              {/* QRPH QR Code */}
              {form.donationType === 'online' && (
                <div className="dp-qrph-box">
                  <div className="dp-qrph-label">Scan to Pay via QRPH</div>
                  <img src="/images/QRPH.jpg" alt="QRPH QR Code" className="dp-qrph-img" />
                  <div className="dp-qrph-hint">
                    Use any bank app or e-wallet that supports QRPh to scan and complete your donation,
                    then upload your screenshot below.
                  </div>
                </div>
              )}

              {/* Cash Appointment */}
              {form.donationType === 'cash' && (
                <div className="dp-appt-box">
                  <h6>📅 Schedule Your Appointment</h6>
                  <div className="dp-row">
                    <div className="dp-group">
                      <label>Date<span className="req">*</span></label>
                      <input 
                        className={`dp-input${errors.appointmentDate ? ' err' : ''}`}
                        type="date" 
                        name="appointmentDate" 
                        value={form.appointmentDate}
                        onChange={handleChange} 
                        min={today()} 
                        disabled={loading} 
                      />
                      {errors.appointmentDate && <div className="dp-err-msg">{errors.appointmentDate}</div>}
                    </div>
                    <div className="dp-group">
                      <label>Time<span className="req">*</span></label>
                      <select 
                        className={`dp-select${errors.appointmentTime ? ' err' : ''}`}
                        name="appointmentTime" 
                        value={form.appointmentTime}
                        onChange={handleChange} 
                        disabled={loading}
                      >
                        <option value="">Select time</option>
                        {TIMES.map(t => <option key={t}>{t}</option>)}
                      </select>
                      {errors.appointmentTime && <div className="dp-err-msg">{errors.appointmentTime}</div>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Donation Amount ── */}
            <div className="dp-section-panel">
              <div className="dp-section-label">Donation Amount</div>
              <div className="dp-amounts">
                {PRESETS.map(a => (
                  <button 
                    key={a} 
                    type="button"
                    className={`dp-amount-btn${form.amount === a.toString() ? ' active' : ''}`}
                    onClick={() => setAmt(a)} 
                    disabled={loading}
                  >
                    {fmt(a)}
                  </button>
                ))}
              </div>
              <div className="dp-group">
                <label>Custom Amount (PHP)<span className="req">*</span></label>
                <input 
                  className={`dp-input${errors.amount ? ' err' : ''}`}
                  type="number" 
                  name="amount" 
                  value={form.amount}
                  onChange={handleChange} 
                  min="100"
                  placeholder="Enter amount (min ₱100)" 
                  disabled={loading} 
                  required
                />
                {errors.amount && <div className="dp-err-msg">{errors.amount}</div>}
                <div className="dp-hint">Minimum donation: ₱100</div>
              </div>
            </div>

            {/* ── Proof of Payment ── */}
            <div className="dp-section-panel">
              <div className="dp-section-label">
                Proof of Payment
                {form.donationType === 'online' && <span className="req" style={{ marginLeft: 4 }}>*</span>}
              </div>
              <div className={`dp-upload-box${errors.proof ? ' dp-upload-box--err' : ''}`}>
                {!proofFile ? (
                  <label className="dp-upload-label" htmlFor="proofInput">
                    <div className="dp-upload-icon">📎</div>
                    <div className="dp-upload-text">
                      <strong>Upload receipt or screenshot</strong>
                      <span>JPG, PNG, PDF — max 5 MB</span>
                    </div>
                    <input
                      id="proofInput"
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                      onChange={handleProofUpload}
                      disabled={loading}
                      className="dp-upload-input"
                    />
                  </label>
                ) : (
                  <div className="dp-upload-preview">
                    {proofPreview === 'pdf' ? (
                      <div className="dp-upload-pdf-icon">📄</div>
                    ) : (
                      <img src={proofPreview} alt="Proof preview" className="dp-upload-preview-img" />
                    )}
                    <div className="dp-upload-file-info">
                      <strong>{proofFile.name}</strong>
                      <span>{(proofFile.size / 1024).toFixed(0)} KB</span>
                    </div>
                    <button type="button" className="dp-upload-remove" onClick={removeProof} disabled={loading}>✕</button>
                  </div>
                )}
              </div>
              {errors.proof
                ? <div className="dp-err-msg" style={{ marginTop: 6 }}>{errors.proof}</div>
                : <div className="dp-hint" style={{ marginTop: 6 }}>
                    {form.donationType === 'online'
                      ? 'Required — attach your QRPH payment screenshot. It will appear in the donation ledger.'
                      : 'Optional — attach your payment receipt. It will appear in the donation ledger.'}
                  </div>
              }
            </div>

            {/* ── Notes & Anonymous ── */}
            <div className="dp-section-panel">
              <div className="dp-group">
                <label>Message / Notes (Optional)</label>
                <textarea 
                  className="dp-textarea" 
                  name="notes" 
                  value={form.notes}
                  onChange={handleChange} 
                  placeholder="Leave an encouraging message..."
                  disabled={loading} 
                  rows="3"
                />
              </div>

              <div 
                className="dp-toggle-row" 
                onClick={() => !loading && setFormField('anonymous', !form.anonymous)}
                style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                <div className="dp-toggle-content">
                  <div className="dp-toggle-text">Donate Anonymously</div>
                  <div className="dp-toggle-sub">Your name will not appear on public records</div>
                </div>
                <div className={`dp-toggle${form.anonymous ? ' on' : ''}`} />
              </div>

              <button type="submit" className="dp-submit" disabled={loading}>
                {loading
                  ? <><div className="dp-spin" /> Processing…</>
                  : form.donationType === 'online'
                    ? 'Confirm QRPH Donation →'
                    : 'Schedule Appointment →'}
              </button>
            </div>

          </form>
        </div>

        {/* ── Side Summary Column ── */}
        <div className="dp-side-col">
          {form.amount && Number(form.amount) >= 100 && (
            <div className="dp-summary-box dp-summary-panel">
              <h6>Donation Summary</h6>
              {[
                ['Donor', form.anonymous ? 'Anonymous' : `${form.firstName || '—'} ${form.lastName || ''}`.trim()],
                ['Type',  form.donationType === 'online' ? 'QRPH (Online)' : 'Cash (In-person)'],
                ...(form.donationType === 'cash' && form.appointmentDate
                  ? [['Appointment', `${form.appointmentDate}${form.appointmentTime ? ' · ' + form.appointmentTime : ''}`]]
                  : []),
                ...(proofFile ? [['Proof', '✓ ' + proofFile.name.slice(0, 22) + (proofFile.name.length > 22 ? '…' : '')]] : []),
              ].map(([l, v]) => (
                <div className="dp-summary-row" key={l}>
                  <span>{l}</span>
                  <span>{v}</span>
                </div>
              ))}
              <div className="dp-summary-row dp-summary-total">
                <span>Total</span>
                <span>{fmt(form.amount)}</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}