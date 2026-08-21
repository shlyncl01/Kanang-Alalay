import React, { useState, useEffect } from 'react';
import { FaFileAlt, FaTimes, FaUserMd, FaClock, FaCheckCircle, FaCalendarAlt } from 'react-icons/fa';

const DetailModal = ({ type, residents, onClose }) => {
    const config = {
        scheduled:    { title: 'Scheduled Today',       color: '#1A0A00', bg: '#f8f9fa', icon: <FaCalendarAlt />, accent: '#b85c2d' },
        administered: { title: 'Administered',           color: '#28a745', bg: '#f0fff4', icon: <FaCheckCircle />, accent: '#28a745' },
        missed:       { title: 'Missed Medications',     color: '#dc3545', bg: '#fff5f5', icon: <FaTimes />,       accent: '#dc3545' },
        delayed:      { title: 'Delayed Medications',    color: '#856404', bg: '#fffbeb', icon: <FaClock />,       accent: '#ffc107' },
    };
    const c = config[type] || config.scheduled;

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={onClose}
        >
            <div
                style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ padding: '18px 22px', borderBottom: '1.5px solid #E8D6CC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: c.bg, borderRadius: '18px 18px 0 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: c.accent + '20', color: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                            {c.icon}
                        </div>
                        <div>
                            <strong style={{ color: c.color, fontSize: '1rem' }}>{c.title}</strong>
                            <div style={{ fontSize: 11, color: '#7A5C4E' }}>{residents.length} {type === 'administered' ? 'dose' : 'medication'}{residents.length !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#7A5C4E' }}><FaTimes /></button>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
                    {residents.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#7A5C4E', fontStyle: 'italic' }}>No medications in this category today.</div>
                    ) : (
                        residents.map((r, i) => (
                            <div key={r._id || i} style={{ padding: '12px 22px', borderBottom: i < residents.length - 1 ? '1px solid #E8D6CC' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 34, height: 34, borderRadius: '50%', background: c.accent + '15', color: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0 }}>
                                    <FaUserMd size={13} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <strong style={{ fontSize: '0.9rem', color: '#1A0A00' }}>{r.residentName}</strong>
                                    <div style={{ fontSize: '0.75rem', color: '#7A5C4E', marginTop: 2 }}>
                                        {r.medicationName} · {r.room}
                                    </div>
                                </div>
                                <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: c.accent + '15', color: c.accent }}>
                                    {r.nextDose || 'Scheduled'}
                                </span>
                            </div>
                        ))
                    )}
                </div>

                <div style={{ padding: '14px 22px', borderTop: '1.5px solid #E8D6CC', textAlign: 'right' }}>
                    <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 9, border: '1.5px solid #E8D6CC', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: '#7A5C4E', fontFamily: "'DM Sans', sans-serif" }}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

const ComplianceTab = ({ stats: propStats, handleGenerateReport }) => {
    const [modal, setModal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [complianceData, setComplianceData] = useState(null);
    const [medicationLogs, setMedicationLogs] = useState({
        scheduled: [],
        administered: [],
        missed: [],
        delayed: [],
        overdue: []
    });

    // Fetch compliance statistics from backend
    useEffect(() => {
        const fetchComplianceStats = async () => {
            try {
                setLoading(true);
                setError(null);

                // Fetch summary stats
                const statsRes = await fetch('/api/medications/compliance/stats', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });

                if (!statsRes.ok) {
                    throw new Error('Failed to fetch compliance stats');
                }

                const statsData = await statsRes.json();
                setComplianceData(statsData.stats);

                // Fetch detailed logs to populate modals
                const logsRes = await fetch('/api/medicationLogs?today=true', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });

                if (logsRes.ok) {
                    const logsData = await logsRes.json();
                    // Group logs by status
                    const grouped = {
                        scheduled: [],
                        administered: [],
                        missed: [],
                        delayed: [],
                        overdue: []
                    };

                    logsData.forEach(log => {
                        if (log.status === 'scheduled' || log.status === 'pending') {
                            grouped.scheduled.push(log);
                        } else if (log.status === 'administered') {
                            grouped.administered.push(log);
                        } else if (log.status === 'missed') {
                            grouped.missed.push(log);
                        } else if (log.status === 'delayed') {
                            grouped.delayed.push(log);
                        } else if (log.status === 'overdue') {
                            grouped.overdue.push(log);
                        }
                    });

                    setMedicationLogs(grouped);
                }

                setLoading(false);
            } catch (err) {
                console.error('Error fetching compliance data:', err);
                setError(err.message);
                setLoading(false);
            }
        };

        fetchComplianceStats();
    }, []);

    const stats = complianceData || propStats || {};

    const cards = [
        { key: 'scheduled',    value: stats.scheduled || 0,    label: 'Scheduled',    color: '#1A0A00', border: '#b85c2d', icon: <FaCalendarAlt />, iconColor: '#b85c2d' },
        { key: 'administered', value: stats.administered || 0,  label: 'Administered', color: '#28a745', border: '#28a745', icon: <FaCheckCircle />, iconColor: '#28a745' },
        { key: 'missed',       value: stats.missed || 0,        label: 'Missed',       color: '#dc3545', border: '#dc3545', icon: <FaTimes />,       iconColor: '#dc3545' },
        { key: 'delayed',      value: stats.delayed || 0,       label: 'Delayed',      color: '#856404', border: '#ffc107', icon: <FaClock />,       iconColor: '#ffc107' },
    ];

    const getModalResidents = () => {
        const mapping = {
            'scheduled': medicationLogs.scheduled,
            'administered': medicationLogs.administered,
            'missed': medicationLogs.missed,
            'delayed': medicationLogs.delayed,
        };
        return mapping[modal] || [];
    };

    // Build weekly data from dailyBreakdown or fallback
    const weeklyData = complianceData?.weeklyData || [
        { day: 'Mon', rate: 0, color: '#F96B38' },
        { day: 'Tue', rate: 0, color: '#F96B38' },
        { day: 'Wed', rate: 0, color: '#E65100' },
        { day: 'Thu', rate: 0, color: '#28a745' },
        { day: 'Fri', rate: 0, color: '#F96B38' },
        { day: 'Sat', rate: 0, color: '#F96B38' },
        { day: 'Sun', rate: 0, color: '#28a745' },
    ];

    // If we have dailyBreakdown from the API, map it to weeklyData
    if (complianceData?.dailyBreakdown && complianceData.dailyBreakdown.length > 0) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        complianceData.dailyBreakdown.forEach(day => {
            const dateObj = new Date(day.date);
            const dayIndex = dateObj.getDay();
            const dayName = dayNames[dayIndex];
            
            // Update the weekly data for this day
            const weeklyIndex = weeklyData.findIndex(w => w.day === dayName);
            if (weeklyIndex >= 0) {
                weeklyData[weeklyIndex].rate = day.rate;
                // Adjust color based on rate
                if (day.rate >= 90) {
                    weeklyData[weeklyIndex].color = '#28a745'; // Green
                } else if (day.rate >= 85) {
                    weeklyData[weeklyIndex].color = '#F96B38'; // Orange
                } else {
                    weeklyData[weeklyIndex].color = '#E65100'; // Dark orange
                }
            }
        });
    }

    const avgRate = weeklyData.length > 0 
        ? (weeklyData.reduce((s, d) => s + d.rate, 0) / weeklyData.length).toFixed(1)
        : 0;

    if (loading) {
        return (
            <div className="card-white" style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: '#7A5C4E' }}>Loading compliance data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card-white" style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: '#dc3545' }}>Error: {error}</p>
            </div>
        );
    }

    return (
        <>
            <div className="card-white">
                <div className="card-header">
                    <h5>Medication Compliance Chart</h5>
                    <button className="btn-primary-sm" onClick={() => handleGenerateReport?.('Compliance Document')}>
                        <FaFileAlt /> Full Report
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch', padding: '1rem 0', flexWrap: 'wrap' }}>
                    {/* Overall % */}
                    <div style={{ textAlign: 'center', padding: '2rem 1.5rem', background: '#FFF8F3', borderRadius: 14, minWidth: 180, border: '2px solid #E8D6CC', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <h1 style={{ fontSize: '3.5rem', color: '#F96B38', margin: 0, fontFamily: "'Playfair Display', serif" }}>
                            {stats.complianceRate || 0}%
                        </h1>
                        <p style={{ margin: '8px 0 0', color: '#7A5C4E', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Overall Compliance Rate
                        </p>
                    </div>

                    {/* 4 clickable cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', flex: 1, minWidth: 260 }}>
                        {cards.map(card => (
                            <div
                                key={card.key}
                                onClick={() => setModal(card.key)}
                                title="Click to see details"
                                style={{
                                    padding: '1.2rem 1rem', border: `2px solid ${card.border}30`,
                                    borderLeft: `4px solid ${card.border}`, borderRadius: 12,
                                    background: '#fff', cursor: 'pointer', transition: 'all 0.18s ease',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = `0 6px 20px ${card.border}25`;
                                    e.currentTarget.style.background = card.border + '08';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                    e.currentTarget.style.background = '#fff';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: card.iconColor + '20', color: card.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem' }}>
                                        {card.icon}
                                    </div>
                                    <span style={{ fontSize: '0.62rem', color: card.iconColor, fontWeight: 600 }}>tap to view →</span>
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.9rem', color: card.color, fontFamily: "'Playfair Display', serif" }}>{card.value}</h3>
                                <p style={{ margin: '3px 0 0', color: '#7A5C4E', fontSize: '0.78rem', fontWeight: 600 }}>{card.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Weekly chart */}
                <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: '#FFF8F3', borderRadius: 12, border: '1px solid #E8D6CC' }}>
                    <h6 style={{ color: '#7A5C4E', marginBottom: '1rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                        Weekly Adherence Trend
                    </h6>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 110 }}>
                        {weeklyData.map((item, i) => (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                <small style={{ fontSize: '0.68rem', color: '#7A5C4E', fontWeight: 600 }}>{item.rate}%</small>
                                <div 
                                    style={{ 
                                        width: '100%', 
                                        height: `${Math.max(item.rate * 0.85, 4)}px`, 
                                        minHeight: 4, 
                                        borderRadius: '5px 5px 0 0', 
                                        background: item.color,
                                        transition: 'all 0.3s ease'
                                    }} 
                                />
                                <small style={{ fontSize: '0.68rem', color: '#7A5C4E' }}>{item.day}</small>
                            </div>
                        ))}
                    </div>
                    <p style={{ marginTop: 12, fontSize: '0.8rem', color: '#7A5C4E', textAlign: 'center' }}>
                        Average <strong style={{ color: '#F96B38' }}>{avgRate}% adherence</strong> tracked this week across all active resident wards.
                    </p>
                </div>
            </div>

            {modal && (
                <DetailModal type={modal} residents={getModalResidents()} onClose={() => setModal(null)} />
            )}
        </>
    );
};

export default ComplianceTab;