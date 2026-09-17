import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
    FaSearch, FaFilter, FaTimes, FaChevronLeft, FaChevronRight,
    FaHistory, FaUserCircle, FaCheckCircle, FaTimesCircle,
} from 'react-icons/fa';
import { API_URL } from '../../config/api';
import { useSocket } from '../../hooks/useSocket';

// ─── constants ────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = ['all', 'admin', 'head_caregiver', 'caregiver'];
const ROLE_LABEL = { admin: 'Admin', head_caregiver: 'Head Caregiver', caregiver: 'Caregiver' };

const MODULE_OPTIONS = [
    'all', 'User Management', 'Staff Roster', 'Residents', 'Medication',
    'Inventory', 'Donations', 'Bookings', 'Login/Account Security', 'Other',
];

const STATUS_OPTIONS = ['all', 'success', 'failed'];
const PAGE_SIZE = 15;

const STATUS_STYLE = {
    success: { bg: '#EEFBF5', color: '#1E7D56', icon: <FaCheckCircle size={10} /> },
    failed: { bg: '#FFF0F0', color: '#C0392B', icon: <FaTimesCircle size={10} /> },
};

const ROLE_COLOR = {
    admin: { bg: '#dc3545', color: '#fff' },
    head_caregiver: { bg: '#b85c2d', color: '#fff' },
    caregiver: { bg: '#28a745', color: '#fff' },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const formatAction = (action = '') =>
    action.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

const formatDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-PH', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};

// ─── AuditTrailTab ──────────────────────────────────────────────────────────────

const AuditTrailTab = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [moduleFilter, setModuleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [prevIds, setPrevIds] = useState(new Set());
    const [highlightIds, setHighlightIds] = useState(new Set());

    // Debounce free-text search so we're not hitting the API on every keystroke.
    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput), 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    useEffect(() => { setPage(1); }, [search, roleFilter, moduleFilter, statusFilter, dateFrom, dateTo]);

    const fetchLogs = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');
            const params = {
                page, pageSize: PAGE_SIZE,
                search: search || undefined,
                role: roleFilter !== 'all' ? roleFilter : undefined,
                module: moduleFilter !== 'all' ? moduleFilter : undefined,
                status: statusFilter !== 'all' ? statusFilter : undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
            };
            const res = await axios.get(`${API_URL}/admin/audit-trail`, {
                headers: { Authorization: `Bearer ${token}` },
                params,
            });
            const freshLogs = res.data.data || [];

            // Flag rows that weren't in the previous fetch so they can get a
            // brief highlight — only meaningful on page 1 with no filters,
            // where a live push actually lands at the top of the list.
            setPrevIds((prevIdSet) => {
                const newlyArrived = new Set(
                    freshLogs.filter((l) => prevIdSet.size > 0 && !prevIdSet.has(l._id)).map((l) => l._id)
                );
                if (newlyArrived.size > 0) {
                    setHighlightIds(newlyArrived);
                    setTimeout(() => setHighlightIds(new Set()), 2500);
                }
                return new Set(freshLogs.map((l) => l._id));
            });

            setLogs(freshLogs);
            setTotalPages(res.data.pagination?.totalPages || 1);
            setTotal(res.data.pagination?.total || 0);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load audit trail.');
        } finally {
            setLoading(false);
        }
    }, [page, search, roleFilter, moduleFilter, statusFilter, dateFrom, dateTo]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    // ── Real-time updates ───────────────────────────────────────────────────
    // Every logAudit() write on the backend emits 'new_audit_log' the moment
    // it's saved (see utils/auditLog.js), so this tab stays live instead of
    // only refreshing on manual reload — same io.emit()/useSocket() pattern
    // AdminDashboard.js already uses for bookings, staff, and inventory.
    const { on, off } = useSocket();
    const refetchTimer = useRef(null);

    useEffect(() => {
        const handleNewAuditLog = () => {
            // A burst of actions (e.g. a bulk import) can fire several log
            // entries within milliseconds of each other — coalesce those into
            // a single refetch instead of hammering the API once per entry.
            clearTimeout(refetchTimer.current);
            refetchTimer.current = setTimeout(() => {
                fetchLogs();
            }, 600);
        };

        on('new_audit_log', handleNewAuditLog);
        return () => {
            off('new_audit_log', handleNewAuditLog);
            clearTimeout(refetchTimer.current);
        };
    }, [on, off, fetchLogs]);

    const clearFilters = () => {
        setSearchInput(''); setSearch('');
        setRoleFilter('all'); setModuleFilter('all'); setStatusFilter('all');
        setDateFrom(''); setDateTo('');
    };

    const hasActiveFilters = search || roleFilter !== 'all' || moduleFilter !== 'all' ||
        statusFilter !== 'all' || dateFrom || dateTo;

    const sel = { padding: '8px 12px', border: '1.5px solid #E8D6CC', borderRadius: 9, fontSize: '.85rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', fontFamily: "'DM Sans',sans-serif", cursor: 'pointer' };
    const pgBtn = (disabled) => ({ padding: '5px 9px', borderRadius: 8, border: '1.5px solid #E8D6CC', background: disabled ? '#f5f5f5' : '#FFF8F3', cursor: disabled ? 'not-allowed' : 'pointer', color: '#7A5C4E', display: 'flex', alignItems: 'center' });

    return (
        <div>
            <style>{`
                @keyframes auditLivePulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: .4; transform: scale(1.3); }
                }
                @keyframes auditNewRow {
                    0% { background-color: #FFF3E0; }
                    100% { background-color: transparent; }
                }
            `}</style>
            {/* Controls */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                    <FaSearch style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#7A5C4E', fontSize: '.82rem' }} />
                    <input
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        placeholder="Search by user, action, or description…"
                        style={{ width: '100%', padding: '9px 34px', border: '1.5px solid #E8D6CC', borderRadius: 9, fontFamily: "'DM Sans',system-ui,sans-serif", fontSize: '.88rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', boxSizing: 'border-box' }}
                    />
                    {searchInput && <button onClick={() => setSearchInput('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7A5C4E' }}><FaTimes size={12} /></button>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FaFilter style={{ color: '#7A5C4E', fontSize: '.8rem' }} />
                    <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={sel}>
                        {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r === 'all' ? 'Role: All' : ROLE_LABEL[r] || r}</option>)}
                    </select>
                </div>

                <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} style={sel}>
                    {MODULE_OPTIONS.map(m => <option key={m} value={m}>{m === 'all' ? 'Module: All' : m}</option>)}
                </select>

                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sel}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s === 'all' ? 'Status: All' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...sel, cursor: 'text' }} />
                    <span style={{ color: '#7A5C4E', fontSize: '.8rem' }}>to</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...sel, cursor: 'text' }} />
                </div>

                {hasActiveFilters && (
                    <button onClick={clearFilters} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1.5px solid #E8D6CC', background: 'transparent', color: '#7A5C4E', cursor: 'pointer', fontWeight: 600, fontSize: '.82rem', fontFamily: "'DM Sans',sans-serif" }}>
                        <FaTimes size={11} /> Clear Filters
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="card-white" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1.5px solid #E8D6CC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h5 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FaHistory /> Audit Trail
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 6, padding: '2px 9px', borderRadius: 20, background: '#EEFBF5', color: '#1E7D56', fontSize: '.68rem', fontWeight: 700, letterSpacing: '.03em' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1E7D56', animation: 'auditLivePulse 1.6s ease-in-out infinite' }} />
                            LIVE
                        </span>
                    </h5>
                    <small style={{ color: '#7A5C4E', fontSize: '.8rem' }}>{total} record{total !== 1 ? 's' : ''} found</small>
                </div>

                {error && (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: '#dc3545' }}>{error}</div>
                )}

                {!error && (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="custom-table" style={{ minWidth: 900 }}>
                            <thead>
                                <tr>
                                    <th>Date &amp; Time</th>
                                    <th>User</th>
                                    <th>Role</th>
                                    <th>Action</th>
                                    <th>Module</th>
                                    <th>Description</th>
                                    <th>Target</th>
                                    <th style={{ textAlign: 'center' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: '#7A5C4E' }}>Loading audit trail…</td></tr>
                                ) : logs.length === 0 ? (
                                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: '#7A5C4E', fontStyle: 'italic' }}>
                                        {hasActiveFilters ? 'No records match your filters.' : 'No audit records yet.'}
                                    </td></tr>
                                ) : logs.map(log => {
                                    const roleStyle = ROLE_COLOR[log.role || log.user?.role] || { bg: '#6c757d', color: '#fff' };
                                    const stStyle = STATUS_STYLE[log.status] || STATUS_STYLE.success;
                                    const userName = log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System';
                                    const isNew = highlightIds.has(log._id);
                                    return (
                                        <tr key={log._id} style={isNew ? { animation: 'auditNewRow 2.5s ease-out' } : undefined}>
                                            <td style={{ fontSize: '.85rem', whiteSpace: 'nowrap' }}>{formatDateTime(log.createdAt)}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <FaUserCircle size={22} color="#d4b5a0" />
                                                    <span style={{ fontSize: '.88rem' }}>{userName}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: '.72rem', fontWeight: 700, background: roleStyle.bg, color: roleStyle.color }}>
                                                    {ROLE_LABEL[log.role || log.user?.role] || log.role || '—'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '.85rem', fontWeight: 600, color: '#1A0A00' }}>{formatAction(log.action)}</td>
                                            <td style={{ fontSize: '.82rem', color: '#7A5C4E' }}>{log.module || '—'}</td>
                                            <td style={{ fontSize: '.82rem', color: '#444', maxWidth: 320 }}>{log.details}</td>
                                            <td style={{ fontSize: '.82rem', color: '#7A5C4E' }}>{log.targetLabel || '—'}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 11px', borderRadius: 20, fontSize: '.74rem', fontWeight: 700, background: stStyle.bg, color: stStyle.color }}>
                                                    {stStyle.icon} {log.status === 'failed' ? 'Failed' : 'Success'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {!error && totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1.5px solid #E8D6CC', background: '#FFF8F3' }}>
                        <small style={{ color: '#7A5C4E', fontSize: '.8rem' }}>Page {page} of {totalPages}</small>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pgBtn(page === 1)}><FaChevronLeft size={11} /></button>
                            {(() => {
                                let start = Math.max(1, page - 2); let end = Math.min(totalPages, start + 4); start = Math.max(1, end - 4);
                                return Array.from({ length: end - start + 1 }, (_, i) => start + i).map(n => (
                                    <button key={n} onClick={() => setPage(n)} style={{ padding: '5px 10px', borderRadius: 8, fontSize: '.82rem', fontWeight: 600, border: `1.5px solid ${page === n ? '#b85c2d' : '#E8D6CC'}`, background: page === n ? '#b85c2d' : '#FFF8F3', color: page === n ? '#fff' : '#7A5C4E', cursor: 'pointer' }}>{n}</button>
                                ));
                            })()}
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pgBtn(page === totalPages)}><FaChevronRight size={11} /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditTrailTab;