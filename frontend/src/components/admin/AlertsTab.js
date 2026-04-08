import React from 'react';
import { FaSync, FaBell } from 'react-icons/fa';

const AlertsTab = ({ handleRefreshAlerts }) => (
    <div className="card-white">
        <div className="card-header">
            <h5>System Alerts & Notifications</h5>
            <button className="btn-primary-sm" onClick={handleRefreshAlerts}><FaSync /> Refresh Sync</button>
        </div>
        <div className="empty-state" style={{ textAlign: 'center', padding: '40px 0' }}>
            <FaBell style={{ fontSize: '3rem', color: '#ccc', margin: '0 auto 1rem', display: 'block' }} />
            <p>System is running smoothly. No recent security or system alerts.</p>
        </div>
    </div>
);
export default AlertsTab;