import React, { useMemo, useState } from 'react';
import { FaSun, FaCloudSun, FaMoon, FaPrint, FaSync, FaPhone, FaEnvelope, FaTimes } from 'react-icons/fa';

console.log('✅ StaffRosterTab component loaded - NEW VERSION');
const SHIFTS = [
  { key: 'morning', label: 'Morning', time: '6:00 AM – 2:00 PM', icon: <FaSun /> },
  { key: 'afternoon', label: 'Afternoon', time: '2:00 PM – 10:00 PM', icon: <FaCloudSun /> },
  { key: 'night', label: 'Night', time: '10:00 PM – 6:00 AM', icon: <FaMoon /> },
];

const getShift = (index) => SHIFTS[index % 3];

const getAccountStatus = (m) => {
  if (m.status === 'active') return 'active';
  if (m.isActive) return 'active';
  return 'inactive';
};

const ShiftModal = ({ shift, members, onClose }) => {
  if (!shift) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: 16, width: 450, maxHeight: '80vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: 16, borderBottom: '1px solid #E8D6CC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>{shift.label} Shift</strong>
            <div style={{ fontSize: 12, color: '#7A5C4E' }}>{shift.time}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}><FaTimes /></button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto' }}>
          {members.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#7A5C4E' }}>No staff assigned</div>
          ) : (
            members.map(m => (
              <div key={m._id} style={{ padding: 10, borderBottom: '1px solid #E8D6CC' }}>
                <strong>{m.firstName} {m.lastName}</strong>
                <div style={{ fontSize: 12, color: '#7A5C4E' }}>{m.role || 'staff'} • {m.email || ''}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const StaffRosterTab = ({ staff = [], onRefresh }) => {
  const [page, setPage] = useState(1);
  const [activeShift, setActiveShift] = useState(null);
  const itemsPerPage = 10;

  const activeStaff = useMemo(() => {
    return staff
      .filter(m => getAccountStatus(m) === 'active')
      .map((m, idx) => ({ ...m, shift: getShift(idx) }));
  }, [staff]);

  const shiftCounts = useMemo(() => {
    return SHIFTS.map(s => ({
      ...s,
      count: activeStaff.filter(m => m.shift.key === s.key).length,
      members: activeStaff.filter(m => m.shift.key === s.key),
    }));
  }, [activeStaff]);

  const paginatedStaff = activeStaff.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(activeStaff.length / itemsPerPage);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head><title>Staff Roster</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background: #f5f5f5; }
        </style>
        </head>
        <body>
          <h2>Kanang-Alalay Staff Roster</h2>
          <p>Generated: ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr><th>Name</th><th>Role</th><th>Shift</th><th>Email</th><th>Phone</th></tr>
            </thead>
            <tbody>
              ${activeStaff.map(m => `
                <tr>
                  <td>${m.firstName} ${m.lastName}</td>
                  <td>${m.role || 'staff'}</td>
                  <td>${m.shift.label}</td>
                  <td>${m.email || '—'}</td>
                  <td>${m.phone || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  return (
    <div>
      {/* Shift Cards - Clickable */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {shiftCounts.map(shift => (
          <div
            key={shift.key}
            onClick={() => setActiveShift(shift)}
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 20,
              textAlign: 'center',
              cursor: 'pointer',
              border: '1px solid #E8D6CC',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'; }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>{shift.icon}</div>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1A0A00' }}>{shift.count}</div>
            <div style={{ fontWeight: 600, color: '#7A5C4E' }}>{shift.label} Shift</div>
            <div style={{ fontSize: 11, color: '#A38070', marginTop: 4 }}>{shift.time}</div>
          </div>
        ))}
      </div>

      {/* Staff Table - Simple like Recent Bookings */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E8D6CC', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8D6CC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h5 style={{ margin: 0, fontFamily: 'Playfair Display, serif', fontSize: '1.2rem' }}>Staff Roster</h5>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handlePrint} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E8D6CC', background: 'white', cursor: 'pointer' }}><FaPrint /> Print</button>
            <button onClick={onRefresh} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E8D6CC', background: 'white', cursor: 'pointer' }}><FaSync /> Refresh</button>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#FFF8F3', borderBottom: '1px solid #E8D6CC' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#A38070', textTransform: 'uppercase' }}>NAME</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#A38070', textTransform: 'uppercase' }}>ROLE</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#A38070', textTransform: 'uppercase' }}>SHIFT</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#A38070', textTransform: 'uppercase' }}>CONTACT</th>
            </tr>
          </thead>
          <tbody>
            {paginatedStaff.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#7A5C4E' }}>No active staff members found.</td></tr>
            ) : (
              paginatedStaff.map(m => (
                <tr key={m._id} style={{ borderBottom: '1px solid #E8D6CC' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <strong>{m.firstName} {m.lastName}</strong>
                    <div style={{ fontSize: 11, color: '#7A5C4E' }}>@{m.username || '—'}</div>
                  </td>
                  <td style={{ padding: '14px 16px', textTransform: 'capitalize' }}>{m.role || 'staff'}</td>
                  <td style={{ padding: '14px 16px' }}>
                    {m.shift.icon} {m.shift.label}
                    <div style={{ fontSize: 11, color: '#7A5C4E' }}>{m.shift.time}</div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {m.phone && <div><FaPhone size={10} style={{ marginRight: 5 }} />{m.phone}</div>}
                    {m.email && <div><FaEnvelope size={10} style={{ marginRight: 5 }} />{m.email}</div>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #E8D6CC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#7A5C4E' }}>Showing {(page - 1) * itemsPerPage + 1}–{Math.min(page * itemsPerPage, activeStaff.length)} of {activeStaff.length}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #E8D6CC', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}>Prev</button>
              <span style={{ padding: '5px 12px', borderRadius: 6, background: '#F96B38', color: 'white', fontWeight: 600 }}>{page}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #E8D6CC', background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1 }}>Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Shift Modal */}
      {activeShift && (
        <ShiftModal shift={activeShift} members={activeShift.members} onClose={() => setActiveShift(null)} />
      )}
    </div>
  );
};

export default StaffRosterTab;