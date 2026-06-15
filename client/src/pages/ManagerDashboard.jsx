import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { getSocket } from '../services/socket';

export default function ManagerDashboard() {
    const { user, logout, token } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');

    // Data State
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendances, setAttendances] = useState([]);
    const [allWorkers, setAllWorkers] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [notificationTime, setNotificationTime] = useState('08:30');

    // UI state
    const [newWorker, setNewWorker] = useState({ workerId: '', name: '', pin: '123456' });
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({ workerId: '', name: '' });
    const [newCategory, setNewCategory] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    // Profile State
    const [profileData, setProfileData] = useState({ username: user?.username || '', rawPin: '' });

    useEffect(() => {
        if (token) {
            loadAttendance();
            loadWorkers();
            loadSettings();

            const socket = getSocket();
            socket.emit('join_manager');
            socket.on('attendance_update', () => {
                loadAttendance();
            });

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
        try {
            const res = await api.get('/api/manager/workers');
            setWorkers(res.data);
        } catch (err) { }
    }

    async function loadSettings() {
        try {
            const res = await api.get('/api/manager/settings');
            setCategories(res.data.categories || []);
            setNotificationTime(res.data.notificationTime || '08:30');
        } catch (err) { }
    }

    // Handlers
    async function handleAddWorker(e) {
        e.preventDefault();
        setMessage('');
        try {
            await api.post('/api/manager/workers', newWorker);
            setNewWorker({ workerId: '', name: '', pin: '123456' });
            setMessage('✅ Worker added');
            loadWorkers();
        } catch (err) { setMessage('❌ ' + (err.response?.data?.error || 'Failed')); }
    }

    async function handleToggleWorker(id) {
        try { await api.patch(`/api/manager/workers/${id}/toggle`); loadWorkers(); } catch (err) { }
    }

    async function handleDeleteWorker(id) {
        if (!confirm('Are you absolutely sure you want to PERMANENTLY remove this worker? This will delete all their historical attendance logs too!')) return;
        try {
            await api.delete(`/api/manager/workers/${id}`);
            setMessage('✅ Worker and their history deleted successfully');
            loadWorkers();
        } catch (err) { alert('Failed to delete worker'); }
    }

    function startEdit(w) { setEditingId(w.id); setEditData({ workerId: w.workerId, name: w.name }); }

    async function saveEdit(id) {
        try {
            await api.put(`/api/manager/workers/${id}`, editData);
            setEditingId(null); setMessage('✅ Worker updated'); loadWorkers();
        } catch (err) { alert('Failed to update worker'); }
    }

    async function handleResetPin(id) {
        if (!confirm('Reset this worker\'s PIN to 123456?')) return;
        try { await api.patch(`/api/manager/workers/${id}/reset-pin`); setMessage('✅ PIN reset to 123456'); loadWorkers(); } catch (err) { }
    }

    async function handleSaveSettings(e) {
        if (e && e.preventDefault) e.preventDefault();
        try { await api.put('/api/manager/settings', { categories, notificationTime }); setMessage('✅ Settings saved'); } catch (err) { setMessage('❌ Failed to save settings'); }
    }

    async function handleTestNotification() {
        try {
            const res = await api.post('/api/manager/send-test-notification');
            setMessage(`✅ ${res.data.message}`);
        } catch (err) {
            setMessage('❌ ' + (err.response?.data?.error || 'Failed to send test notification'));
        }
    }

    async function handleSaveProfile(e) {
        e.preventDefault();
        try {
            await api.put('/api/manager/profile', profileData);
            setMessage('✅ Profile updated (Please remember your new PIN)');
            setProfileData({ ...profileData, rawPin: '' });
        } catch (err) { setMessage('❌ ' + (err.response?.data?.error || 'Failed to update profile')); }
    }

    function addCategory() {
        if (newCategory.trim() && !categories.includes(newCategory.trim())) {
            setCategories([...categories, newCategory.trim()]);
            setNewCategory('');
        }
    }
    function removeCategory(cat) { setCategories(categories.filter((c) => c !== cat)); }
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
        } catch (err) {
            alert('Failed to export CSV');
        }
    }

    // Calc UI
    const presentIds = new Set(attendances.map((a) => a.worker?.workerId));
    const absentWorkers = allWorkers.filter((w) => !presentIds.has(w.workerId));
    const workerStrength = allWorkers.length;
    const presentCount = attendances.length;
    const absentCount = absentWorkers.length;
    const attendancePercentage = workerStrength === 0 ? 0 : Math.round((presentCount / workerStrength) * 100);

    return (
        <div className="layout-enterprise">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h2>Attendance</h2>
                    <span className="badge badge-manager">Admin</span>
                </div>

                <nav className="sidebar-nav">
                    <button className={`nav-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
                        📊 Overview
                    </button>
                    <button className={`nav-btn ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>
                        📋 Daily Logs
                    </button>
                    <button className={`nav-btn ${activeTab === 'workers' ? 'active' : ''}`} onClick={() => setActiveTab('workers')}>
                        👥 Workers
                    </button>
                    <button className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                        ⚙️ Settings
                    </button>
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="avatar">M</div>
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
                        <h1>{activeTab === 'overview' ? 'Dashboard Overview' : activeTab === 'attendance' ? 'Daily Attendance Logs' : activeTab === 'workers' ? 'Worker Management' : 'System Settings'}</h1>
                        <p className="subtitle">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    {activeTab === 'attendance' && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="date-input" />
                            <button className="btn btn-sm btn-primary" onClick={exportCSV}>📥 Export CSV</button>
                        </div>
                    )}
                </header>

                <div className="content-scroll">
                    {message && <div className="success-msg" style={{ marginBottom: '24px' }}>{message}</div>}

                    {/* ── OVERVIEW TAB ── */}
                    {activeTab === 'overview' && (
                        <>
                            <div className="stats-row">
                                <div className="stat-card total">
                                    <span className="stat-label">Worker Strength</span>
                                    <span className="stat-number">{workerStrength}</span>
                                </div>
                                <div className="stat-card present">
                                    <span className="stat-label">Present Today</span>
                                    <span className="stat-number">{presentCount} <span style={{ fontSize: '16px', color: 'var(--text-muted)' }}>({attendancePercentage}%)</span></span>
                                </div>
                                <div className="stat-card absent">
                                    <span className="stat-label">Absent Today</span>
                                    <span className="stat-number">{absentCount}</span>
                                </div>
                                <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
                                    <span className="stat-label">🔔 Notification Timer</span>
                                    <span className="stat-number" style={{ fontSize: '32px' }}>{notificationTime || '08:30'}</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Daily reminder for absent workers</span>
                                </div>
                            </div>

                            <div className="card">
                                <h3>Recent Punches (Today)</h3>
                                <div className="table-wrapper">
                                    <table>
                                        <thead><tr><th>Worker</th><th>Category</th><th>Time</th></tr></thead>
                                        <tbody>
                                            {attendances.slice(0, 8).map(a => (
                                                <tr key={a.id}>
                                                    <td><strong>{a.worker?.name}</strong> <span style={{ color: 'var(--text-muted)' }}>({a.worker?.workerId})</span></td>
                                                    <td><span className="badge">{a.category}</span></td>
                                                    <td>{new Date(a.timestamp).toLocaleTimeString('en-IN', { hour12: true })}</td>
                                                </tr>
                                            ))}
                                            {attendances.length === 0 && <tr><td colSpan="3" align="center">No recent punches</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── ATTENDANCE LOGS TAB ── */}
                    {activeTab === 'attendance' && (
                        <div className="card">
                            <h3 style={{ color: '#10b981', marginBottom: '16px' }}>Present ({attendances.length})</h3>
                            {attendances.length > 0 ? (
                                <div className="table-wrapper">
                                    <table>
                                        <thead><tr><th>Worker ID</th><th>Name</th><th>Category</th><th>Punch Time</th></tr></thead>
                                        <tbody>
                                            {attendances.map((a) => (
                                                <tr key={a.id}>
                                                    <td>{a.worker?.workerId}</td>
                                                    <td>{a.worker?.name}</td>
                                                    <td><span className="badge">{a.category}</span></td>
                                                    <td>{new Date(a.timestamp).toLocaleTimeString('en-IN', { hour12: true })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : <p className="empty-text">No attendance recorded.</p>}

                            <h3 style={{ color: '#f43f5e', margin: '32px 0 16px' }}>Absent ({absentWorkers.length})</h3>
                            <div className="absent-grid">
                                {absentWorkers.map(w => (
                                    <div key={w.id} className="absent-card">
                                        <span className="w-id">{w.workerId}</span>
                                        <span className="w-name">{w.name}</span>
                                    </div>
                                ))}
                                {absentWorkers.length === 0 && <p className="empty-text">Everyone is present!</p>}
                            </div>
                        </div>
                    )}

                    {/* ── WORKERS TAB ── */}
                    {activeTab === 'workers' && (
                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h3>Total Strength: {workers.length} Workers</h3>
                            </div>

                            <form onSubmit={handleAddWorker} className="add-worker-form">
                                <input placeholder="Worker ID (e.g. WRK-001)" value={newWorker.workerId} onChange={(e) => setNewWorker({ ...newWorker, workerId: e.target.value.toUpperCase() })} required />
                                <input placeholder="Full Name" value={newWorker.name} onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })} required />
                                <input placeholder="Initial PIN" value={newWorker.pin} onChange={(e) => setNewWorker({ ...newWorker, pin: e.target.value })} required />
                                <button type="submit" className="btn btn-primary">Add Worker</button>
                            </form>

                            <div className="table-wrapper">
                                <table>
                                    <thead><tr><th>Worker ID</th><th>Name</th><th>Status</th><th>Requires Reset</th><th>Actions</th></tr></thead>
                                    <tbody>
                                        {workers.map((w) => (
                                            <tr key={w.id}>
                                                {editingId === w.id ? (
                                                    <>
                                                        <td><input value={editData.workerId} onChange={(e) => setEditData({ ...editData, workerId: e.target.value.toUpperCase() })} /></td>
                                                        <td><input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} /></td>
                                                        <td>-</td><td>-</td>
                                                        <td className="action-btns">
                                                            <button className="btn btn-tiny btn-primary" onClick={() => saveEdit(w.id)}>Save</button>
                                                            <button className="btn btn-tiny btn-outline" onClick={() => setEditingId(null)}>Cancel</button>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td style={{ fontFamily: 'monospace' }}>{w.workerId}</td>
                                                        <td style={{ fontWeight: 500 }}>{w.name}</td>
                                                        <td><span className={`badge ${w.isActive ? 'badge-green' : 'badge-red'}`}>{w.isActive ? 'Active' : 'Inactive'}</span></td>
                                                        <td>{w.requiresPinReset ? '⚠️ Yes' : '✅ No'}</td>
                                                        <td className="action-btns">
                                                            <button className="btn btn-tiny btn-outline" onClick={() => startEdit(w)}>Edit</button>
                                                            <button className="btn btn-tiny" onClick={() => handleToggleWorker(w.id)}>{w.isActive ? 'Deact.' : 'Act.'}</button>
                                                            <button className="btn btn-tiny btn-outline" onClick={() => handleResetPin(w.id)}>Reset PIN</button>
                                                            <button className="btn btn-tiny btn-danger" onClick={() => handleDeleteWorker(w.id)}>Delete</button>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ── SETTINGS TAB ── */}
                    {activeTab === 'settings' && (
                        <div className="settings-grid">
                            {/* Notification Timer Card */}
                            <div className="card" style={{ gridColumn: '1 / -1' }}>
                                <h3>🔔 Notification Timer</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
                                    Set the time when absent workers will automatically receive a push notification reminder.
                                </p>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                    <div className="form-group" style={{ marginBottom: 0, flex: '0 0 auto' }}>
                                        <label>Daily Reminder Time</label>
                                        <input
                                            type="time"
                                            value={notificationTime}
                                            onChange={(e) => setNotificationTime(e.target.value)}
                                            style={{ width: '180px', fontSize: '18px', padding: '14px 16px' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button className="btn btn-primary" onClick={handleSaveSettings} type="button">
                                            💾 Save Timer
                                        </button>
                                        <button className="btn btn-outline" onClick={handleTestNotification} type="button">
                                            🧪 Send Test Notification
                                        </button>
                                    </div>
                                </div>
                                <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        ⏰ Current schedule: <strong style={{ color: 'var(--accent-blue)' }}>{notificationTime || '08:30'}</strong> daily
                                        — Workers who haven't punched in by this time will receive a push notification.
                                    </p>
                                </div>
                            </div>

                            <div className="card">
                                <h3>⚙️ Attendance Categories</h3>
                                <form onSubmit={handleSaveSettings}>
                                    <div className="form-group">
                                        <label>Worker Roles / Categories</label>
                                        <div className="category-tags">
                                            {categories.map((cat) => (
                                                <span key={cat} className="tag">{cat} <button type="button" onClick={() => removeCategory(cat)}>×</button></span>
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '8px' }}>
                                            <input placeholder="Add new role" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                                            <button type="button" className="btn btn-sm btn-outline" onClick={addCategory}>Add</button>
                                        </div>
                                    </div>
                                    <button type="submit" className="btn btn-primary" style={{ marginTop: '16px' }}>Save Categories</button>
                                </form>
                            </div>

                            <div className="card">
                                <h3>🛡️ Manager Profile</h3>
                                <form onSubmit={handleSaveProfile}>
                                    <div className="form-group">
                                        <label>Username</label>
                                        <input value={profileData.username} onChange={(e) => setProfileData({ ...profileData, username: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>New PIN (Leave blank to keep current)</label>
                                        <input type="password" value={profileData.rawPin} onChange={(e) => setProfileData({ ...profileData, rawPin: e.target.value.replace(/\D/g, '') })} placeholder="••••••" maxLength={6} inputMode="numeric" />
                                    </div>
                                    <button type="submit" className="btn btn-primary">Update Profile</button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
