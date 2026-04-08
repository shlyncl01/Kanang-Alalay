import React from 'react';
import { FaEnvelope, FaPhone, FaCalendarAlt, FaEye, FaEdit, FaDownload } from 'react-icons/fa';

const BookingManagementTab = ({ bookings, updateBookingStatus, handleViewDetails, handleEditBooking, handleExportPDF }) => {
    return (
        <div className="card-white">
            <div className="card-header">
                <h5>Booking Management</h5>
                <button className="btn-primary-sm" onClick={() => handleExportPDF('bookings')}><FaDownload /> Export PDF</button>
            </div>
            {bookings.length === 0 ? <p className="no-data">No bookings found.</p> : (
                <table className="custom-table">
                    <thead>
                        <tr><th>Visitor</th><th>Details</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        {bookings.map(booking => (
                            <tr key={booking._id}>
                                <td>
                                    <strong>{booking.name}</strong><br />
                                    <small><FaEnvelope /> {booking.email} | <FaPhone /> {booking.phone}</small>
                                </td>
                                <td>
                                    <FaCalendarAlt /> {new Date(booking.visitDate).toLocaleDateString()} at {booking.visitTime}<br />
                                    <small>Purpose: {booking.purpose} ({booking.numberOfVisitors} pax)</small>
                                </td>
                                <td><span className={`status ${booking.status}`}>{booking.status}</span></td>
                                <td className="actions">
                                    {booking.status === 'pending' && (
                                        <>
                                            <button className="btn-success-sm" onClick={() => updateBookingStatus(booking._id, 'approved')} style={{ marginRight: '5px' }}>Approve</button>
                                            <button className="btn-outline-sm" onClick={() => updateBookingStatus(booking._id, 'rejected')} style={{ color: '#dc3545', borderColor: '#dc3545' }}>Reject</button>
                                        </>
                                    )}
                                    {booking.status === 'approved' && (
                                        <button className="btn-primary-sm" onClick={() => updateBookingStatus(booking._id, 'completed')}>Complete</button>
                                    )}
                                    <span className="view" onClick={() => handleViewDetails('booking', booking)} title="View Details">
                                        <FaEye />
                                    </span>
                                    <span className="edit" onClick={() => handleEditBooking(booking)} title="Edit Status">
                                        <FaEdit />
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

export default BookingManagementTab;