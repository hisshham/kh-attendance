import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { getSocket } from '../services/socket';

function getISTDate() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// ── SVG Icons ──
const Icons = {
    dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
    clipboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>,
    people: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
    settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    sun: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    moon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
};

// ── Toast Hook ──
function useToast() {
    const [toasts, setToasts] = useState([]);
    const idRef = useRef(0);

    const showToast = useCallback((message, type = 'success') => {
        const id = ++idRef.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
            setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
        }, 3000);
    }, []);

    const ToastContainer = () => (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast toast-${t.type} ${t.exiting ? 'toast-exit' : ''}`}>
                    {t.type === 'success' ? '✓' : '✕'} {t.message}
                </div>
            ))}
        </div>
    );

    return { showToast, ToastContainer };
}

export default function ManagerDashboard() {
    const { user, logout, token } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { showToast, ToastContainer } = useToast();
    const [activeTab, setActiveTab] = useState('overview');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Data
    const [selectedDate, setSelectedDate] = useState(getISTDate());
    const [attendances, setAttendances] = useState([]);
    const [allWorkers, setAllWorkers] = useState([]);
    const [workers, setWorkers] = useState([]);

    // Master Data
    const [masterData, setMasterData] = useState({ lineData: [], categories: [] });
    const [newLineData, setNewLineData] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [newExperience, setNewExperience] = useState('');
    const [selectedSettingCategory, setSelectedSettingCategory] = useState(null);

    // Settings
    const [notificationTime, setNotificationTime] = useState('08:30');
    const [notificationEnabled, setNotificationEnabled] = useState(true);
    const [callAlertEnabled, setCallAlertEnabled] = useState(false);
    const [callAlertTime, setCallAlertTime] = useState('09:00');
    const [editDeadlineEnabled, setEditDeadlineEnabled] = useState(false);
    const [editDeadlineTime, setEditDeadlineTime] = useState('10:00');

    // UI
    const [newWorker, setNewWorker] = useState({ workerId: '', name: '', pin: '123456', lineData: '', category: '', experience: '' });
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({ workerId: '', name: '', lineData: '', category: '', experience: '' });
    const [profileData, setProfileData] = useState({ username: user?.username || '', rawPin: '' });
    const [expandedCard, setExpandedCard] = useState(null);

    useEffect(() => {
        if (token) {
            loadAttendance();
            loadWorkers();
            loadSettings();

            const socket = getSocket();
            socket.emit('join_manager');
            socket.on('attendance_update', () => loadAttendance());

            return () => { socket.off('attendance_update'); };
        }
    }, [token, selectedDate]);

    async function loadAttendance() {
        try {
            const res = await api.get(`/api/manager/attendance?date=${selectedDate}`);
            setAttendances(res.data.attendances || []);
            setAllWorkers(res.data.allWorkers || []);
        } catch (err) { }
    }
    async function loadWorkers() {
        try { const res = await api.get('/api/manager/workers'); setWorkers(res.data); } catch (err) { }
    }
    async function loadSettings() {
        try {
            const res = await api.get('/api/manager/settings');
            let md = res.data.masterData || { lineData: [], categories: [] };
            // Auto-migrate legacy flat structures to the hierarchical model
            if (md.categories && typeof md.categories[0] === 'string') {
                const legacyExp = md.experience || [];
                md.categories = md.categories.map(c => ({ name: c, experience: legacyExp }));
                delete md.experience;
            }
            setMasterData(md);
            setNotificationTime(res.data.notificationTime || '08:30');
            setNotificationEnabled(res.data.notificationEnabled !== false);
            setCallAlertEnabled(res.data.callAlertEnabled || false);
            setCallAlertTime(res.data.callAlertTime || '09:00');
            setEditDeadlineEnabled(res.data.editDeadlineEnabled || false);
            setEditDeadlineTime(res.data.editDeadlineTime || '10:00');
        } catch (err) { }
    }

    // Workers
    async function handleAddWorker(e) {
        e.preventDefault();
        try {
            await api.post('/api/manager/workers', newWorker);
            setNewWorker({ workerId: '', name: '', pin: '123456', lineData: '', category: '', experience: '' });
            showToast('Worker added successfully');
            loadWorkers();
            loadAttendance();
        } catch (err) { showToast(err.response?.data?.error || 'Failed to add worker', 'error'); }
    }
    async function handleToggleWorker(id) {
        try { await api.patch(`/api/manager/workers/${id}/toggle`); loadWorkers(); loadAttendance(); } catch (err) { }
    }
    async function handleDeleteWorker(id) {
        if (!confirm('Permanently remove this worker and all their attendance history?')) return;
        try {
            await api.delete(`/api/manager/workers/${id}`);
            showToast('Worker deleted');
            loadWorkers();
            loadAttendance();
        } catch (err) { showToast('Failed to delete worker', 'error'); }
    }
    function startEdit(w) {
        setEditingId(w.id);
        setEditData({ workerId: w.workerId, name: w.name, lineData: w.lineData || '', category: w.category || '', experience: w.experience || '' });
    }
    async function saveEdit(id) {
        try {
            await api.put(`/api/manager/workers/${id}`, editData);
            setEditingId(null);
            showToast('Worker updated');
            loadWorkers();
            loadAttendance();
        } catch (err) { showToast('Failed to update worker', 'error'); }
    }
    async function handleResetPin(id) {
        if (!confirm('Reset PIN to 123456?')) return;
        try { await api.patch(`/api/manager/workers/${id}/reset-pin`); showToast('PIN reset to 123456'); } catch (err) { }
    }

    // Settings — separate saves
    async function saveMasterData() {
        try {
            await api.put('/api/manager/settings/master-data', { masterData });
            showToast('Master data saved ✓');
        } catch (err) { showToast('Failed to save master data', 'error'); }
    }
    async function saveNotifications() {
        try {
            await api.put('/api/manager/settings/notifications', { notificationEnabled, notificationTime });
            showToast('Notification settings saved ✓');
        } catch (err) { showToast('Failed to save notification settings', 'error'); }
    }
    async function saveCallAlert() {
        try {
            await api.put('/api/manager/settings/call-alert', { callAlertEnabled, callAlertTime });
            showToast('Call alert settings saved ✓');
        } catch (err) { showToast('Failed to save call alert settings', 'error'); }
    }
    async function saveEditDeadline() {
        try {
            await api.put('/api/manager/settings/edit-deadline', { editDeadlineEnabled, editDeadlineTime });
            showToast('Edit deadline saved ✓');
        } catch (err) { showToast('Failed to save edit deadline', 'error'); }
    }

    async function handleTestNotification() {
        try {
            const res = await api.post('/api/manager/send-test-notification');
            showToast(res.data.message);
        } catch (err) { showToast(err.response?.data?.error || 'Failed to send', 'error'); }
    }
    async function handleSaveProfile(e) {
        e.preventDefault();
        try {
            await api.put('/api/manager/profile', profileData);
            showToast('Profile updated ✓');
            setProfileData({ ...profileData, rawPin: '' });
        } catch (err) { showToast(err.response?.data?.error || 'Failed', 'error'); }
    }

    // Master data helpers
    function addLineData() {
        if (newLineData.trim() && !masterData.lineData.includes(newLineData.trim())) {
            setMasterData({ ...masterData, lineData: [...masterData.lineData, newLineData.trim()] });
            setNewLineData('');
        }
    }
    function removeLineData(item) { setMasterData({ ...masterData, lineData: masterData.lineData.filter(i => i !== item) }); }
    
    function addCategory() {
        const val = newCategory.trim();
        if (val && !masterData.categories.find(c => c.name === val)) {
            setMasterData({ ...masterData, categories: [...masterData.categories, { name: val, experience: [] }] });
            setNewCategory('');
        }
    }
    function removeCategory(catName) { 
        setMasterData({ ...masterData, categories: masterData.categories.filter(c => c.name !== catName) }); 
        if (selectedSettingCategory === catName) setSelectedSettingCategory(null);
    }
    
    function addExperience() {
        const val = newExperience.trim();
        if (val && selectedSettingCategory) {
            const updatedCats = masterData.categories.map(c => {
                if (c.name === selectedSettingCategory && !c.experience.includes(val)) {
                    return { ...c, experience: [...c.experience, val] };
                }
                return c;
            });
            setMasterData({ ...masterData, categories: updatedCats });
            setNewExperience('');
        }
    }
    function removeExperience(catName, expName) {
        const updatedCats = masterData.categories.map(c => {
            if (c.name === catName) {
                return { ...c, experience: c.experience.filter(e => e !== expName) };
            }
            return c;
        });
        setMasterData({ ...masterData, categories: updatedCats });
    }

    async function exportCSV() {
        try {
            const res = await api.get(`/api/manager/attendance/export?date=${selectedDate}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Attendance_${selectedDate}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) { showToast('Failed to export CSV', 'error'); }
    }

    // Calculations
    const presentAttendances = attendances.filter(a => a.isPresent);
    const absentAttendances = attendances.filter(a => !a.isPresent);
    const markedIds = new Set(attendances.map(a => a.worker?.workerId));
    const notMarkedWorkers = allWorkers.filter(w => !markedIds.has(w.workerId));
    const workerStrength = allWorkers.length;
    const presentCount = presentAttendances.length;
    const absentCount = absentAttendances.length;
    const notMarkedCount = notMarkedWorkers.length;

    // Line data breakdown
    const lineDataStats = masterData.lineData.map(ld => {
        const total = allWorkers.filter(w => w.lineData === ld).length;
        const present = presentAttendances.filter(a => a.worker?.lineData === ld).length;
        const absent = absentAttendances.filter(a => a.worker?.lineData === ld).length;
        return { name: ld, total, present, absent };
    });

    // Category breakdown
    const categoryStats = masterData.categories.map(cat => {
        const total = allWorkers.filter(w => w.category === cat.name).length;
        const present = presentAttendances.filter(a => a.worker?.category === cat.name).length;
        const absent = absentAttendances.filter(a => a.worker?.category === cat.name).length;
        return { name: cat.name, total, present, absent };
    });

    const tabItems = [
        { id: 'overview', icon: Icons.dashboard, label: 'Overview' },
        { id: 'attendance', icon: Icons.clipboard, label: 'Daily Logs' },
        { id: 'workers', icon: Icons.people, label: 'Workers' },
        { id: 'settings', icon: Icons.settings, label: 'Settings' },
    ];

    const ThemeToggle = () => (
        <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? Icons.sun : Icons.moon}
        </button>
    );

    // Detail panel renderer
    function renderDetailPanel() {
        if (!expandedCard) return null;
        let title = '', items = [];

        if (expandedCard === 'total') {
            title = `All Workers (${workerStrength})`;
            items = allWorkers;
        } else if (expandedCard === 'present') {
            title = `Present Today (${presentCount})`;
            items = presentAttendances.map(a => ({ ...a.worker, timestamp: a.timestamp }));
        } else if (expandedCard === 'absent') {
            title = `Absent Today (${absentCount})`;
            items = absentAttendances.map(a => ({ ...a.worker, timestamp: a.timestamp }));
        } else if (expandedCard === 'notMarked') {
            title = `Not Marked (${notMarkedCount})`;
            items = notMarkedWorkers;
        } else if (expandedCard?.startsWith('cat_')) {
            const catName = expandedCard.replace('cat_', '');
            const catWorkers = allWorkers.filter(w => w.category === catName);
            title = `Category: ${catName} (${catWorkers.length})`;
            items = catWorkers;
        }

        return (
            <div className="detail-panel">
                <div className="detail-panel-header">
                    <h3>{title}</h3>
                    <button className="detail-panel-close" onClick={() => setExpandedCard(null)}>✕</button>
                </div>
                {items.length > 0 ? (
                    <div className="worker-detail-grid">
                        {items.map((w, i) => (
                            <div key={i} className="worker-detail-item">
                                <span className="wd-name">{w.name}</span>
                                <span className="wd-id">{w.workerId}</span>
                                <div className="wd-badges">
                                    {w.lineData && <span className="badge badge-line">{w.lineData}</span>}
                                    {w.category && <span className="badge badge-category">{w.category}</span>}
                                    {w.experience && <span className="badge badge-experience">{w.experience}</span>}
                                </div>
                                {w.timestamp && <span className="wd-time">⏰ {new Date(w.timestamp).toLocaleTimeString('en-IN', { hour12: true })}</span>}
                            </div>
                        ))}
                    </div>
                ) : <p className="empty-text">No workers in this category.</p>}
            </div>
        );
    }

    return (
        <div className="mobile-scroll-wrapper">
            <ToastContainer />

            {/* Mobile Top Bar */}
            <div className="mobile-topbar">
                <div className="mobile-topbar-left">
                    <h2>KH Attendance</h2>
                    <span className="badge badge-manager">Admin</span>
                </div>
                <div className="mobile-topbar-right">
                    <ThemeToggle />
                    <button className="mobile-menu-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                        {isMobileMenuOpen ? '✕' : '☰'}
                    </button>
                </div>
            </div>
            {isMobileMenuOpen && (
                <div className="mobile-nav-dropdown">
                    {tabItems.map(t => (
                        <button key={t.id} className={`mobile-nav-item ${activeTab === t.id ? 'active' : ''}`}
                            onClick={() => { setActiveTab(t.id); setIsMobileMenuOpen(false); }}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                    <button className="mobile-nav-item logout-item" onClick={logout}>Logout</button>
                </div>
            )}

            <div className="layout-enterprise">
                {/* Desktop Sidebar */}
                <aside className="sidebar desktop-only">
                    <div className="sidebar-header">
                        <h2>KH Attendance</h2>
                        <span className="badge badge-manager">Admin</span>
                    </div>
                    <nav className="sidebar-nav">
                        {tabItems.map(t => (
                            <button key={t.id} className={`nav-btn ${activeTab === t.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(t.id)}>
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </nav>
                    <div className="sidebar-footer">
                        <div className="user-info">
                            <div className="avatar">{(user?.username || 'M')[0].toUpperCase()}</div>
                            <div>
                                <p className="name">{user?.username || 'Manager'}</p>
                                <p className="role">System Admin</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <ThemeToggle />
                            <button className="btn btn-outline" style={{ flex: 1 }} onClick={logout}>Logout</button>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="main-content">
                    <header className="topbar">
                        <div>
                            <h1>{tabItems.find(t => t.id === activeTab)?.label === 'Overview' ? 'Dashboard Overview' : tabItems.find(t => t.id === activeTab)?.label}</h1>
                            <p className="subtitle">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                        {activeTab === 'attendance' && (
                            <div className="topbar-controls">
                                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="date-input" />
                                <button className="btn btn-sm btn-primary" onClick={exportCSV}>📥 Export</button>
                            </div>
                        )}
                    </header>

                    <div className="content-scroll">

                        {/* ── OVERVIEW ── */}
                        {activeTab === 'overview' && (
                            <>
                                <div className="stats-row">
                                    <div className={`stat-card total ${expandedCard === 'total' ? 'active' : ''}`} onClick={() => setExpandedCard(expandedCard === 'total' ? null : 'total')}>
                                        <span className="stat-label">Worker Strength</span>
                                        <span className="stat-number">{workerStrength}</span>
                                    </div>
                                    <div className={`stat-card present ${expandedCard === 'present' ? 'active' : ''}`} onClick={() => setExpandedCard(expandedCard === 'present' ? null : 'present')}>
                                        <span className="stat-label">Present Today</span>
                                        <span className="stat-number">{presentCount}</span>
                                    </div>
                                    <div className={`stat-card absent ${expandedCard === 'absent' ? 'active' : ''}`} onClick={() => setExpandedCard(expandedCard === 'absent' ? null : 'absent')}>
                                        <span className="stat-label">Absent Today</span>
                                        <span className="stat-number">{absentCount}</span>
                                    </div>
                                    <div className={`stat-card not-marked ${expandedCard === 'notMarked' ? 'active' : ''}`} onClick={() => setExpandedCard(expandedCard === 'notMarked' ? null : 'notMarked')}>
                                        <span className="stat-label">Not Marked</span>
                                        <span className="stat-number">{notMarkedCount}</span>
                                    </div>
                                </div>

                                {renderDetailPanel()}

                                {/* Line Data Breakdown */}
                                {lineDataStats.length > 0 && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Line Data Breakdown</h3>
                                        <div className="stats-row">
                                            {lineDataStats.map(ld => (
                                                <div key={ld.name} className="stat-card line-card">
                                                    <span className="stat-label">{ld.name}</span>
                                                    <span className="stat-number">{ld.total}</span>
                                                    <div style={{ display: 'flex', gap: '10px', marginTop: '6px', fontSize: '12px' }}>
                                                        <span style={{ color: 'var(--accent-green)' }}>✓ {ld.present}</span>
                                                        <span style={{ color: 'var(--accent-red)' }}>✗ {ld.absent}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Category Breakdown */}
                                {categoryStats.length > 0 && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Category Breakdown</h3>
                                        <div className="stats-row">
                                            {categoryStats.map(cat => (
                                                <div key={cat.name} className={`stat-card category-card ${expandedCard === `cat_${cat.name}` ? 'active' : ''}`} onClick={() => setExpandedCard(expandedCard === `cat_${cat.name}` ? null : `cat_${cat.name}`)} style={{ borderLeft: '3px solid #8E8E93' }}>
                                                    <span className="stat-label">{cat.name}</span>
                                                    <span className="stat-number">{cat.total}</span>
                                                    <div style={{ display: 'flex', gap: '10px', marginTop: '6px', fontSize: '12px' }}>
                                                        <span style={{ color: 'var(--accent-green)' }}>✓ {cat.present}</span>
                                                        <span style={{ color: 'var(--accent-red)' }}>✗ {cat.absent}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Recent Punches */}
                                <div className="card">
                                    <h3>Recent Punches</h3>
                                    <div className="table-wrapper">
                                        <table>
                                            <thead><tr><th>Worker</th><th>Line</th><th>Category</th><th>Experience</th><th>Status</th><th>Time</th></tr></thead>
                                            <tbody>
                                                {attendances.slice(0, 10).map(a => (
                                                    <tr key={a.id}>
                                                        <td><strong>{a.worker?.name}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({a.worker?.workerId})</span></td>
                                                        <td><span className="badge badge-line">{a.lineData || '—'}</span></td>
                                                        <td><span className="badge badge-category">{a.category || '—'}</span></td>
                                                        <td><span className="badge badge-experience">{a.experience || '—'}</span></td>
                                                        <td><span className={`badge ${a.isPresent ? 'badge-green' : 'badge-red'}`}>{a.isPresent ? 'Present' : 'Absent'}</span></td>
                                                        <td>{new Date(a.timestamp).toLocaleTimeString('en-IN', { hour12: true })}</td>
                                                    </tr>
                                                ))}
                                                {attendances.length === 0 && <tr><td colSpan="6" align="center" style={{ color: 'var(--text-muted)' }}>No punches yet</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── ATTENDANCE LOGS ── */}
                        {activeTab === 'attendance' && (
                            <div className="card">
                                <h3 style={{ color: 'var(--accent-green)' }}>✓ Present ({presentAttendances.length})</h3>
                                {presentAttendances.length > 0 ? (
                                    <div className="table-wrapper">
                                        <table>
                                            <thead><tr><th>Worker ID</th><th>Name</th><th>Line</th><th>Category</th><th>Experience</th><th>Time</th></tr></thead>
                                            <tbody>
                                                {presentAttendances.map(a => (
                                                    <tr key={a.id}>
                                                        <td style={{ fontFamily: 'monospace' }}>{a.worker?.workerId}</td>
                                                        <td>{a.worker?.name}</td>
                                                        <td><span className="badge badge-line">{a.lineData || '—'}</span></td>
                                                        <td><span className="badge badge-category">{a.category || '—'}</span></td>
                                                        <td><span className="badge badge-experience">{a.experience || '—'}</span></td>
                                                        <td>{new Date(a.timestamp).toLocaleTimeString('en-IN', { hour12: true })}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : <p className="empty-text">No present records.</p>}

                                <h3 style={{ color: 'var(--accent-red)', margin: '24px 0 14px' }}>✗ Absent ({absentAttendances.length})</h3>
                                {absentAttendances.length > 0 ? (
                                    <div className="absent-grid">
                                        {absentAttendances.map(a => (
                                            <div key={a.id} className="absent-card">
                                                <span className="w-id">{a.worker?.workerId}</span>
                                                <span className="w-name">{a.worker?.name}</span>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.lineData || ''} · {a.category || ''}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="empty-text">No absent records.</p>}

                                <h3 style={{ color: 'var(--accent-orange)', margin: '24px 0 14px' }}>⏳ Not Marked ({notMarkedWorkers.length})</h3>
                                {notMarkedWorkers.length > 0 ? (
                                    <div className="worker-detail-grid">
                                        {notMarkedWorkers.map(w => (
                                            <div key={w.id} className="worker-detail-item">
                                                <span className="wd-name">{w.name}</span>
                                                <span className="wd-id">{w.workerId}</span>
                                                <div className="wd-badges">
                                                    {w.lineData && <span className="badge badge-line">{w.lineData}</span>}
                                                    {w.category && <span className="badge badge-category">{w.category}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="empty-text">All workers have marked attendance.</p>}
                            </div>
                        )}

                        {/* ── WORKERS ── */}
                        {activeTab === 'workers' && (
                            <div className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                                    <h3 style={{ margin: 0 }}>Total: {workers.length} Workers</h3>
                                </div>

                                {/* Add Worker Form */}
                                <form onSubmit={handleAddWorker} className="add-worker-form">
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Worker ID</label>
                                        <input placeholder="WRK-001" value={newWorker.workerId}
                                            onChange={(e) => setNewWorker({ ...newWorker, workerId: e.target.value.toUpperCase() })} required />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Full Name</label>
                                        <input placeholder="Worker Name" value={newWorker.name}
                                            onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })} required />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Line Data</label>
                                        <select value={newWorker.lineData} onChange={(e) => setNewWorker({ ...newWorker, lineData: e.target.value })} required>
                                            <option value="">Select...</option>
                                            {masterData.lineData.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Category</label>
                                        <select value={newWorker.category} onChange={(e) => setNewWorker({ ...newWorker, category: e.target.value, experience: '' })} required>
                                            <option value="">Select...</option>
                                            {masterData.categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Experience</label>
                                        <select value={newWorker.experience} onChange={(e) => setNewWorker({ ...newWorker, experience: e.target.value })} required disabled={!newWorker.category}>
                                            <option value="">Select...</option>
                                            {newWorker.category && masterData.categories.find(c => c.name === newWorker.category)?.experience.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                                        </select>
                                    </div>
                                    <button type="submit" className="btn btn-primary" style={{ alignSelf: 'end' }}>+ Add</button>
                                </form>

                                {/* Worker Cards */}
                                <div className="worker-cards-grid">
                                    {workers.map(w => (
                                        <div key={w.id} className="worker-card-item">
                                            {editingId === w.id ? (
                                                <div>
                                                    <div style={{ display: 'grid', gap: '8px', marginBottom: '10px' }}>
                                                        <input value={editData.workerId} placeholder="Worker ID"
                                                            onChange={(e) => setEditData({ ...editData, workerId: e.target.value.toUpperCase() })} />
                                                        <input value={editData.name} placeholder="Name"
                                                            onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                                                        <select value={editData.lineData} onChange={(e) => setEditData({ ...editData, lineData: e.target.value })}>
                                                            <option value="">No Line Data</option>
                                                            {masterData.lineData.map(l => <option key={l} value={l}>{l}</option>)}
                                                        </select>
                                                        <select value={editData.category} onChange={(e) => setEditData({ ...editData, category: e.target.value, experience: '' })} required>
                                                            <option value="">Select Category</option>
                                                            {masterData.categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                                        </select>
                                                        <select value={editData.experience} onChange={(e) => setEditData({ ...editData, experience: e.target.value })} required disabled={!editData.category}>
                                                            <option value="">Select Experience</option>
                                                            {editData.category && masterData.categories.find(c => c.name === editData.category)?.experience.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                                                        </select>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        <button className="btn btn-sm btn-primary" onClick={() => saveEdit(w.id)}>Save</button>
                                                        <button className="btn btn-sm btn-outline" onClick={() => setEditingId(null)}>Cancel</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="worker-card-header">
                                                        <div className="worker-card-info">
                                                            <h4>{w.name}</h4>
                                                            <span className="worker-id-text">{w.workerId}</span>
                                                        </div>
                                                    </div>
                                                    <div className="worker-card-meta">
                                                        {w.lineData && <span className="badge badge-line">{w.lineData}</span>}
                                                        {w.category && <span className="badge badge-category">{w.category}</span>}
                                                        {w.experience && <span className="badge badge-experience">{w.experience}</span>}
                                                        <span className={`badge ${w.isActive ? 'badge-green' : 'badge-red'}`}>{w.isActive ? 'Active' : 'Inactive'}</span>
                                                    </div>
                                                    <div className="worker-card-actions">
                                                        <button className="btn btn-tiny btn-outline" onClick={() => startEdit(w)}>✏️ Edit</button>
                                                        <button className="btn btn-tiny btn-outline" onClick={() => handleToggleWorker(w.id)}>{w.isActive ? 'Deactivate' : 'Activate'}</button>
                                                        <button className="btn btn-tiny btn-outline" onClick={() => handleResetPin(w.id)}>🔑 Reset</button>
                                                        <button className="btn btn-tiny btn-danger" onClick={() => handleDeleteWorker(w.id)}>🗑️</button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── SETTINGS ── */}
                        {activeTab === 'settings' && (
                            <div className="settings-stack">

                                {/* Master Data */}
                                <div className="settings-card">
                                    <div className="settings-card-header">
                                        <h3>📋 Master Data</h3>
                                    </div>
                                    <p className="settings-card-desc">Manage line data (blocks), categories (worker types), and experience levels. These options appear when assigning workers.</p>

                                    <div className="settings-card-body">
                                        {/* Line Data */}
                                        <div className="master-data-section">
                                            <h4>Line Data (Blocks)</h4>
                                            <div className="category-tags">
                                                {masterData.lineData.map(item => (
                                                    <span key={item} className="tag">{item} <button type="button" onClick={() => removeLineData(item)}>×</button></span>
                                                ))}
                                                {masterData.lineData.length === 0 && <p className="empty-text">No line data yet</p>}
                                            </div>
                                            <div className="tag-add-row">
                                                <input placeholder="e.g. ABC" value={newLineData} onChange={(e) => setNewLineData(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLineData(); } }} />
                                                <button type="button" className="btn btn-sm btn-outline" onClick={addLineData}>Add</button>
                                            </div>
                                        </div>

                                        {/* Categories */}
                                        <div className="master-data-section">
                                            <h4>Categories (Worker Types)</h4>
                                            <div className="category-tags">
                                                {masterData.categories.map(cat => (
                                                    <span key={cat.name} className={`tag ${selectedSettingCategory === cat.name ? 'active' : ''}`} 
                                                          onClick={() => setSelectedSettingCategory(cat.name)}
                                                          style={{ cursor: 'pointer', border: selectedSettingCategory === cat.name ? '1px solid var(--accent-blue)' : '' }}>
                                                        {cat.name} <button type="button" onClick={(e) => { e.stopPropagation(); removeCategory(cat.name); }}>×</button>
                                                    </span>
                                                ))}
                                                {masterData.categories.length === 0 && <p className="empty-text">No categories yet</p>}
                                            </div>
                                            <div className="tag-add-row">
                                                <input placeholder="e.g. Table Worker" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }} />
                                                <button type="button" className="btn btn-sm btn-outline" onClick={addCategory}>Add</button>
                                            </div>
                                        </div>

                                        {/* Experience */}
                                        <div className="master-data-section">
                                            <h4>Experience (Skill Levels) {selectedSettingCategory ? `for ${selectedSettingCategory}` : '- Select a category first'}</h4>
                                            {selectedSettingCategory ? (
                                                <>
                                                    <div className="category-tags">
                                                        {masterData.categories.find(c => c.name === selectedSettingCategory)?.experience.map(exp => (
                                                            <span key={exp} className="tag">{exp} <button type="button" onClick={() => removeExperience(selectedSettingCategory, exp)}>×</button></span>
                                                        ))}
                                                        {(!masterData.categories.find(c => c.name === selectedSettingCategory)?.experience.length) && <p className="empty-text">No experience levels for {selectedSettingCategory}</p>}
                                                    </div>
                                                    <div className="tag-add-row">
                                                        <input placeholder="e.g. Skilled" value={newExperience} onChange={(e) => setNewExperience(e.target.value)}
                                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExperience(); } }} />
                                                        <button type="button" className="btn btn-sm btn-outline" onClick={addExperience}>Add</button>
                                                    </div>
                                                </>
                                            ) : (
                                                <p className="empty-text">Please select a category above to manage its experience levels.</p>
                                            )}
                                        </div>
                                    </div>
                                    <button className="settings-save-btn" onClick={saveMasterData}>Save Master Data</button>
                                </div>

                                {/* Notification Alert */}
                                <div className="settings-card">
                                    <div className="settings-card-header">
                                        <h3>🔔 Notification Alert</h3>
                                    </div>
                                    <p className="settings-card-desc">Send push notification to absent workers at scheduled time.</p>
                                    <div className="settings-card-body">
                                        <div className="settings-row">
                                            <div className="settings-row-label">
                                                <h4>Push Notifications</h4>
                                                <p>Send reminders to workers who haven't marked attendance</p>
                                            </div>
                                            <label className="toggle-switch">
                                                <input type="checkbox" checked={notificationEnabled} onChange={(e) => setNotificationEnabled(e.target.checked)} />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>
                                        {notificationEnabled && (
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'end', flexWrap: 'wrap' }}>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label>Notification Time</label>
                                                    <input type="time" value={notificationTime} onChange={(e) => setNotificationTime(e.target.value)} style={{ width: '160px' }} />
                                                </div>
                                                <button className="btn btn-sm btn-outline" type="button" onClick={handleTestNotification}>🧪 Test</button>
                                            </div>
                                        )}
                                    </div>
                                    <button className="settings-save-btn" onClick={saveNotifications}>Save Notification Settings</button>
                                </div>

                                {/* Call Alert */}
                                <div className="settings-card">
                                    <div className="settings-card-header">
                                        <h3>📞 Call Alert</h3>
                                    </div>
                                    <p className="settings-card-desc">Play a ringtone sound on absent workers' devices at scheduled time.</p>
                                    <div className="settings-card-body">
                                        <div className="settings-row">
                                            <div className="settings-row-label">
                                                <h4>Ringtone Alert</h4>
                                                <p>Alert absent workers with a ringtone</p>
                                            </div>
                                            <label className="toggle-switch">
                                                <input type="checkbox" checked={callAlertEnabled} onChange={(e) => setCallAlertEnabled(e.target.checked)} />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>
                                        {callAlertEnabled && (
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label>Call Alert Time</label>
                                                <input type="time" value={callAlertTime} onChange={(e) => setCallAlertTime(e.target.value)} style={{ width: '160px' }} />
                                            </div>
                                        )}
                                    </div>
                                    <button className="settings-save-btn" onClick={saveCallAlert}>Save Call Alert</button>
                                </div>

                                {/* Edit Deadline */}
                                <div className="settings-card">
                                    <div className="settings-card-header">
                                        <h3>🔒 Edit Deadline</h3>
                                    </div>
                                    <p className="settings-card-desc">
                                        {editDeadlineEnabled
                                            ? `Workers can edit until ${editDeadlineTime}. After that, their response is locked.`
                                            : 'Workers can edit their attendance at any time throughout the day.'}
                                    </p>
                                    <div className="settings-card-body">
                                        <div className="settings-row">
                                            <div className="settings-row-label">
                                                <h4>Lock Attendance Edits</h4>
                                                <p>Prevent workers from changing attendance after a set time</p>
                                            </div>
                                            <label className="toggle-switch">
                                                <input type="checkbox" checked={editDeadlineEnabled} onChange={(e) => setEditDeadlineEnabled(e.target.checked)} />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>
                                        {editDeadlineEnabled && (
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label>Cutoff Time</label>
                                                <input type="time" value={editDeadlineTime} onChange={(e) => setEditDeadlineTime(e.target.value)} style={{ width: '160px' }} />
                                            </div>
                                        )}
                                    </div>
                                    <button className="settings-save-btn" onClick={saveEditDeadline}>Save Edit Deadline</button>
                                </div>

                                {/* Profile */}
                                <div className="settings-card">
                                    <div className="settings-card-header">
                                        <h3>🛡️ Manager Profile</h3>
                                    </div>
                                    <p className="settings-card-desc">Update your username and PIN.</p>
                                    <form onSubmit={handleSaveProfile}>
                                        <div className="form-group">
                                            <label>Username</label>
                                            <input value={profileData.username} onChange={(e) => setProfileData({ ...profileData, username: e.target.value })} />
                                        </div>
                                        <div className="form-group">
                                            <label>New PIN (leave blank to keep current)</label>
                                            <input type="password" value={profileData.rawPin}
                                                onChange={(e) => setProfileData({ ...profileData, rawPin: e.target.value.replace(/\D/g, '') })}
                                                placeholder="••••••" maxLength={6} inputMode="numeric" />
                                        </div>
                                        <button type="submit" className="settings-save-btn">Update Profile</button>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
