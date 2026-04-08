import React, { useState } from 'react';

const BookingTab = ({ bookings, setBookings }) => {
    const [showBookingModal, setShowBookingModal] = useState(false);

    return (
        <div className="card-white">
            <div className="card-header">
                <h5>Admission & Booking (Outreach System)</h5>
                <button className="btn-primary-sm" onClick={() => setShowBookingModal(true)}>New Booking</button>
            </div>

            {bookings.length === 0 ? (
                <div className="no-data">No bookings scheduled yet</div>
            ) : (
                <table className="custom-table">
                    <thead>
                        <tr><th>Requester</th><th>Type</th><th>Date & Time</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        {/* Map bookings here */}
                    </tbody>
                </table>
            )}

            {/* NEW BOOKING MODAL */}
            {showBookingModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h4>New Booking</h4>
                        <h6>Requester Information</h6>
                        <div className="form-group"><label>Full Name</label><input type="text" /></div>
                        <div className="form-group"><label>Organization Name (Optional)</label><input type="text" /></div>
                        <div className="form-group"><label>Contact Number</label><input type="text" /></div>
                        <div className="form-group"><label>Email</label><input type="email" /></div>
                        
                        <h6>Booking Details</h6>
                        <div className="form-group">
                            <label>Request Type</label>
                            <select>
                                <option>Outreach Program</option>
                                <option>Food Donation</option>
                                <option>Medical Mission</option>
                                <option>Facility Visit</option>
                            </select>
                        </div>
                        <div className="form-group"><label>Date</label><input type="date" /></div>
                        <div className="form-group"><label>Time Slot</label><input type="time" /></div>
                        <div className="form-group"><label>Number of Participants</label><input type="number" /></div>
                        <div className="form-group"><label>Notes</label><textarea></textarea></div>
                        
                        <div className="modal-actions">
                            <button onClick={() => setShowBookingModal(false)}>Cancel</button>
                            <button className="btn-primary-sm">Submit Booking</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookingTab;