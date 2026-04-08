// StaffBadge.js
import React from 'react';
import QRCode from 'qrcode.react';

const StaffBadge = ({ staff }) => {
    return (
        <div className="staff-badge">
            <div className="badge-header">
                <img src="/lsae-logo.png" alt="LSAE Logo" />
                <h2>LITTLE SISTERS HOME</h2>
                <p>Staff Identification Card</p>
            </div>
            
            <div className="badge-content">
                <div className="badge-photo">
                    {/* Placeholder for staff photo */}
                    <div className="photo-placeholder">
                        {staff.firstName.charAt(0)}{staff.lastName.charAt(0)}
                    </div>
                </div>
                
                <div className="badge-info">
                    <div className="info-row">
                        <strong>Name:</strong>
                        <span>{staff.firstName} {staff.lastName}</span>
                    </div>
                    <div className="info-row">
                        <strong>Staff ID:</strong>
                        <span className="staff-id">{staff.staffId}</span>
                    </div>
                    <div className="info-row">
                        <strong>Badge #:</strong>
                        <span>{staff.badgeNumber}</span>
                    </div>
                    <div className="info-row">
                        <strong>Role:</strong>
                        <span>{staff.role.toUpperCase()}</span>
                    </div>
                    <div className="info-row">
                        <strong>Ward:</strong>
                        <span>{staff.ward || 'N/A'}</span>
                    </div>
                    <div className="info-row">
                        <strong>Valid Until:</strong>
                        <span>{new Date(staff.hireDate.getFullYear() + 1, staff.hireDate.getMonth(), staff.hireDate.getDate()).toLocaleDateString()}</span>
                    </div>
                </div>
                
                <div className="badge-qr">
                    <QRCode 
                        value={`LSAE:${staff.staffId}:${staff.badgeNumber}`}
                        size={80}
                    />
                </div>
            </div>
            
            <div className="badge-footer">
                <p>If found, please contact Kanang-Alalay Administration</p>
                <p>📞 (02) 8123-4567 | ✉️ kanangalalaybugbytes@gmail.com</p>
            </div>
        </div>
    );
};