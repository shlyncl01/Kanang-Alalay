import React from 'react';
import { FaFileAlt, FaChartBar } from 'react-icons/fa';

const ComplianceTab = ({ stats, handleGenerateReport }) => (
    <div className="card-white">
        <div className="card-header">
            <h5>Medication Compliance Summary</h5>
            <button className="btn-primary-sm" onClick={() => handleGenerateReport('Compliance Document')}><FaFileAlt /> Full Document</button>
        </div>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', padding: '1rem 0', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', padding: '2rem', background: '#f8f9fa', borderRadius: '10px', minWidth: '200px', border: '2px solid #eee' }}>
                <h1 style={{ fontSize: '3.5rem', color: '#b85c2d', margin: 0 }}>{stats.complianceRate || 92}%</h1>
                <p style={{ margin: 0, color: '#666', fontWeight: 'bold' }}>COMPLIANCE TODAY</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', flex: 1, minWidth: '250px' }}>
                <div style={{ padding: '1.5rem', border: '1px solid #eee', borderRadius: '8px', background: 'white' }}>
                    <h3 style={{ margin: 0, fontSize: '1.8rem' }}>24</h3><p style={{ margin: 0, color: '#666' }}>Scheduled</p>
                </div>
                <div style={{ padding: '1.5rem', border: '1px solid #eee', borderRadius: '8px', background: 'white' }}>
                    <h3 style={{ margin: 0, fontSize: '1.8rem', color: '#28a745' }}>21</h3><p style={{ margin: 0, color: '#666' }}>Administered</p>
                </div>
                <div style={{ padding: '1.5rem', border: '1px solid #eee', borderRadius: '8px', background: 'white' }}>
                    <h3 style={{ margin: 0, fontSize: '1.8rem', color: '#dc3545' }}>{stats.missedMeds || 2}</h3><p style={{ margin: 0, color: '#666' }}>Missed</p>
                </div>
                <div style={{ padding: '1.5rem', border: '1px solid #eee', borderRadius: '8px', background: 'white' }}>
                    <h3 style={{ margin: 0, fontSize: '1.8rem', color: '#ffc107' }}>{stats.delayedMeds || 1}</h3><p style={{ margin: 0, color: '#666' }}>Delayed</p>
                </div>
            </div>
        </div>
        <div style={{ marginTop: '2rem', padding: '2rem', background: '#f8f9fa', borderRadius: '10px', textAlign: 'center', border: '1px solid #eee' }}>
            <h6 style={{ color: '#333', marginBottom: '1rem' }}>Weekly Adherence Trend Analysis</h6>
            <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', border: '2px dashed #ddd', borderRadius: '8px', background: 'white' }}>
                <FaChartBar style={{ fontSize: '2.5rem', marginRight: '15px', color: '#b85c2d' }} /> 
                <span>Average <strong>92% adherence</strong> tracked this week across all active resident wards.</span>
            </div>
        </div>
    </div>
);
export default ComplianceTab;