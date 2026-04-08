import React, { useState, useEffect } from 'react';
import axios from 'axios';

const UserManagementTab = () => {
  const [showModal, setShowModal] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [strength, setStrength] = useState("");
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(0);

  // Password Strength Logic
  useEffect(() => {
    if (password.length === 0) setStrength("");
    else if (password.length <= 3) setStrength("Weak");
    else if (password.length <= 7) setStrength("Moderate");
    else setStrength("Strong");
  }, [password]);

  // Resend Timer Logic
  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleSaveUser = async () => {
    try {
      await axios.post("/api/auth/register", { username: email.split('@')[0], email, password });
      setShowModal(false);
      setShowOtpModal(true);
      setTimer(30); // 30s resend cooldown
    } catch (err) {
      alert(err.response.data.message);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      await axios.post("/api/auth/verify-otp", { email, otpCode: otp });
      alert("Activated!");
      setShowOtpModal(false);
    } catch (err) {
      alert("Incorrect OTP or expired");
    }
  };

  return (
    <div>
      <button onClick={() => setShowModal(true)}>Add New User</button>

      {/* Add User Modal */}
      {showModal && (
        <div className="modal">
          <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
          <p>Strength: <b>{strength}</b></p>
          <button onClick={handleSaveUser}>Save</button>
        </div>
      )}

      {/* OTP Modal */}
      {showOtpModal && (
        <div className="modal">
          <h3>Verify Account</h3>
          <input type="text" value={email} readOnly />
          <input type="text" placeholder="6-digit OTP" onChange={(e) => setOtp(e.target.value)} />
          <button onClick={handleVerifyOtp}>Activate</button>
          <button disabled={timer > 0} onClick={() => setTimer(30)}>
            {timer > 0 ? `Resend in ${timer}s` : "Resend OTP"}
          </button>
        </div>
      )}
    </div>
  );
};

export default UserManagementTab;