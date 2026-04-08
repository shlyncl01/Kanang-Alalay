import React from 'react';
import { FaUsers, FaCalendarCheck, FaExclamationTriangle } from 'react-icons/fa';

const OverviewTab = ({ stats, activities, setActiveSection }) => {
    return (
        <div className="overview-content">
            <div className="stats-grid">
                <div className="stat-card clickable" onClick={() => setActiveSection('users')}>
                    <div className="stat-icon" style={{ background: '#b85c2d' }}><FaUsers /></div>
                    <div className="stat-info">
                        <h3>{stats.staffOnDuty}</h3><p>Staff On Duty</p>
                    </div>
                </div>
                <div className="stat-card clickable" onClick={() => setActiveSection('bookings')}>
                    <div className="stat-icon" style={{ background: '#17a2b8' }}><FaCalendarCheck /></div>
                    <div className="stat-info">
                        <h3>{stats.pendingBookings}</h3><p>Pending Bookings</p>
                    </div>
                </div>
                <div className="stat-card clickable" onClick={() => setActiveSection('inventory')}>
                    <div className="stat-icon" style={{ background: '#dc3545' }}><FaExclamationTriangle /></div>
                    <div className="stat-info">
                        <h3>{stats.lowStockItems}</h3><p>Low Stock Items</p>
                    </div>
                </div>
            </div>

            <div className="card-white">
                <div className="card-header">
                    <h5>Recent Activity Feed</h5>
                </div>
                <div className="activity-feed">
                    {activities.length === 0 ? (
                        <div className="no-data">No recent activities</div>
                    ) : (
                        <ul className="activity-list">
                            {activities.map((activity, index) => (
                                <li key={index}>
                                    <span className="time">{activity.time}</span>
                                    <span className="details">{activity.details}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OverviewTab;