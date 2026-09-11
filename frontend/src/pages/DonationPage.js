// DonationPage.js
import React, { useState, useEffect, useCallback } from 'react';
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
          ['Email',       data.email],
          ['Phone',       data.phone],
          ['Type',        data.typeLabel],
          ...(data.donationType === 'online' ? [
            ['Amount',    fmt(data.amount)],
            ['Payment',   'QRPH via PayMongo'],
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
            ? <><div className="dp-spin" /> {data.donationType === 'online' ? 'Preparing checkout…' : 'Processing…'}</>
            : data.donationType === 'online' ? 'Proceed to PayMongo' : 'Confirm Appointment'}
        </button>
      </div>
    </div>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
export default function DonationPage() {
  const [form, setForm] = useState({
    firstName: '', middleName: '', lastName: '', email: '', phone: '',
    amount: '', donationType: 'online',
    notes: '', anonymous: false, appointmentDate: '', appointmentTime: ''
  });
  const [errors, setErrors]                 = useState({});
  const [apiError, setApiError]             = useState('');
  const [loading, setLoading]               = useState(false);
  const [submitted, setSubmitted]           = useState(false);
  const [receipt, setReceipt]               = useState(null);
  const [showModal, setShowModal]           = useState(false);
  const [modalData, setModalData]           = useState(null);

  // ── PayMongo return handling (Part 9) ─────────────────────────────────────
  // The donor lands back here from PayMongo's success_url/cancel_url. We
  // never trust that redirect by itself — it only tells us to go check the
  // real status, which the webhook (server-side, source of truth) may or may
  // not have updated yet. `returnState` drives a dedicated screen instead of
  // reusing the old fire-and-forget "submitted" flow.
  const [returnState, setReturnState] = useState(null); // null | 'checking' | 'paid' | 'pending' | 'cancelled' | 'failed' | 'not_found'
  const [returnDonation, setReturnDonation] = useState(null);

  const checkDonationStatus = useCallback(async (donationId) => {
    try {
      const res = await axios.get(`${API_URL}/donations/${donationId}`);
      return res.data?.success ? res.data.data : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymongoParam = params.get('paymongo');
    const donationId = params.get('donation');
    if (!paymongoParam || !donationId) return;

    // Clean the query string so a refresh doesn't re-trigger this flow.
    window.history.replaceState({}, '', window.location.pathname);

    if (paymongoParam === 'cancelled') {
      setReturnState('cancelled');
      return;
    }

    let cancelled = false;
    let attempts = 0;
    setReturnState('checking');

    const poll = async () => {
      const donation = await checkDonationStatus(donationId);
      if (cancelled) return;
      if (!donation) {
        setReturnState('not_found');
        return;
      }
      if (donation.paymentStatus === 'paid') {
        setReturnDonation(donation);
        setReturnState('paid');
        return;
      }
      if (donation.paymentStatus === 'failed') {
        setReturnDonation(donation);
        setReturnState('failed');
        return;
      }
      // Still pending — the webhook may just not have landed yet. Poll a few
      // more times before settling into a "we'll email you" pending state.
      attempts += 1;
      if (attempts < 6) {
        setTimeout(poll, 2500);
      } else {
        setReturnDonation(donation);
        setReturnState('pending');
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [checkDonationStatus]);

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

  const validate = () => {
    const e = {};
    // Name is a personal-identity field — only required when NOT donating anonymously.
    // Email is different: for online donations it's always required (even when
    // anonymous) because PayMongo needs an address to send the payment receipt to.
    if (!form.anonymous) {
      if (!form.firstName.trim()) e.firstName = 'Required';
      if (!form.lastName.trim())  e.lastName  = 'Required';
    }
    if (!form.anonymous || form.donationType === 'online') {
      if (!form.email.trim())     e.email     = 'Required';
      else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Invalid email';
    } else if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email)) {
      // Anonymous cash donor who chose to still enter an email — keep format validation
      e.email = 'Invalid email';
    }

    if (!form.phone) {
      e.phone = 'Mobile number is required';
    } else {
      const { isValid } = validatePhilippineNumber(form.phone);
      if (!isValid) e.phone = 'Enter a valid PH mobile number (e.g. 09123456789 or 9123456789)';
    }

    // Amount required for online — donor pays via PayMongo's hosted checkout,
    // no proof-of-payment upload needed since PayMongo emails its own receipt.
    if (form.donationType === 'online') {
      if (!form.amount || Number(form.amount) < 100) e.amount = 'Minimum ₱100';
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
      typeLabel:       form.donationType === 'online' ? 'PayMongo (Online)' : 'Cash (In-person)',
      amount:          donationAmount,
      appointmentDate: form.appointmentDate,
      appointmentTime: form.appointmentTime,
      notes:           form.notes?.trim() || '',
      anonymous:       form.anonymous,
    });
    setShowModal(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setApiError('');
    try {
      // Online donations now go through the real PayMongo Hosted Checkout —
      // create the (pending) donation + Checkout Session, then redirect the
      // donor to the actual PayMongo payment page. Nothing here marks the
      // donation Paid; only the PayMongo webhook does that.
      if (modalData.donationType === 'online') {
        const response = await axios.post(`${API_URL}/donations/checkout`, {
          firstName:  modalData.firstName,
          middleName: modalData.middleName,
          lastName:   modalData.lastName,
          donorName:  modalData.donorName,
          email:      modalData.email,
          phone:      modalData.phone,
          amount:     modalData.amount,
          notes:      modalData.notes,
          anonymous:  modalData.anonymous,
        }, { timeout: 30000 });

        if (response.data.success && response.data.checkoutUrl) {
          window.location.href = response.data.checkoutUrl;
          return; // leaving the page
        }
        throw new Error(response.data.message || 'Could not start PayMongo checkout.');
      }

      // Cash donations are unchanged — created immediately, confirmed in person.
      const formData = new FormData();
      formData.append('firstName',    modalData.firstName);
      formData.append('lastName',     modalData.lastName);
      formData.append('donorName',    modalData.donorName);
      formData.append('email',        modalData.email);
      formData.append('phone',        modalData.phone);
      formData.append('donationType', modalData.donationType);
      formData.append('middleName',   modalData.middleName);
      formData.append('notes',        modalData.notes);
      formData.append('anonymous',    modalData.anonymous ? 'true' : 'false');
      formData.append('amount', String(modalData.amount));
      formData.append('paymentMethod', 'cash');
      if (modalData.appointmentDate) formData.append('appointmentDate', modalData.appointmentDate);
      if (modalData.appointmentTime) formData.append('appointmentTime', modalData.appointmentTime);

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

  // ── Returning from PayMongo Hosted Checkout ───────────────────────────────
  // success_url/cancel_url both land here — the actual outcome always comes
  // from GET /api/donations/:id (backed by the webhook), never from the
  // redirect itself, per the "don't trust the return URL" rule.
  if (returnState) {
    if (returnState === 'checking') {
      return (
        <div className="dp-success">
          <div className="dp-success-card">
            <div
              className="dp-spin"
              style={{
                width: 40, height: 40, margin: '0 auto 16px',
                borderColor: 'rgba(249, 107, 56, .25)',
                borderTopColor: 'var(--orange, #F96B38)'
              }}
            />
            <h2>Confirming your payment…</h2>
            <p>Please wait a moment while we confirm your donation with PayMongo.</p>
          </div>
        </div>
      );
    }

    if (returnState === 'paid' && returnDonation) {
      return (
        <div className="dp-success">
          <div className="dp-success-card">
            <div className="dp-checkmark">&#10003;</div>
            <h2>Thank You for Your Generosity!</h2>
            <p>
              Your donation has been received. PayMongo has sent a payment receipt to{' '}
              <strong>{returnDonation.email}</strong>.
            </p>
            <div className="dp-receipt">
              <div className="dp-receipt-row">
                <span>Donation ID</span>
                <strong>{returnDonation.donationId}</strong>
              </div>
              <div className="dp-receipt-row">
                <span>Donor</span>
                <strong>{returnDonation.donorName}</strong>
              </div>
              <div className="dp-receipt-row">
                <span>Amount</span>
                <strong>{fmt(returnDonation.amount)}</strong>
              </div>
              <div className="dp-receipt-row">
                <span>Type</span>
                <strong>PayMongo (Online)</strong>
              </div>
              {returnDonation.receiptNumber && (
                <div className="dp-receipt-row">
                  <span>Receipt No.</span>
                  <strong>{returnDonation.receiptNumber}</strong>
                </div>
              )}
              {(returnDonation.paymongoPaymentId || returnDonation.transactionId) && (
                <div className="dp-receipt-row">
                  <span>Payment ID</span>
                  <strong style={{ fontFamily: 'monospace', fontSize: '.85em' }}>
                    {returnDonation.paymongoPaymentId || returnDonation.transactionId}
                  </strong>
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

    if (returnState === 'pending') {
      return (
        <div className="dp-success">
          <div className="dp-success-card">
            <h2>We're still confirming your payment</h2>
            <p>
              We haven't received final confirmation from PayMongo yet. This can take a
              minute or two — if you completed payment, you'll get an email receipt from
              PayMongo shortly and your donation will show as Paid.
              {returnDonation?.donationId && <> Your donation reference is <strong>{returnDonation.donationId}</strong>.</>}
            </p>
            <div className="dp-btn-row">
              <button className="dp-btn-primary" onClick={() => window.location.href = '/'}>
                Back to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (returnState === 'failed') {
      return (
        <div className="dp-success">
          <div className="dp-success-card">
            <h2>Payment wasn't successful</h2>
            <p>PayMongo reported that this payment didn't go through. No amount was charged. You're welcome to try again.</p>
            <div className="dp-btn-row">
              <button className="dp-btn-primary" onClick={() => setReturnState(null)}>
                Try Again
              </button>
              <button className="dp-btn-secondary" onClick={() => window.location.href = '/'}>
                Back to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (returnState === 'cancelled') {
      return (
        <div className="dp-success">
          <div className="dp-success-card">
            <h2>Checkout Cancelled</h2>
            <p>You cancelled the PayMongo checkout, so no donation was made and nothing was charged.</p>
            <div className="dp-btn-row">
              <button className="dp-btn-primary" onClick={() => setReturnState(null)}>
                Try Again
              </button>
              <button className="dp-btn-secondary" onClick={() => window.location.href = '/'}>
                Back to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (returnState === 'not_found') {
      return (
        <div className="dp-success">
          <div className="dp-success-card">
            <h2>We couldn't find that donation</h2>
            <p>Something went wrong looking up your donation. If you completed a payment, please contact us with your reference number.</p>
            <div className="dp-btn-row">
              <button className="dp-btn-primary" onClick={() => window.location.href = '/'}>
                Back to Home
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // ── Success Screen (Cash) ─────────────────────────────────────────────────
  if (submitted && receipt) {
    return (
      <div className="dp-success">
        <div className="dp-success-card">
          <div className="dp-checkmark">&#10003;</div>
          <h2>Thank You for Your Generosity!</h2>
          <p>
            Your in-person donation appointment has been received.
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
            {receipt.amount > 0 && (
              <div className="dp-receipt-row">
                <span>Amount</span>
                <strong>{fmt(receipt.amount)}</strong>
              </div>
            )}
            <div className="dp-receipt-row">
              <span>Type</span>
              <strong>Cash (In-person)</strong>
            </div>
            {receipt.appointmentDate && (
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

  // ── Main Form ─────────────────────────────────────────────────────────────
  return (
    <div className="dp-shell">
      {/* Modal */}
      {showModal && modalData && (
        <ConfirmModal
          data={modalData}
          onConfirm={handleConfirm}
          onCancel={() => setShowModal(false)}
          loading={loading}
        />
      )}

      {/* Hero */}
      <div className="dp-hero">
        <button className="dp-back" onClick={() => window.location.href = '/'}>&#8592;</button>
        <div className="dp-hero-inner">
          <div className="dp-hero-badge">
            <span />
            Make a Donation
          </div>
          <h1>Support Our Mission</h1>
          <p>
            Your generosity helps us continue caring for our elderly community. Every
            contribution makes a meaningful difference in their lives.
          </p>
        </div>
      </div>

      {/* Main Body */}
      <div className="dp-body">
        <div className="dp-form-container">
          {apiError && (
            <div className="dp-alert danger">
              <div>{apiError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* 1. Personal Information */}
            <div className="dp-section">
              <div className="dp-section-title">Personal Information</div>

              <div className="dp-row">
                <div className="dp-group">
                  <label>First Name<span className="req">*</span></label>
                  <input
                    className={`dp-input${errors.firstName ? ' err' : ''}`}
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="Juan"
                    disabled={loading}
                  />
                  {errors.firstName && <div className="dp-err-msg">{errors.firstName}</div>}
                </div>
                <div className="dp-group">
                  <label>Middle Name (Optional)</label>
                  <input
                    className="dp-input"
                    name="middleName"
                    value={form.middleName}
                    onChange={handleChange}
                    placeholder="Santos"
                    disabled={loading}
                  />
                </div>
                <div className="dp-group">
                  <label>Last Name<span className="req">*</span></label>
                  <input
                    className={`dp-input${errors.lastName ? ' err' : ''}`}
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Dela Cruz"
                    disabled={loading}
                  />
                  {errors.lastName && <div className="dp-err-msg">{errors.lastName}</div>}
                </div>
              </div>

              <div className="dp-row">
                <div className="dp-group">
                  <label>Email Address<span className="req">*</span></label>
                  <input
                    className={`dp-input${errors.email ? ' err' : ''}`}
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="juan@example.com"
                    disabled={loading}
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
                    maxLength={15}
                    disabled={loading}
                  />
                  {errors.phone && <div className="dp-err-msg">{errors.phone}</div>}
                  <div className="dp-hint phone-hint">Format: 09XXXXXXXXX or 9XXXXXXXXX (PH mobile)</div>
                </div>
              </div>
            </div>

            {/* 2. Donation Method */}
            <div className="dp-section">
              <div className="dp-section-title">Donation Method</div>
              <div className="dp-tabs">
                <button
                  type="button"
                  className={`dp-tab${form.donationType === 'online' ? ' active' : ''}`}
                  onClick={() => {
                    setFormField('donationType', 'online');
                    setFormField('amount', '');
                  }}
                  disabled={loading}
                >
                  PayMongo (Online)
                </button>
                <button
                  type="button"
                  className={`dp-tab${form.donationType === 'cash' ? ' active' : ''}`}
                  onClick={() => {
                    setFormField('donationType', 'cash');
                    setFormField('amount', '');
                  }}
                  disabled={loading}
                >
                  Cash (In-person)
                </button>
              </div>
              <div className="dp-hint">
                {form.donationType === 'online'
                  ? "You'll be redirected to PayMongo's secure checkout to pay"
                  : 'Schedule an appointment to donate in person'}
              </div>
            </div>

            {/* 3. PayMongo Checkout info — Online only */}
            {form.donationType === 'online' && (
              <div className="dp-section">
                <div className="dp-qrph-box">
                  <div className="dp-qrph-label">Pay Securely via PayMongo</div>
                  <div className="dp-qrph-hint">
                    After you review your donation, you'll be redirected to PayMongo's
                    secure hosted checkout page to pay via QRPH.
                    PayMongo emails you an official payment receipt once your payment
                    goes through — no need to upload a screenshot.
                  </div>
                </div>
              </div>
            )}

            {/* 4. Cash — Appointment Scheduling */}
            {form.donationType === 'cash' && (
              <div className="dp-section">
                <div className="dp-appt-box">
                  <h6>Schedule Your Appointment</h6>
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
                      <div className="dp-hint">Choose between morning or afternoon visit</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Donation Amount */}
            <div className="dp-section">
              <div className="dp-section-title">
                Donation Amount
                {form.donationType === 'online' && <span className="req">*</span>}
                {form.donationType === 'cash' && <span className="req" style={{ opacity: 0.6 }}> (Optional)</span>}
              </div>
              {form.donationType === 'online' && (
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
              )}
              <div className="dp-group">
                <label>
                  {form.donationType === 'cash' ? 'Amount You Plan to Donate (PHP)' : 'Custom Amount (PHP)'}
                  {form.donationType === 'online' && <span className="req">*</span>}
                </label>
                <input
                  className={`dp-input${errors.amount ? ' err' : ''}`}
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  min="1"
                  placeholder={form.donationType === 'cash' ? 'Leave empty if unsure' : 'Enter amount (min ₱100)'}
                  disabled={loading}
                />
                {errors.amount && <div className="dp-err-msg">{errors.amount}</div>}
                {form.donationType === 'online' && (
                  <div className="dp-hint">Minimum donation: ₱100</div>
                )}
                {form.donationType === 'cash' && (
                  <div className="dp-hint">Optional - you can specify the amount you plan to donate</div>
                )}
              </div>
            </div>

            {/* 6. Notes & Anonymous */}
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
                {form.donationType === 'online' ? 'Review & Proceed to PayMongo' : 'Review Appointment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}