import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/DonationPage.css';


// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => `₱${Number(n).toLocaleString()}`;
const uid = () => 'DN-' + Math.random().toString(36).slice(2,9).toUpperCase();
const today = () => new Date().toISOString().split('T')[0];
const API_BASE = (() => {
  const raw =
    process.env.REACT_APP_API_BASE_URL ||
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://kanang-alalay-backend.onrender.com/api' : 'http://localhost:5000/api');
  return raw.replace(/\/api\/?$/, '');
})();

const PRESETS  = [500, 1000, 2000, 5000, 10000];
const TIMES    = ['09:00 AM','10:00 AM','11:00 AM','01:00 PM','02:00 PM','03:00 PM','04:00 PM'];
const IMPACTS  = [
  { icon: '🍽️', text: 'Daily Meals',    sub: '₱500 feeds 5 elderly for one day' },
  { icon: '💊', text: 'Medications',     sub: '₱1,000 covers a week of vitamins' },
  { icon: '🛏️', text: 'Care & Comfort', sub: '₱2,000 provides bedding & hygiene kits' },
  { icon: '🎉', text: 'Events & Joy',   sub: '₱5,000 sponsors a celebration' },
];




// ── Main Component ────────────────────────────────────────────────────────────
export default function DonationPage() {
  const [form, setForm] = useState({
    firstName:'', middleName:'', lastName:'', email:'', phone:'',
    amount:'', donationType:'online',
    notes:'', anonymous:false, appointmentDate:'', appointmentTime:''
  });
  const [errors,    setErrors]    = useState({});
  const [apiError,  setApiError]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [receipt,   setReceipt]   = useState(null);

  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const setAmt = v => { setForm(p=>({...p,amount:v.toString()})); setErrors(p=>({...p,amount:''})); };

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    if (name==='phone') { const v=value.replace(/\D/g,''); if(v.length<=11) set(name,v); return; }
    set(name, type==='checkbox'?checked:value);
    setErrors(p=>({...p,[name]:''}));
  };

  const validate = () => {
    const e={};
    if (!form.firstName.trim()) e.firstName='Required';
    if (!form.lastName.trim())  e.lastName='Required';
    if (!form.email.trim())     e.email='Required';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email='Invalid email';
    if (!form.phone || form.phone.length<10) e.phone='Enter a valid number';
    if (!form.amount || Number(form.amount)<100) e.amount='Minimum ₱100';
    if (form.donationType==='cash') {
      if (!form.appointmentDate) e.appointmentDate='Required';
      if (!form.appointmentTime) e.appointmentTime='Required';
    }
    setErrors(e);
    return Object.keys(e).length===0;
  };

  const submitDonation = async () => {
    setLoading(true);
    setApiError('');
    
    try {
      const fullName = `${form.firstName} ${form.middleName ? form.middleName + ' ' : ''}${form.lastName}`.trim();
      
      let submissionData = {
        donorName: fullName,
        firstName: form.firstName,
        middleName: form.middleName,
        lastName: form.lastName,
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        donationType: form.donationType,
        amount: Number(form.amount),
        notes: form.notes.trim() || '',
        anonymous: form.anonymous
      };

      if (form.donationType === 'online') {
        submissionData.paymentMethod = 'qrph';
      } else {
        submissionData.appointmentDate = form.appointmentDate;
        submissionData.appointmentTime = form.appointmentTime;
      }

      const response = await axios.post(`${API_BASE}/api/donations`, submissionData);

      if (response.data.success) {
        const method = form.donationType === 'online' ? 'QRPH' : 'Cash';
        setReceipt({
          refId: response.data.donationId,
          name: fullName,
          amount: Number(form.amount),
          type: form.donationType,
          method: method,
          date: new Date().toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'}),
          email: form.email,
          checkoutUrl: response.data.checkoutUrl
        });
        setSubmitted(true);
      } else {
        throw new Error(response.data.message || 'Donation submission failed');
      }
    } catch (err) {
      console.error('Submission error:', err);
      setApiError(err.response?.data?.message || err.message || 'Donation submission failed');
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

  // ── Success Screen ──────────────────────────────────────────────────────────
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
          ].map(([l,v])=>(
            <div className="dp-receipt-row" key={l}>
              <span>{l}</span><strong>{v}</strong>
            </div>
          ))}
        </div>
        {receipt.type === 'online' && (
          <div className="dp-redirect-message" style={{marginTop: '16px', padding: '12px', background: '#fff3e0', borderRadius: '8px', textAlign: 'center'}}>
            <strong style={{color: '#ff8c42'}}>Redirecting to secure payment gateway...</strong>
          </div>
        )}
        <div className="dp-btn-row">
          <button className="dp-btn-primary" onClick={()=>{
            setSubmitted(false);
            setReceipt(null);
            setForm({
              firstName:'', middleName:'', lastName:'', email:'', phone:'',
              amount:'', donationType:'online',
              notes:'', anonymous:false, appointmentDate:'', appointmentTime:''
            });
          }}>Donate Again</button>
          <button className="dp-btn-secondary" onClick={()=>window.history.back()}>Go Back</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="dp-shell">
      {/* Hero */}
      <div className="dp-hero">
        <button className="dp-back" onClick={()=>window.history.back()}>←</button>
        <div style={{maxWidth:720,margin:'0 auto',position:'relative',zIndex:1}}>
          <div className="dp-hero-badge"><span/>Secure Donations</div>
          <h1>Support Our Mission<br/>to Care for the Elderly</h1>
          <p>Every peso you give provides meals, medications, and moments of joy to residents who need it most.</p>
          
        </div>
      </div>

      {/* Body */}
      <div className="dp-body">

        {/* Form Column */}
        <div className="dp-form-col">
          <div className="dp-card">
            <div className="dp-card-body">
              {apiError && <div className="dp-alert danger">⚠ {apiError}</div>}

              <form onSubmit={handleSubmit} noValidate>
                {/* Donor Info */}
                <div className="dp-section-label">Donor Information</div>
                <div className="dp-row">
                  {['firstName','middleName','lastName'].map(k=>(
                    <div className="dp-group" key={k}>
                      <label>{k==='firstName'?'First Name':k==='middleName'?'Middle Name':'Last Name'}{k!=='middleName'&&<span className="req">*</span>}</label>
                      <input className={`dp-input${errors[k]?' err':''}`} name={k} value={form[k]} onChange={handleChange} disabled={loading} />
                      {errors[k] && <div className="dp-err-msg">{errors[k]}</div>}
                    </div>
                  ))}
                </div>
                <div className="dp-row">
                  <div className="dp-group">
                    <label>Email Address<span className="req">*</span></label>
                    <input className={`dp-input${errors.email?' err':''}`} name="email" type="email" value={form.email} onChange={handleChange} disabled={loading} />
                    {errors.email && <div className="dp-err-msg">{errors.email}</div>}
                  </div>
                  <div className="dp-group">
                    <label>Phone Number<span className="req">*</span></label>
                    <input className={`dp-input${errors.phone?' err':''}`} name="phone" value={form.phone} onChange={handleChange} placeholder="09XXXXXXXXX" maxLength={11} disabled={loading} />
                    {errors.phone && <div className="dp-err-msg">{errors.phone}</div>}
                  </div>
                </div>

                {/* Donation Type */}
                <div className="dp-section-label" style={{marginTop:8}}>Donation Type</div>
                <div className="dp-tabs">
                  {[{v:'online',l:'QRPH'},{v:'cash',l:'In-Person / Cash'}].map(t=>(
                    <div key={t.v} className={`dp-tab${form.donationType===t.v?' active':''}`}
                      onClick={()=>!loading && set('donationType',t.v)}>{t.l}</div>
                  ))}
                </div>

                {/* QRPH QR Code */}
                {form.donationType==='online' && (
                  <div className="dp-qrph-box" style={{marginTop:16,textAlign:'center',padding:'20px',background:'#f8f9ff',borderRadius:12,border:'1.5px solid #e0e4ff'}}>
                    <div style={{fontSize:14,fontWeight:600,color:'#555',marginBottom:12}}>Scan to Pay via QRPH</div>
                    <img
                      src="/images/QRPH.jpg"
                      alt="QRPH QR Code"
                      style={{width:200,height:200,objectFit:'contain',borderRadius:8,border:'1px solid #ddd',background:'#fff',padding:8}}
                    />
                    <div style={{marginTop:12,fontSize:13,color:'#777'}}>Use any bank app or e-wallet that supports QRPh to scan and complete your donation.</div>
                  </div>
                )}

                {/* Appointment */}
                {form.donationType==='cash' && (
                  <div className="dp-appt-box" style={{marginTop:16}}>
                    <h6>📅 Schedule Your Appointment</h6>
                    <div className="dp-row">
                      <div className="dp-group">
                        <label>Date<span className="req">*</span></label>
                        <input className={`dp-input${errors.appointmentDate?' err':''}`} type="date" name="appointmentDate" value={form.appointmentDate} onChange={handleChange} min={today()} disabled={loading} />
                        {errors.appointmentDate && <div className="dp-err-msg">{errors.appointmentDate}</div>}
                      </div>
                      <div className="dp-group">
                        <label>Time<span className="req">*</span></label>
                        <select className={`dp-select${errors.appointmentTime?' err':''}`} name="appointmentTime" value={form.appointmentTime} onChange={handleChange} disabled={loading}>
                          <option value="">Select time</option>
                          {TIMES.map(t=><option key={t}>{t}</option>)}
                        </select>
                        {errors.appointmentTime && <div className="dp-err-msg">{errors.appointmentTime}</div>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Amount */}
                <div className="dp-section-label" style={{marginTop:24}}>Donation Amount</div>
                <div className="dp-amounts">
                  {PRESETS.map(a=>(
                    <button key={a} type="button" className={`dp-amount-btn${form.amount===a.toString()?' active':''}`}
                      onClick={()=>setAmt(a)} disabled={loading}>{fmt(a)}</button>
                  ))}
                </div>
                <div className="dp-group">
                  <label>Custom Amount (PHP)<span className="req">*</span></label>
                  <input className={`dp-input${errors.amount?' err':''}`} type="number" name="amount" value={form.amount}
                    onChange={handleChange} min="100" placeholder="Enter amount (min ₱100)" disabled={loading} />
                  {errors.amount && <div className="dp-err-msg">{errors.amount}</div>}
                  <div className="dp-hint">Minimum donation: ₱100</div>
                </div>

                {/* Notes & Anonymous */}
                <div className="dp-group" style={{marginTop:8}}>
                  <label>Message / Notes (Optional)</label>
                  <textarea className="dp-textarea" name="notes" value={form.notes} onChange={handleChange} placeholder="Leave an encouraging message..." disabled={loading} />
                </div>

                <div className="dp-toggle-row" onClick={()=>!loading && set('anonymous',!form.anonymous)} style={{marginBottom:24}}>
                  <div>
                    <div className="dp-toggle-text">Donate Anonymously</div>
                    <div className="dp-toggle-sub">Your name will not appear on public records</div>
                  </div>
                  <div className={`dp-toggle${form.anonymous?' on':''}`}/>
                </div>

                <button type="submit" className="dp-submit" disabled={loading}>
                  {loading ? <><div className="dp-spin"/> Processing…</> :
                   form.donationType==='online' ? 'Confirm QRPH Donation →' :
                   'Schedule Appointment →'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Side Column */}
        <div className="dp-side-col">
          {/* Live Summary */}
          {form.amount && (
            <div className="dp-card dp-summary-box">
              <h6>Donation Summary</h6>
              {[
                ['Donor', form.anonymous?'Anonymous':`${form.firstName||'—'} ${form.lastName||''}`.trim()],
                ['Type', form.donationType==='online'?'QRPH (Online)' : 'Cash (In-person)'],
                form.donationType==='cash'&&form.appointmentDate&&[
                  'Appointment', `${form.appointmentDate} ${form.appointmentTime}`
                ],
              ].filter(Boolean).map(([l,v])=>(
                <div className="dp-summary-row" key={l}><span style={{color:'var(--muted)'}}>{l}</span><span>{v}</span></div>
              ))}
              <div className="dp-summary-row dp-summary-total">
                <span>Total</span><span>{fmt(form.amount)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}