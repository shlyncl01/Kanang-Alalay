import React from 'react';
import { FaDownload } from 'react-icons/fa';

const ReportsTab = ({ stats, handleExportPDF, handleGenerateReport }) => (
    <div className="card-white">
        <div className="card-header">
            <h5>Reports & Analytics Dashboard</h5>
            <button className="btn-primary-sm" onClick={() => handleExportPDF('analytics')} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <FaDownload /> Export PDF Master
            </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
            <div style={{ padding: '1.5rem', border: '1px solid #eee', borderRadius: '8px', background: '#fcfcfc' }}>
                <h6 style={{ color: '#555' }}>Financial Summary</h6>
                <h3 style={{ color: '#28a745', margin: '15px 0' }}>₱{stats.totalDonationAmount?.toLocaleString() || '0'}</h3>
                <p style={{ fontSize: '0.85rem', color: '#666' }}>Total donations collected and verified.</p>
                <button className="btn-outline-sm" onClick={() => handleGenerateReport('Financial Overview')} style={{ width: '100%', marginTop: '10px' }}>Generate Breakdown</button>
            </div>
            <div style={{ padding: '1.5rem', border: '1px solid #eee', borderRadius: '8px', background: '#fcfcfc' }}>
                <h6 style={{ color: '#555' }}>Staff Performance</h6>
                <h3 style={{ margin: '15px 0', color: '#333' }}>{stats.staffOnDuty}</h3>
                <p style={{ fontSize: '0.85rem', color: '#666' }}>Active staff members currently on duty.</p>
                <button className="btn-outline-sm" onClick={() => handleGenerateReport('Staff Performance')} style={{ width: '100%', marginTop: '10px' }}>Generate Logs</button>
            </div>
            <div style={{ padding: '1.5rem', border: '1px solid #eee', borderRadius: '8px', background: '#fcfcfc' }}>
                <h6 style={{ color: '#555' }}>Resident Health</h6>
                <h3 style={{ margin: '15px 0', color: '#333' }}>12</h3>
                <p style={{ fontSize: '0.85rem', color: '#666' }}>Incident reports and health updates filed.</p>
                <button className="btn-outline-sm" onClick={() => handleGenerateReport('Resident Health Status')} style={{ width: '100%', marginTop: '10px' }}>Generate Records</button>
            </div>
        </div>
    </div>
);
export default ReportsTab;