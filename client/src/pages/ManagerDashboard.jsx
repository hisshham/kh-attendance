import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { getSocket } from '../services/socket';

function getISTDate() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export default function ManagerDashboard() {
    const { user, logout, token } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Data
    const [selectedDate, setSelectedDate] = useState(getISTDate());
    const [attendances, setAttendances] = useState([]);
    const [allWorkers, setAllWorkers] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [notificationTime, setNotificationTime] = useState('08:30');
    const [notificationEnabled, setNotificationEnabled] = useState(true);
    const [callAlertEnabled, setCallAlertEnabled] = useState(false);
    const [callAlertTime, setCallAlertTime] = useState('09:00');
    const [editDeadlineEnabled, setEditDeadlineEnabled] = useState(false);
    const [editDeadlineTime, setEditDeadlineTime] = useState('10:00');

    // UI
    const [newWorker, setNewWorker] = useState({ workerId: '', name: '', pin: '123456', category: '' });
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({ workerId: '', name: '', category: '' });
    const [newCategory, setNewCategory] = useState('');
    const [message, setMessage] = useState('');
    const [profileData, setProfileData] = useState({ username: user?.username || '', rawPin: '' });

    useEffect(() => {
        if (token) {
            loadAttendance();
            loadWorkers();
            loadSettings();

            const socket = getSocket();
            socket.emit('join_manager');
            socket.on('attendance_update', () => loadAttendance());

            return () => {
                socket.off('attendance_update');
            };
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
            setCategories(res.data.categories || []);
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
        setMessage('');
        try {
            await api.post('/api/manager/workers', newWorker);
            setNewWorker({ workerId: '', name: '', pin: '123456', category: '' });
            setMessage('✅ Worker added');
            loadWorkers();
        } catch (err) { setMessage('❌ ' + (err.response?.data?.error || 'Failed')); }
    }
    async function handleToggleWorker(id) {
        try { await api.patch(`/api/manager/workers/${id}/toggle`); loadWorkers(); } catch (err) { }
    }
    async function handleDeleteWorker(id) {
        if (!confirm('Permanently remove this worker and all their attendance history?')) return;
        try {
            await api.delete(`/api/manager/workers/${id}`);
            setMessage('✅ Worker deleted');
            loadWorkers();
        } catch (err) { alert('Failed to delete worker'); }
    }
    function startEdit(w) {
        setEditingId(w.id);
        setEditData({ workerId: w.workerId, name: w.name, category: w.category || '' });
    }
    async function saveEdit(id) {
        try {
            await api.put(`/api/manager/workers/${id}`, editData);
            setEditingId(null); setMessage('✅ Worker updated'); loadWorkers();
        } catch (err) { alert('Failed to update worker'); }
    }
    async function handleResetPin(id) {
        if (!confirm('Reset PIN to 123456?')) return;
        try { await api.patch(`/api/manager/workers/${id}/reset-pin`); setMessage('✅ PIN reset to 123456'); } catch (err) { }
    }

    // Settings
    async function handleSaveSettings(e) {
        if (e?.preventDefault) e.preventDefault();
        try {
            await api.put('/api/manager/settings', {
                categories, notificationTime, notificationEnabled,
                callAlertEnabled, callAlertTime,
                editDeadlineEnabled, editDeadlineTime,
            });
            setMessage('✅ Settings saved');
        } catch (err) { setMessage('❌ Failed to save settings'); }
    }
    async function handleTestNotification() {
        try {
            const res = await api.post('/api/manager/send-test-notification');
            setMessage(`✅ ${res.data.message}`);
        } catch (err) { setMessage('❌ ' + (err.response?.data?.error || 'Failed to send')); }
    }
    async function handleSaveProfile(e) {
        e.preventDefault();
        try {
            await api.put('/api/manager/profile', profileData);
            setMessage('✅ Profile updated');
            setProfileData({ ...profileData, rawPin: '' });
        } catch (err) { setMessage('❌ ' + (err.response?.data?.error || 'Failed')); }
    }
    function addCategory() {
        if (newCategory.trim() && !categories.includes(newCategory.trim())) {
            setCategories([...categories, newCategory.trim()]);
            setNewCategory('');
        }
    }
    function removeCategory(cat) { setCategories(categories.filter(c => c !== cat)); }
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
        } catch (err) { alert('Failed to export CSV'); }
    }

    // Calculations
    const presentAttendances = attendances.filter(a => a.isPresent);
    const absentAttendances = attendances.filter(a => !a.isPresent);
    const presentIds = new Set(presentAttendances.map(a => a.worker?.workerId));
    const absentIds = new Set(absentAttendances.map(a => a.worker?.workerId));
    const workerStrength = allWorkers.length;
    const presentCount = presentAttendances.length;
    const absentCount = absentAttendances.length;

    // Category-wise breakdown
    const categoryStats = categories.map(cat => {
        const total = allWorkers.filter(w => w.category === cat).length;
        const present = presentAttendances.filter(a => a.worker?.category === cat).length;
        const absent = absentAttendances.filter(a => a.worker?.category === cat).length;
        return { name: cat, total, present, absent };
    });

    const tabItems = [
        { id: 'overview', icon: '📊', label: 'Overview' },
        { id: 'attendance', icon: '📋', label: 'Daily Logs' },
        { id: 'workers', icon: '👥', label: 'Workers' },
        { id: 'settings', icon: '⚙️', label: 'Settings' },
    ];

    return (
        <div className="mobile-scroll-wrapper">
            {/* Mobile Top Bar */}
            <div className="mobile-topbar">
                <div className="mobile-topbar-left">
                    <h2>KH Attendance</h2>
                    <span className="badge badge-manager">Admin</span>
                </div>
                <button className="mobile-menu-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                    {isMobileMenuOpen ? '✕' : '☰'}
                </button>
            </div>
            {isMobileMenuOpen && (
                <div className="mobile-nav-dropdown">
                    {tabItems.map(t => (
                        <button key={t.id} className={`mobile-nav-item ${activeTab === t.id ? 'active' : ''}`}
                            onClick={() => { setActiveTab(t.id); setIsMobileMenuOpen(false); }}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                    <button className="mobile-nav-item logout-item" onClick={logout}>⏏ Logout</button>
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
                        <button className="btn btn-outline btn-full" onClick={logout}>Logout</button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="main-content">
                    <header className="topbar">
                        <div>
                            <h1>{tabItems.find(t => t.id === activeTab)?.icon} {tabItems.find(t => t.id === activeTab)?.label === 'Overview' ? 'Dashboard Overview' : tabItems.find(t => t.id === activeTab)?.label}</h1>
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
                        {message && <div className="success-msg" style={{ marginBottom: '20px' }}>{message}</div>}

                        {/* ── OVERVIEW ── */}
                        {activeTab === 'overview' && (
                            <>
                                <div className="stats-row">
                                    <div className="stat-card total">
                                        <span className="stat-label">Worker Strength</span>
                                        <span className="stat-number">{workerStrength}</span>
                                    </div>
                                    <div className="stat-card present">
                                        <span className="stat-label">Present Today</span>
                                        <span className="stat-number">{presentCount}</span>
                                    </div>
                                    <div className="stat-card absent">
                                        <span className="stat-label">Absent Today</span>
                                        <span className="stat-number">{absentCount}</span>
                                    </div>
                                </div>

                                {/* Category-wise breakdown */}
                                {categoryStats.length > 0 && (
                                    <div style={{ marginBottom: '24px' }}>
                                        <h3 style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Category Breakdown</h3>
                                        <div className="stats-row">
                                            {categoryStats.map(cat => (
                                                <div key={cat.name} className="stat-card category-card">
                                                    <span className="stat-label">{cat.name}</span>
                                                    <span className="stat-number">{cat.total}</span>
                                                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '12px' }}>
                                                        <span style={{ color: 'var(--accent-green)' }}>✓ {cat.present} present</span>
                                                        <span style={{ color: 'var(--accent-red)' }}>✗ {cat.absent} absent</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Absent Today — only workers who pressed NO */}
                                {absentAttendances.length > 0 && (
                                    <div className="card">
                                        <h3>❌ Absent Today ({absentAttendances.length})</h3>
                                        <div className="absent-grid">
                                            {absentAttendances.map(a => (
                                                <div key={a.id} className="absent-card">
                                                    <span className="w-id">{a.worker?.workerId}</span>
                                                    <span className="w-name">{a.worker?.name}</span>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.worker?.category || 'Unassigned'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Recent Punches */}
                                <div className="card">
                                    <h3>⏱️ Recent Punches (Today)</h3>
                                    <div className="table-wrapper">
                                        <table>
                                            <thead><tr><th>Worker</th><th>Category</th><th>Status</th><th>Time</th></tr></thead>
                                            <tbody>
                                                {attendances.slice(0, 10).map(a => (
                                                    <tr key={a.id}>
                                                        <td><strong>{a.worker?.name}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>({a.worker?.workerId})</span></td>
                                                        <td><span className="badge">{a.category}</span></td>
                                                        <td>
                                                            <span className={`badge ${a.isPresent ? 'badge-green' : 'badge-red'}`}>
                                                                {a.isPresent ? 'Present' : 'Absent'}
                                                            </span>
                                                        </td>
                                                        <td>{new Date(a.timestamp).toLocaleTimeString('en-IN', { hour12: true })}</td>
                                                    </tr>
                                                ))}
                                                {attendances.length === 0 && <tr><td colSpan="4" align="center" style={{ color: 'var(--text-muted)' }}>No punches yet</td></tr>}
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
                                            <thead><tr><th>Worker ID</th><th>Name</th><th>Category</th><th>Time</th></tr></thead>
                                            <tbody>
                                                {presentAttendances.map(a => (
                                                    <tr key={a.id}>
                                                        <td style={{ fontFamily: 'monospace' }}>{a.worker?.workerId}</td>
                                                        <td>{a.worker?.name}</td>
                                                        <td><span className="badge badge-teal">{a.category}</span></td>
                                                        <td>{new Date(a.timestamp).toLocaleTimeString('en-IN', { hour12: true })}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : <p className="empty-text">No present records.</p>}

                                <h3 style={{ color: 'var(--accent-red)', margin: '28px 0 16px' }}>✗ Absent ({absentAttendances.length})</h3>
                                {absentAttendances.length > 0 ? (
                                    <div className="absent-grid">
                                        {absentAttendances.map(a => (
                                            <div key={a.id} className="absent-card">
                                                <span className="w-id">{a.worker?.workerId}</span>
                                                <span className="w-name">{a.worker?.name}</span>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.category}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="empty-text">No absent records — only workers who marked "No" appear here.</p>}
                            </div>
                        )}

                        {/* ── WORKERS ── */}
                        {activeTab === 'workers' && (
                            <div className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                                    <h3 style={{ margin: 0 }}>Total: {workers.length} Workers</h3>
                                </div>

                                {/* Add Worker Form */}
                                <form onSubmit={handleAddWorker} className="add-worker-form">
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Worker ID</label>
                                        <input placeholder="WRK-001" value={newWorker.workerId}
                                            onChange={(e) => setNewWorker({ ...newWorker, workerId: e.target.value.toUpperCase() })} required />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Full Name</label>
                                        <input placeholder="Worker Name" value={newWorker.name}
                                            onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })} required />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Category</label>
                                        <select value={newWorker.category} onChange={(e) => setNewWorker({ ...newWorker, category: e.target.value })}>
                                            <option value="">Select...</option>
                                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '4px', display: 'block' }}>PIN</label>
                                        <input placeholder="123456" value={newWorker.pin}
                                            onChange={(e) => setNewWorker({ ...newWorker, pin: e.target.value })} required />
                                    </div>
                                    <button type="submit" className="btn btn-primary" style={{ alignSelf: 'end' }}>+ Add</button>
                                </form>

                                {/* Worker Cards */}
                                <div className="worker-cards-grid">
                                    {workers.map(w => (
                                        <div key={w.id} className="worker-card-item">
                                            {editingId === w.id ? (
                                                <div>
                                                    <div style={{ display: 'grid', gap: '10px', marginBottom: '12px' }}>
                                                        <input value={editData.workerId} placeholder="Worker ID"
                                                            onChange={(e) => setEditData({ ...editData, workerId: e.target.value.toUpperCase() })} />
                                                        <input value={editData.name} placeholder="Name"
                                                            onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                                                        <select value={editData.category} onChange={(e) => setEditData({ ...editData, category: e.target.value })}>
                                                            <option value="">No Category</option>
                                                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
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
                                                        {w.category && <span className="badge badge-teal">{w.category}</span>}
                                                        <span className={`badge ${w.isActive ? 'badge-green' : 'badge-red'}`}>{w.isActive ? 'Active' : 'Inactive'}</span>
                                                    </div>
                                                    <div className="worker-card-actions">
                                                        <button className="btn btn-tiny btn-outline" onClick={() => startEdit(w)}>✏️ Edit</button>
                                                        <button className="btn btn-tiny" onClick={() => handleToggleWorker(w.id)}>{w.isActive ? 'Deactivate' : 'Activate'}</button>
                                                        <button className="btn btn-tiny btn-outline" onClick={() => handleResetPin(w.id)}>🔑 Reset PIN</button>
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
                            <div className="settings-grid">
                                {/* Notification Alert */}
                                <div className="card" style={{ gridColumn: '1 / -1' }}>
                                    <h3>🔔 Notification Alert</h3>
                                    <div className="settings-section">
                                        <div className="settings-section-info">
                                            <h4>Push Notifications</h4>
                                            <p>Send push notification to absent workers at scheduled time</p>
                                        </div>
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={notificationEnabled} onChange={(e) => setNotificationEnabled(e.target.checked)} />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                    {notificationEnabled && (
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'end', flexWrap: 'wrap', marginBottom: '12px' }}>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label>Notification Time</label>
                                                <input type="time" value={notificationTime} onChange={(e) => setNotificationTime(e.target.value)}
                                                    style={{ width: '160px', fontSize: '16px' }} />
                                            </div>
                                            <button className="btn btn-sm btn-outline" type="button" onClick={handleTestNotification}>🧪 Test</button>
                                        </div>
                                    )}
                                </div>

                                {/* Call Alert */}
                                <div className="card" style={{ gridColumn: '1 / -1' }}>
                                    <h3>📞 Call Alert</h3>
                                    <div className="settings-section">
                                        <div className="settings-section-info">
                                            <h4>Ringtone Alert</h4>
                                            <p>Play a ringtone sound on absent workers' devices at scheduled time</p>
                                        </div>
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={callAlertEnabled} onChange={(e) => setCallAlertEnabled(e.target.checked)} />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                    {callAlertEnabled && (
                                        <div className="form-group" style={{ margin: '0 0 12px' }}>
                                            <label>Call Alert Time</label>
                                            <input type="time" value={callAlertTime} onChange={(e) => setCallAlertTime(e.target.value)}
                                                style={{ width: '160px', fontSize: '16px' }} />
                                        </div>
                                    )}
                                </div>

                                {/* Edit Deadline */}
                                <div className="card" style={{ gridColumn: '1 / -1' }}>
                                    <h3>🔒 Edit Deadline</h3>
                                    <div className="settings-section">
                                        <div className="settings-section-info">
                                            <h4>Lock Attendance Edits</h4>
                                            <p>{editDeadlineEnabled
                                                ? `Workers can edit until ${editDeadlineTime}. After that, their response is locked.`
                                                : 'Workers can edit their attendance at any time throughout the day.'}</p>
                                        </div>
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={editDeadlineEnabled} onChange={(e) => setEditDeadlineEnabled(e.target.checked)} />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                    {editDeadlineEnabled && (
                                        <div className="form-group" style={{ margin: '0 0 12px' }}>
                                            <label>Cutoff Time</label>
                                            <input type="time" value={editDeadlineTime} onChange={(e) => setEditDeadlineTime(e.target.value)}
                                                style={{ width: '160px', fontSize: '16px' }} />
                                        </div>
                                    )}
                                </div>

                                {/* Save All Settings Button */}
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <button className="btn btn-primary btn-full" onClick={handleSaveSettings} style={{ padding: '16px', fontSize: '16px' }}>
                                        💾 Save All Settings
                                    </button>
                                </div>

                                {/* Categories */}
                                <div className="card">
                                    <h3>🏷️ Attendance Categories</h3>
                                    <div className="category-tags" style={{ marginBottom: '12px' }}>
                                        {categories.map(cat => (
                                            <span key={cat} className="tag">{cat} <button type="button" onClick={() => removeCategory(cat)}>×</button></span>
                                        ))}
                                        {categories.length === 0 && <p className="empty-text">No categories yet</p>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input placeholder="New category name" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }} />
                                        <button type="button" className="btn btn-sm btn-outline" onClick={addCategory}>Add</button>
                                    </div>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Remember to click "Save All Settings" after changes.</p>
                                </div>

                                {/* Profile */}
                                <div className="card">
                                    <h3>🛡️ Manager Profile</h3>
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
                                        <button type="submit" className="btn btn-primary">Update Profile</button>
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
