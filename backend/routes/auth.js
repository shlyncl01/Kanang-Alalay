// RegistrationCodesPanel.js
import React, { useState } from 'react';
import axios from 'axios';

const RegistrationCodesPanel = () => {
    const [codes, setCodes] = useState([]);
    const [generating, setGenerating] = useState(false);
    const [form, setForm] = useState({
        count: 1,
        role: 'staff',
        purpose: ''
    });

    const generateCodes = async () => {
        setGenerating(true);
        try {
            const response = await axios.post('/api/admin/generate-codes', form, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            setCodes([...response.data.codes, ...codes]);
            alert(`Generated ${form.count} code(s)`);
        } catch (error) {
            alert('Error generating codes');
        } finally {
            setGenerating(false);
        }
    };

    

    return (
        <div className="codes-panel">
            <h3>Registration Code Management</h3>
            
            <div className="code-generator">
                <input
                    type="number"
                    value={form.count}
                    onChange={(e) => setForm({...form, count: e.target.value})}
                    min="1"
                    max="10"
                    placeholder="Number of codes"
                />
                <select
                    value={form.role}
                    onChange={(e) => setForm({...form, role: e.target.value})}
                >
                    <option value="staff">Staff</option>
                    <option value="caregiver">Caregiver</option>
                    <option value="nurse">Nurse</option>
                    <option value="admin">Admin</option>
                </select>
                <button onClick={generateCodes} disabled={generating}>
                    {generating ? 'Generating...' : 'Generate Codes'}
                </button>
            </div>
            
            <div className="codes-list">
                {codes.map((code, index) => (
                    <div key={index} className="code-item">
                        <span className="code">{code.code}</span>
                        <span className="role">{code.role}</span>
                        <span className="expiry">
                            Expires: {new Date(code.expiresAt).toLocaleDateString()}
                        </span>
                        <button 
                            onClick={() => navigator.clipboard.writeText(code.code)}
                            className="copy-btn"
                        >
                            Copy
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};