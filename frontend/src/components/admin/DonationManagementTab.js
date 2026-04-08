import React from 'react';
import { FaEye, FaDownload } from 'react-icons/fa';

const DonationManagementTab = ({ donations, updateDonationStatus, handleViewDetails, handleExportPDF }) => {
    return (
        <div className="card-white">
            <div className="card-header">
                <h5>Donation Management</h5>
                <button className="btn-primary-sm" onClick={() => handleExportPDF('donations')}><FaDownload /> Export PDF</button>
            </div>
            {donations.length === 0 ? <p className="no-data">No donations found.</p> : (
                <table className="custom-table">
                    <thead>
                        <tr><th>Donor Info</th><th>Amount / Type</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        {donations.map(donation => (
                            <tr key={donation._id}>
                                <td>
                                    <strong>{donation.donorName}</strong><br />
                                    <small>{donation.email}</small>
                                </td>
                                <td>
                                    <strong style={{ color: '#28a745' }}>₱{donation.amount?.toLocaleString()}</strong><br />
                                    <small>{donation.donationType}</small>
                                </td>
                                <td><span className={`status ${donation.paymentStatus}`}>{donation.paymentStatus}</span></td>
                                <td className="actions">
                                    {donation.paymentStatus === 'pending' && (
                                        <button className="btn-success-sm" onClick={() => updateDonationStatus(donation._id, 'paid')}>Mark Paid</button>
                                    )}
                                    {donation.paymentStatus === 'processing' && (
                                        <button className="btn-primary-sm" onClick={() => updateDonationStatus(donation._id, 'paid')}>Confirm</button>
                                    )}
                                    <span className="view" onClick={() => handleViewDetails('donation', donation)} title="View Details">
                                        <FaEye />
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default DonationManagementTab;