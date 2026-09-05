import React, { useState, useRef } from 'react';
import axios from 'axios';
import '../styles/DonationPage.css';
import { API_URL } from '../config/api';

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => `₱${Number(n).toLocaleString()}`;
const today = () => new Date().toISOString().split('T')[0];

const PRESETS = [500, 1000, 2000, 5000, 10000];
const TIMES   = ['9:00 AM - 11:00 AM', '3:00 PM - 5:00 PM'];

// ── Philippine Mobile Number Validation ──────────────────────────────────────
const validatePhilippineNumber = (raw) => {
  const cleaned = raw.replace(/\D/g, '');
  if (cleaned.length === 10 && cleaned.startsWith('9'))   return { isValid: true, e164: `+63${cleaned}` };
  if (cleaned.length === 11 && cleaned.startsWith('09'))  return { isValid: true, e164: `+63${cleaned.slice(1)}` };
  if (cleaned.length === 12 && cleaned.startsWith('639')) return { isValid: true, e164: `+63${cleaned.slice(2)}` };
  return { isValid: false, e164: '' };
};

const formatPhoneDisplay = (digits) => {
  if (digits.startsWith('09')) {
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`;
  }
  if (digits.startsWith('9')) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
  }
  return digits;
};

// ── Confirmation Modal ────────────────────────────────────────────────────────
const ConfirmModal = ({ data, onConfirm, onCancel, loading }) => (
  <div className="dp-modal-overlay">
    <div className="dp-modal">
      <h3 className="dp-modal-title">Review Your Donation</h3>
      <p className="dp-modal-subtitle">Please confirm your donation details before submitting.</p>
      <div className="dp-modal-rows">
        {[
          ['Donor',       data.donorName],
          ...(data.anonymous ? [] : [['Email', data.email]]),
          ['Phone',       data.phone],
          ['Type',        data.typeLabel],
          ...(data.donationType === 'online' ? [
            ['Amount',    fmt(data.amount)],
            ['Payment',   'QRPH'],
            ['Proof',     data.proofName || '—'],
          ] : [
            ['Amount',    data.amount > 0 ? fmt(data.amount) : 'To be specified'],
            ['Date',      data.appointmentDate],
            ['Time',      data.appointmentTime],
          ]),
          ...(data.notes ? [['Notes', data.notes]] : []),
          ['Anonymous',   data.anonymous ? 'Yes' : 'No'],
        ].map(([label, value]) => (
          <div className="dp-modal-row" key={label}>
            <span className="dp-modal-label">{label}</span>
            <span className="dp-modal-value">{value}</span>
          </div>
        ))}
      </div>
      <div className="dp-modal-actions">
        <button className="dp-modal-cancel" onClick={onCancel} disabled={loading}>
          Go Back
        </button>
        <button className="dp-modal-confirm" onClick={onConfirm} disabled={loading}>
          {loading
            ? <><div className="dp-spin" /> Processing…</>
            : data.donationType === 'online' ? 'Confirm Donation' : 'Confirm Appointment'}
        </button>
      </div>
    </div>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
export default function DonationPage() {
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    firstName: '', middleName: '', lastName: '', email: '', phone: '',
    amount: '', donationType: 'online',
    notes: '', anonymous: false, appointmentDate: '', appointmentTime: ''
  });
  const [proofFile, setProofFile]           = useState(null);
  const [proofPreview, setProofPreview]     = useState(null);
  const [errors, setErrors]                 = useState({});
  const [apiError, setApiError]             = useState('');
  const [loading, setLoading]               = useState(false);
  const [submitted, setSubmitted]           = useState(false);
  const [receipt, setReceipt]               = useState(null);
  const [showModal, setShowModal]           = useState(false);
  const [modalData, setModalData]           = useState(null);
  const [aiVerifying, setAiVerifying]       = useState(false);
  const [aiResult, setAiResult]             = useState(null);


  const verifyReceiptWithAI = async (file, dataUrl) => {
    if (!file.type.startsWith('image/')) {
      setAiResult({ valid: null, confidence: 'low', reason: 'PDF uploaded — needs manual review', details: 'PDF receipts cannot be auto-verified by our AI. Our team will review it manually.' });
      return;
    }
    setAiVerifying(true);
    setAiResult(null);
    try {
      const base64 = dataUrl.split(',')[1];
      const mediaType = file.type;
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              {
                type: 'text',
                text: `You are a payment receipt verification assistant for a Philippine charity called Kanang-Alalay.

Analyze this image and determine if it is a genuine payment receipt or proof of payment (e.g. GCash, Maya, bank transfer, QRPH transaction screenshot, online banking confirmation, or similar Philippine payment platforms).

Respond ONLY with a JSON object — no markdown, no explanation outside the JSON:
{
  "valid": true or false or null,
  "confidence": "high" or "medium" or "low",
  "reason": "one short sentence max 12 words explaining your decision",
  "details": "one to two sentences with specific observations"
}

Rules:
- valid true means looks like a real receipt or transaction confirmation
- valid false means clearly not a receipt such as a selfie meme random photo blank image or screenshot of something unrelated
- valid null means unclear or ambiguous and needs manual review
- confidence reflects how certain you are
- Be lenient: a simple transaction screenshot with an amount and reference number counts
- Do NOT require personal data to be visible`
              }
            ]
          }]
        })
      });
      if (!response.ok) throw new Error('AI service unavailable');
      const data = await response.json();
      const text = data.content?.find(b => b.type === 'text')?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setAiResult(parsed);
    } catch (err) {
      console.warn('AI receipt verification failed:', err);
      setAiResult({ valid: null, confidence: 'low', reason: 'Verification unavailable', details: 'Could not auto-verify this image. Our team will review it manually.' });
    } finally {
      setAiVerifying(false);
    }
  };

  const setFormField = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setAmt = v => { setFormField('amount', v.toString()); setErrors(p => ({ ...p, amount: '' })); };

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    if (name === 'phone') {
      const digits = value.replace(/\D/g, '');
      if (digits.length > 12) return;
      setFormField('phone', formatPhoneDisplay(digits));
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
    setAiResult(null);
    setProofFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => {
        setProofPreview(ev.target.result);
        verifyReceiptWithAI(file, ev.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      setProofPreview('pdf');
      verifyReceiptWithAI(file, null);
    }
  };

  const removeProof = () => {
    setProofFile(null);
    setProofPreview(null);
    setAiResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ✅ FIXED: validate() now respects anonymous flag
  const validate = () => {
    const e = {};
    
    // Skip personal fields if anonymous is true
    if (!form.anonymous) {
      if (!form.firstName.trim()) e.firstName = 'Required';
      if (!form.lastName.trim())  e.lastName  = 'Required';
      if (!form.email.trim())     e.email     = 'Required';
      else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Invalid email';
    }

    // Phone is ALWAYS required
    if (!form.phone) {
      e.phone = 'Mobile number is required';
    } else {
      const { isValid } = validatePhilippineNumber(form.phone);
      if (!isValid) e.phone = 'Enter a valid PH mobile number (e.g. 09123456789 or 9123456789)';
    }

    // Amount and proof only required for online
    if (form.donationType === 'online') {
      if (!form.amount || Number(form.amount) < 100) e.amount = 'Minimum ₱100';
      if (!proofFile) e.proof = 'Please upload your QRPH payment screenshot or receipt.';
    }

    // Cash: appointment required (amount is optional)
    if (form.donationType === 'cash') {
      if (!form.appointmentDate) e.appointmentDate = 'Required';
      if (!form.appointmentTime) e.appointmentTime = 'Required';
      // Amount is optional for cash, but if provided must be positive
      if (form.amount && Number(form.amount) < 0) {
        e.amount = 'Amount must be positive';
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = e => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;

    const fullName = `${form.firstName}${form.middleName ? ' ' + form.middleName : ''} ${form.lastName}`.trim();
    const { e164: formattedPhone } = validatePhilippineNumber(form.phone);

    // For cash donations, amount can be 0 if not specified
    let donationAmount = Number(form.amount);
    if (form.donationType === 'cash' && (!form.amount || form.amount === '')) {
      donationAmount = 0;
    }

    setModalData({
      firstName:       form.firstName.trim(),
      middleName:      form.middleName?.trim() || '',
      lastName:        form.lastName.trim(),
      donorName:       form.anonymous ? 'Anonymous Donor' : fullName,
      email:           form.email.trim().toLowerCase(),
      phone:           formattedPhone || form.phone.replace(/\D/g, ''),
      donationType:    form.donationType,
      typeLabel:       form.donationType === 'online' ? 'QRPH (Online)' : 'Cash (In-person)',
      amount:          donationAmount,
      appointmentDate: form.appointmentDate,
      appointmentTime: form.appointmentTime,
      notes:           form.notes?.trim() || '',
      anonymous:       form.anonymous,
      proofName:       proofFile ? proofFile.name : null,
    });
    setShowModal(true);
  };

  // ✅ FIXED: handleConfirm() now preserves anonymous donor name
  const handleConfirm = async () => {
    setLoading(true);
    setApiError('');
    try {
      const formData = new FormData();

      // ✅ Key fix: Check anonymous flag and use appropriate values
      if (modalData.anonymous) {
        // For anonymous donations: use placeholder values
        formData.append('firstName', 'Anonymous');
        formData.append('lastName', 'Donor');
        formData.append('middleName', '');
        formData.append('email', 'anonymous@kanangalalay.org');
        formData.append('donorName', 'Anonymous Donor');
      } else {
        // For normal donations: use actual info
        formData.append('firstName', modalData.firstName);
        formData.append('lastName', modalData.lastName);
        formData.append('middleName', modalData.middleName);
        formData.append('email', modalData.email);
        formData.append('donorName', modalData.donorName);
      }

      formData.append('phone', modalData.phone);
      formData.append('donationType', modalData.donationType);
      formData.append('notes', modalData.notes);
      formData.append('anonymous', modalData.anonymous ? 'true' : 'false');

      if (modalData.donationType === 'online') {
        formData.append('amount', String(modalData.amount));
        formData.append('paymentMethod', 'qrph');
        if (proofFile) formData.append('proofOfPayment', proofFile);
      }

      if (modalData.donationType === 'cash') {
        formData.append('amount', String(modalData.amount));
        formData.append('paymentMethod', 'cash');
        if (modalData.appointmentDate) formData.append('appointmentDate', modalData.appointmentDate);
        if (modalData.appointmentTime) formData.append('appointmentTime', modalData.appointmentTime);
      }

      console.log('Submitting form data for:', modalData.donationType);
      for (let pair of formData.entries()) {
        console.log(pair[0] + ': ' + pair[1]);
      }

      const response = await axios.post(`${API_URL}/donations`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      if (response.data.success) {
        setReceipt({
          donationId:      response.data.donationId,
          donorName:       modalData.donorName,
          email:           modalData.email,
          amount:          modalData.amount,
          donationType:    modalData.donationType,
          appointmentDate: modalData.appointmentDate,
          appointmentTime: modalData.appointmentTime,
          anonymous:       modalData.anonymous,
        });
        setShowModal(false);
        setSubmitted(true);
      } else {
        throw new Error(response.data.message || 'Donation submission failed.');
      }
    } catch (err) {
      console.error('Donation error:', err);
      console.error('Error response:', err.response?.data);
      setApiError(
        err.response?.data?.message ||
        err.message ||
        'Unable to process donation. Please try again.'
      );
      setShowModal(false);
    } finally {
      setLoading(false);
    }
  };

  // ── Success Screen ────────────────────────────────────────────────────────
  if (submitted && receipt) {
    return (
      <div className="dp-success">
        <div className="dp-success-card">
          <div className="dp-checkmark">&#10003;</div>
          <h2>Thank You for Your Generosity!</h2>
          <p>
            Your {receipt.donationType === 'cash' ? 'in-person donation appointment' : 'donation'} has been received.
            {' '}A confirmation email has been sent to <strong>{receipt.email}</strong>.
          </p>
          <div className="dp-receipt">
            <div className="dp-receipt-row">
              <span>Donation ID</span>
              <strong>{receipt.donationId}</strong>
            </div>
            <div className="dp-receipt-row">
              <span>Donor</span>
              <strong>{receipt.donorName}</strong>
            </div>
            {receipt.donationType === 'online' && (
              <div className="dp-receipt-row">
                <span>Amount</span>
                <strong>{fmt(receipt.amount)}</strong>
              </div>
            )}
            {receipt.donationType === 'cash' && receipt.amount > 0 && (
              <div className="dp-receipt-row">
                <span>Amount</span>
                <strong>{fmt(receipt.amount)}</strong>
              </div>
            )}
            <div className="dp-receipt-row">
              <span>Type</span>
              <strong>{receipt.donationType === 'online' ? 'QRPH (Online)' : 'Cash (In-person)'}</strong>
            </div>
            {receipt.donationType === 'cash' && receipt.appointmentDate && (
              <div className="dp-receipt-row">
                <span>Appointment</span>
                <strong>{receipt.appointmentDate} · {receipt.appointmentTime}</strong>
              </div>
            )}
          </div>
          <div className="dp-btn-row">
            <button className="dp-btn-primary" onClick={() => window.location.href = '/'}>
              Back to Home
            </button>
            <button className="dp-btn-secondary" onClick={() => window.print()}>
              Print Receipt
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Form ────────────────────────────────────────────────────────────────
  return (
    <div className="dp-page">
      {showModal && modalData && <ConfirmModal data={modalData} onConfirm={handleConfirm} onCancel={() => setShowModal(false)} loading={loading} />}
      {apiError && <div className="dp-api-err">{apiError}</div>}

      <div className="dp-container">
        <div className="dp-card">
          <div className="dp-header">
            <h1 className="dp-title">Make a Donation</h1>
            <p className="dp-subtitle">Every contribution helps our mission to care for the abandoned elderly. Thank you for your generosity.</p>
          </div>

          <form onSubmit={handleSubmit} className="dp-form">
            {/* 1. Donation Type */}
            <div className="dp-section">
              <div className="dp-section-title">Donation Type<span className="req">*</span></div>
              <div className="dp-type-group">
                <label className={`dp-type-card${form.donationType === 'online' ? ' active' : ''}`}>
                  <input type="radio" name="donationType" value="online" checked={form.donationType === 'online'} onChange={handleChange} disabled={loading} style={{ display: 'none' }} />
                  <div className="dp-type-icon">💳</div>
                  <div className="dp-type-text">
                    <strong>Online Transfer</strong>
                    <small>via QRPH</small>
                  </div>
                </label>
                <label className={`dp-type-card${form.donationType === 'cash' ? ' active' : ''}`}>
                  <input type="radio" name="donationType" value="cash" checked={form.donationType === 'cash'} onChange={handleChange} disabled={loading} style={{ display: 'none' }} />
                  <div className="dp-type-icon">💵</div>
                  <div className="dp-type-text">
                    <strong>In-Person (Cash)</strong>
                    <small>Schedule an appointment</small>
                  </div>
                </label>
              </div>
            </div>

            {/* 2. Donor Info — Online */}
            {form.donationType === 'online' && (
              <div className="dp-section">
                <div className="dp-section-title">Your Information <span className="req">*</span></div>
                <div className="dp-group">
                  <label>First Name</label>
                  <input
                    className={`dp-input${errors.firstName ? ' error' : ''}`}
                    type="text"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="Juan"
                    disabled={loading || form.anonymous}
                    required={!form.anonymous}
                  />
                  {errors.firstName && <div className="dp-err-msg">{errors.firstName}</div>}
                </div>

                <div className="dp-row-2">
                  <div className="dp-group">
                    <label>Middle Name (Optional)</label>
                    <input
                      className="dp-input"
                      type="text"
                      name="middleName"
                      value={form.middleName}
                      onChange={handleChange}
                      placeholder="M."
                      disabled={loading || form.anonymous}
                    />
                  </div>
                  <div className="dp-group">
                    <label>Last Name</label>
                    <input
                      className={`dp-input${errors.lastName ? ' error' : ''}`}
                      type="text"
                      name="lastName"
                      value={form.lastName}
                      onChange={handleChange}
                      placeholder="Dela Cruz"
                      disabled={loading || form.anonymous}
                      required={!form.anonymous}
                    />
                    {errors.lastName && <div className="dp-err-msg">{errors.lastName}</div>}
                  </div>
                </div>

                <div className="dp-group">
                  <label>Email Address</label>
                  <input
                    className={`dp-input${errors.email ? ' error' : ''}`}
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="juan@example.com"
                    disabled={loading || form.anonymous}
                    required={!form.anonymous}
                  />
                  {errors.email && <div className="dp-err-msg">{errors.email}</div>}
                </div>

                <div className="dp-group">
                  <label>Mobile Number<span className="req">*</span></label>
                  <input
                    className={`dp-input${errors.phone ? ' error' : ''}`}
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="09123456789"
                    disabled={loading}
                    required
                  />
                  {errors.phone && <div className="dp-err-msg">{errors.phone}</div>}
                  {!errors.phone && <div className="dp-hint">We'll contact you if we have questions about your donation.</div>}
                </div>
              </div>
            )}

            {/* 2. Donor Info — Cash */}
            {form.donationType === 'cash' && (
              <div className="dp-section">
                <div className="dp-section-title">Your Information <span className="req">*</span></div>
                <div className="dp-group">
                  <label>First Name</label>
                  <input
                    className={`dp-input${errors.firstName ? ' error' : ''}`}
                    type="text"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="Juan"
                    disabled={loading || form.anonymous}
                    required={!form.anonymous}
                  />
                  {errors.firstName && <div className="dp-err-msg">{errors.firstName}</div>}
                </div>

                <div className="dp-row-2">
                  <div className="dp-group">
                    <label>Middle Name (Optional)</label>
                    <input
                      className="dp-input"
                      type="text"
                      name="middleName"
                      value={form.middleName}
                      onChange={handleChange}
                      placeholder="M."
                      disabled={loading || form.anonymous}
                    />
                  </div>
                  <div className="dp-group">
                    <label>Last Name</label>
                    <input
                      className={`dp-input${errors.lastName ? ' error' : ''}`}
                      type="text"
                      name="lastName"
                      value={form.lastName}
                      onChange={handleChange}
                      placeholder="Dela Cruz"
                      disabled={loading || form.anonymous}
                      required={!form.anonymous}
                    />
                    {errors.lastName && <div className="dp-err-msg">{errors.lastName}</div>}
                  </div>
                </div>

                <div className="dp-group">
                  <label>Email Address</label>
                  <input
                    className={`dp-input${errors.email ? ' error' : ''}`}
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="juan@example.com"
                    disabled={loading || form.anonymous}
                    required={!form.anonymous}
                  />
                  {errors.email && <div className="dp-err-msg">{errors.email}</div>}
                </div>

                <div className="dp-group">
                  <label>Mobile Number<span className="req">*</span></label>
                  <input
                    className={`dp-input${errors.phone ? ' error' : ''}`}
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="09123456789"
                    disabled={loading}
                    required
                  />
                  {errors.phone && <div className="dp-err-msg">{errors.phone}</div>}
                  {!errors.phone && <div className="dp-hint">We'll contact you to confirm your appointment.</div>}
                </div>
              </div>
            )}

            {/* 3. Amount — Online only */}
            {form.donationType === 'online' && (
              <div className="dp-section">
                <div className="dp-section-title">Donation Amount<span className="req">*</span></div>
                <div className="dp-hint" style={{ marginBottom: 12 }}>Minimum ₱100</div>

                <div className="dp-preset-group">
                  {PRESETS.map(p => (
                    <button
                      key={p}
                      type="button"
                      className={`dp-preset${Number(form.amount) === p ? ' active' : ''}`}
                      onClick={() => setAmt(p)}
                      disabled={loading}
                    >
                      {fmt(p)}
                    </button>
                  ))}
                </div>

                <div className="dp-group">
                  <label>Custom Amount</label>
                  <div className="dp-input-with-icon">
                    <span className="dp-currency">₱</span>
                    <input
                      className={`dp-input${errors.amount ? ' error' : ''}`}
                      type="number"
                      name="amount"
                      value={form.amount}
                      onChange={handleChange}
                      placeholder="500"
                      disabled={loading}
                      min="100"
                      step="1"
                    />
                  </div>
                  {errors.amount && <div className="dp-err-msg">{errors.amount}</div>}
                </div>
              </div>
            )}

            {/* 4. Appointment — Cash only */}
            {form.donationType === 'cash' && (
              <div className="dp-section">
                <div className="dp-section-title">Schedule Your Visit<span className="req">*</span></div>

                <div className="dp-group">
                  <label>Date</label>
                  <input
                    className={`dp-input${errors.appointmentDate ? ' error' : ''}`}
                    type="date"
                    name="appointmentDate"
                    value={form.appointmentDate}
                    onChange={handleChange}
                    disabled={loading}
                    min={today()}
                  />
                  {errors.appointmentDate && <div className="dp-err-msg">{errors.appointmentDate}</div>}
                </div>

                <div className="dp-group">
                  <label>Time Slot</label>
                  <select
                    className={`dp-input${errors.appointmentTime ? ' error' : ''}`}
                    name="appointmentTime"
                    value={form.appointmentTime}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    <option value="">Select time…</option>
                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.appointmentTime && <div className="dp-err-msg">{errors.appointmentTime}</div>}
                </div>

                <div className="dp-group">
                  <label>Amount (Optional)</label>
                  <div className="dp-input-with-icon">
                    <span className="dp-currency">₱</span>
                    <input
                      className={`dp-input${errors.amount ? ' error' : ''}`}
                      type="number"
                      name="amount"
                      value={form.amount}
                      onChange={handleChange}
                      placeholder="Optional — confirm on arrival"
                      disabled={loading}
                      min="0"
                      step="1"
                    />
                  </div>
                  {errors.amount && <div className="dp-err-msg">{errors.amount}</div>}
                  {!errors.amount && <div className="dp-hint">You can specify an amount now or confirm it when you visit.</div>}
                </div>
              </div>
            )}

            {/* 5. Designation */}
            <div className="dp-section">
              <div className="dp-section-title">Donation Purpose (Optional)</div>
              <select className="dp-input" name="designation" disabled={loading}>
                <option value="general">General Support</option>
                <option value="medical">Medical Assistance</option>
                <option value="food">Food & Nutrition</option>
                <option value="facility">Facilities & Maintenance</option>
                <option value="staff">Staff & Operations</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* 6. Proof of Payment — Online only */}
            {form.donationType === 'online' && (
              <div className="dp-section">
                <div className="dp-section-title">
                  Proof of Payment<span className="req" style={{ marginLeft: 4 }}>*</span>
                </div>
                <div className={`dp-upload-box${errors.proof ? ' dp-upload-box--err' : ''}`}>
                  {!proofFile ? (
                    <label className="dp-upload-label" htmlFor="proofInput">
                      <div className="dp-upload-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                        </svg>
                      </div>
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
                        <div className="dp-upload-pdf-icon">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>
                      ) : (
                        <img src={proofPreview} alt="Proof preview" className="dp-upload-preview-img" />
                      )}
                      <div className="dp-upload-file-info">
                        <strong>{proofFile.name}</strong>
                        <span>{(proofFile.size / 1024).toFixed(0)} KB</span>
                      </div>
                      <button type="button" className="dp-upload-remove" onClick={removeProof} disabled={loading}>
                        &#10005;
                      </button>
                    </div>
                  )}
                </div>

                {/* AI Verification Badge */}
                {proofFile && (
                  <div style={{ marginTop: 10 }}>
                    {aiVerifying && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', borderRadius: 10,
                        background: '#F0F4FF', border: '1.5px solid #C7D7F9',
                        fontSize: '.82rem', color: '#3B5998',
                      }}>
                        <span style={{ display: 'inline-block', width: 16, height: 16, border: '2.5px solid #3B5998', borderTopColor: 'transparent', borderRadius: '50%', animation: 'dp-spin 0.8s linear infinite', flexShrink: 0 }} />
                        <span><strong>AI is verifying your receipt…</strong> This only takes a moment.</span>
                      </div>
                    )}

                    {!aiVerifying && aiResult && (() => {
                      const { valid, confidence, reason, details } = aiResult;
                      const cfg = valid === true
                        ? { bg: '#F0FFF4', border: '#68D391', icon: '✅', label: 'Valid Receipt', labelColor: '#276749', barColor: '#48BB78' }
                        : valid === false
                        ? { bg: '#FFF5F5', border: '#FC8181', icon: '❌', label: 'Not a Receipt', labelColor: '#9B2C2C', barColor: '#FC8181' }
                        : { bg: '#FFFBEB', border: '#F6C90E', icon: '⚠️', label: 'Needs Review', labelColor: '#744210', barColor: '#F6C90E' };
                      const confW = confidence === 'high' ? '90%' : confidence === 'medium' ? '55%' : '25%';
                      return (
                        <div style={{ padding: '12px 16px', borderRadius: 12, background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: '1rem' }}>{cfg.icon}</span>
                            <strong style={{ fontSize: '.85rem', color: cfg.labelColor }}>AI Receipt Check: {cfg.label}</strong>
                            <span style={{ marginLeft: 'auto', fontSize: '.72rem', color: '#888', background: '#fff', padding: '2px 8px', borderRadius: 20, border: '1px solid #eee' }}>
                              Powered by Claude AI
                            </span>
                          </div>
                          <p style={{ margin: '0 0 8px', fontSize: '.8rem', color: '#444', lineHeight: 1.5 }}>
                            {reason}. {details}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '.72rem', color: '#888', whiteSpace: 'nowrap' }}>Confidence</span>
                            <div style={{ flex: 1, height: 5, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ width: confW, height: '100%', background: cfg.barColor, borderRadius: 99, transition: 'width 0.6s ease' }} />
                            </div>
                            <span style={{ fontSize: '.72rem', color: '#888', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{confidence}</span>
                          </div>
                          {valid === false && (
                            <p style={{ margin: '8px 0 0', fontSize: '.78rem', color: '#9B2C2C', background: '#FED7D7', padding: '7px 10px', borderRadius: 7 }}>
                              ⚠️ Please upload a genuine payment screenshot (e.g. GCash, Maya, bank transfer confirmation). Random photos will not be accepted.
                            </p>
                          )}
                          {valid === null && (
                            <p style={{ margin: '8px 0 0', fontSize: '.78rem', color: '#744210', background: '#FEFCBF', padding: '7px 10px', borderRadius: 7 }}>
                              Our team will review this manually after submission.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {errors.proof
                  ? <div className="dp-err-msg" style={{ marginTop: 6 }}>{errors.proof}</div>
                  : <div className="dp-hint" style={{ marginTop: 6 }}>Required — attach your QRPH payment screenshot.</div>
                }
              </div>
            )}

            {/* 7. Notes & Anonymous */}
            <div className="dp-section">
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
                {form.donationType === 'online' ? 'Review Donation' : 'Review Appointment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}