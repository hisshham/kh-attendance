import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function WorkerDashboard() {
    const { user, logout } = useAuth();
    const [categories, setCategories] = useState([]);
    const [todayAttendance, setTodayAttendance] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [pushEnabled, setPushEnabled] = useState(Notification.permission === 'granted');

    useEffect(() => {
        loadToday();
        if (Notification.permission === 'granted') {
            setupPush();
        }
    }, []);

    async function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    async function setupPush() {
        try {
            if (!('serviceWorker' in navigator)) {
                alert('Service Worker is not supported on this browser.');
                return;
            }
            if (!('PushManager' in window)) {
                alert('PushManager is not supported on this browser/OS.');
                return;
            }
            const reg = await navigator.serviceWorker.ready;
            const res = await api.get('/api/push/vapid-key');
            if (!res.data.publicKey) {
                alert('Server returned empty VAPID key!');
                return;
            }
            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: await urlBase64ToUint8Array(res.data.publicKey)
            });
            await api.post('/api/push/subscribe', sub);
            setPushEnabled(true);
        } catch (err) {
            console.error('Push error:', err);
            alert('Push failed: ' + (err.message || String(err)));
        }
    }

    async function requestPush() {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                await setupPush();
            } else {
                alert('Push notifications denied by phone settings. Permission status: ' + permission);
            }
        } catch (err) {
            alert('Request permission failed: ' + err.message);
        }
    }

    async function loadToday() {
        try {
            const res = await api.get('/api/worker/attendance/today');
            setCategories(res.data.categories || []);
            setTodayAttendance(res.data.attendance);
        } catch (err) {
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!selectedCategory) {
            setError('Please select a category');
            return;
        }
        setSubmitting(true);
        setError('');
        setMessage('');

        try {
            await api.post('/api/worker/attendance', { category: selectedCategory });
            setMessage('✅ Attendance marked successfully!');
            loadToday();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to submit attendance');
        } finally {
            setSubmitting(false);
        }
    }

    // Interactive animated greetings based on time
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><div className="loader"></div></div>;

    return (
        <div className="layout-enterprise" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', height: '100%', padding: '24px 0' }}>
                <header className="dashboard-header" style={{ margin: '0 24px 24px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'relative', zIndex: 2 }}>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>{greeting},</p>
                        <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>{user?.name || user?.workerId}</h1>
                        <span className="badge badge-green" style={{ background: 'var(--bg-primary)' }}>ID: {user?.workerId}</span>
                    </div>
                    <button className="btn btn-outline" style={{ position: 'relative', zIndex: 2, background: 'rgba(0,0,0,0.3)' }} onClick={logout}>⏏ Logout</button>
                    {/* Abstract design elements inside header */}
                    <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: 'var(--accent-blue)', opacity: 0.1, borderRadius: '50%', filter: 'blur(30px)' }}></div>
                    <div style={{ position: 'absolute', bottom: -50, right: 100, width: 150, height: 150, background: 'var(--accent-green)', opacity: 0.1, borderRadius: '50%', filter: 'blur(30px)' }}></div>
                </header>

                {!pushEnabled && typeof Notification !== 'undefined' && (
                    <div style={{ margin: '0 24px 24px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--border-active)', padding: '16px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <strong style={{ color: 'var(--accent-blue)' }}>🔔 Enable Daily Reminders</strong>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Get notified exactly when it's time to log attendance.</p>
                        </div>
                        <button className="btn btn-sm btn-primary" onClick={requestPush}>Enable</button>
                    </div>
                )}

                <main style={{ flex: 1, padding: '0 24px', overflowY: 'auto' }}>
                    <div className="card" style={{ padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                        <h2 style={{ fontSize: '24px' }}>📋 Daily Attendance Entry</h2>
                        <div className="date-display" style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>

                        {todayAttendance ? (
                            <div className="success-box" style={{ width: '100%', maxWidth: '500px', animation: 'fadeInUp 0.5s ease-out' }}>
                                <center>
                                    <div style={{ fontSize: '64px', marginBottom: '16px', lineHeight: 1 }}>✅</div>
                                    <h3 style={{ justifyContent: 'center', color: 'white' }}>Punch successful</h3>
                                </center>
                                <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: 'var(--radius-md)', marginTop: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '12px' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Current Role</span>
                                        <strong>{todayAttendance.category}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Time Logged</span>
                                        <strong>{new Date(todayAttendance.timestamp).toLocaleTimeString('en-IN', { hour12: true })}</strong>
                                    </div>
                                </div>
                                <p style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-muted)', fontSize: '14px' }}>You have successfully checked in for the day. You may close this window.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                                <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>Select you assigned role for the day:</p>
                                <div className="category-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', margin: '0 0 32px' }}>
                                    {categories.map((cat) => (
                                        <button
                                            key={cat}
                                            type="button"
                                            className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                                            onClick={() => setSelectedCategory(cat)}
                                            style={{
                                                padding: '24px 16px',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
                                            }}
                                        >
                                            <span style={{ fontSize: '24px' }}>{cat.toLowerCase().includes('skill') ? '🛠️' : '👷'}</span>
                                            {cat}
                                        </button>
                                    ))}
                                </div>

                                {error && <div className="error-msg" style={{ width: '100%', maxWidth: '500px', margin: '0 auto 20px' }}>{error}</div>}

                                <button type="submit" className="btn btn-primary btn-full" style={{ padding: '20px', fontSize: '18px', maxWidth: '400px' }} disabled={submitting || !selectedCategory}>
                                    {submitting ? 'Submitting...' : selectedCategory ? `Punch In as ${selectedCategory}` : 'Select a Role'}
                                </button>
                            </form>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
