import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { getSocket } from '../services/socket';

const hasPushSupport = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

export default function WorkerDashboard() {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [todayAttendance, setTodayAttendance] = useState(null);
    const [workerInfo, setWorkerInfo] = useState(null);
    const [editDeadlineEnabled, setEditDeadlineEnabled] = useState(false);
    const [editDeadlineTime, setEditDeadlineTime] = useState(null);
    const [serverTime, setServerTime] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [editing, setEditing] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [pushEnabled, setPushEnabled] = useState(hasPushSupport && Notification.permission === 'granted');

    useEffect(() => {
        loadToday();

        const socket = getSocket();
        socket.emit('worker_online', user?.workerId);

        if (hasPushSupport && Notification.permission === 'granted') {
            setupPush();
        }

        return () => {
            socket.emit('worker_offline', user?.workerId);
        };
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
            if (!hasPushSupport) return;
            const reg = await navigator.serviceWorker.ready;
            const res = await api.get('/api/push/vapid-key');
            if (!res.data.publicKey) return;

            let sub = await reg.pushManager.getSubscription();
            if (sub) {
                try {
                    await api.post('/api/push/subscribe', sub);
                    setPushEnabled(true);
                    return;
                } catch {
                    await sub.unsubscribe();
                    await api.post('/api/push/unsubscribe', { endpoint: sub.endpoint });
                }
            }

            sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: await urlBase64ToUint8Array(res.data.publicKey),
            });
            await api.post('/api/push/subscribe', sub);
            setPushEnabled(true);
        } catch (err) {
            console.error('Push error:', err);
            if (err.message && err.message.includes('applicationServerKey')) {
                try {
                    const reg = await navigator.serviceWorker.ready;
                    const existingSub = await reg.pushManager.getSubscription();
                    if (existingSub) {
                        await existingSub.unsubscribe();
                        await api.post('/api/push/unsubscribe', { endpoint: existingSub.endpoint });
                    }
                    const res = await api.get('/api/push/vapid-key');
                    const newSub = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: await urlBase64ToUint8Array(res.data.publicKey),
                    });
                    await api.post('/api/push/subscribe', newSub);
                    setPushEnabled(true);
                } catch (retryErr) {
                    console.error('Push retry failed:', retryErr);
                }
            }
        }
    }

    async function requestPush() {
        try {
            if (!hasPushSupport) {
                alert('Push notifications are not supported in this browser. On iPhone, open this website in Safari, tap the Share button, then tap "Add to Home Screen". Open the app from your home screen and try again.');
                return;
            }
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                await setupPush();
            } else {
                alert('Push notifications were denied. Please go to your phone Settings > Notifications and allow notifications for this app.');
            }
        } catch (err) {
            alert('Could not request notification permission: ' + err.message);
        }
    }

    async function loadToday() {
        try {
            const res = await api.get('/api/worker/attendance/today');
            setTodayAttendance(res.data.attendance);
            setWorkerInfo(res.data.worker);
            setEditDeadlineEnabled(res.data.editDeadlineEnabled);
            setEditDeadlineTime(res.data.editDeadlineTime);
            setServerTime(res.data.currentISTTime);
        } catch (err) {
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(isPresent) {
        setSubmitting(true);
        setError('');
        setMessage('');
        try {
            await api.post('/api/worker/attendance', { isPresent });
            setMessage(isPresent ? '✅ Marked as Present!' : '❌ Marked as Absent');
            setEditing(false);
            loadToday();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to submit');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleUpdate(isPresent) {
        setSubmitting(true);
        setError('');
        setMessage('');
        try {
            await api.patch('/api/worker/attendance/update', { isPresent });
            setMessage(isPresent ? '✅ Updated to Present!' : '❌ Updated to Absent');
            setEditing(false);
            loadToday();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update');
        } finally {
            setSubmitting(false);
        }
    }

    function canEdit() {
        if (!editDeadlineEnabled) return true;
        if (!editDeadlineTime || !serverTime) return true;
        const [dh, dm] = editDeadlineTime.split(':').map(Number);
        const [sh, sm] = serverTime.split(':').map(Number);
        return (sh * 60 + sm) < (dh * 60 + dm);
    }

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
    const isEditAllowed = canEdit();

    const ThemeToggleSmall = () => (
        <button className="theme-toggle" onClick={toggleTheme} style={{ padding: '4px 8px' }}>
            {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            )}
        </button>
    );

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)' }}><div className="loader"></div></div>;

    return (
        <div className="worker-container">
            <div className="worker-card-main">
                {/* Header */}
                <div className="worker-header">
                    <p className="worker-greeting">{greeting}</p>
                    <h1 className="worker-name">{user?.name || user?.workerId}</h1>
                    <div className="worker-header-actions">
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className="badge badge-manager">ID: {user?.workerId}</span>
                            {workerInfo?.lineData && (
                                <span className="badge badge-teal">{workerInfo.lineData}</span>
                            )}
                            {workerInfo?.category && (
                                <span className="badge badge-purple">{workerInfo.category}</span>
                            )}
                            {workerInfo?.experience && (
                                <span className="badge badge-orange">{workerInfo.experience}</span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <ThemeToggleSmall />
                            <button className="btn btn-sm btn-outline" onClick={logout}>Logout</button>
                        </div>
                    </div>
                </div>

                {/* Push notification banner */}
                {!pushEnabled && hasPushSupport && (
                    <div className="push-banner">
                        <div>
                            <strong style={{ color: 'var(--accent-orange)' }}>🔔 Enable Reminders</strong>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Get notified when it's time to log attendance.</p>
                        </div>
                        <button className="btn btn-sm btn-primary" onClick={requestPush}>Enable</button>
                    </div>
                )}
                {!hasPushSupport && (
                    <div className="push-banner" style={{ borderColor: 'rgba(255, 59, 48, 0.15)' }}>
                        <div>
                            <strong style={{ color: 'var(--accent-red)' }}>📱 iPhone Notice</strong>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>To receive notifications: Safari → Share → "Add to Home Screen" → open from home screen.</p>
                        </div>
                    </div>
                )}

                {/* Messages */}
                {message && <div className="success-msg" style={{ marginBottom: '14px', textAlign: 'center' }}>{message}</div>}
                {error && <div className="error-msg" style={{ textAlign: 'center' }}>{error}</div>}

                {/* Main attendance area */}
                {todayAttendance && !editing ? (
                    <div className="attendance-status" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
                        <div className="status-icon">
                            {todayAttendance.isPresent ? '✅' : '❌'}
                        </div>
                        <h2 className="status-title" style={{ color: todayAttendance.isPresent ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {todayAttendance.isPresent ? 'You are Present Today' : 'You are Absent Today'}
                        </h2>

                        <div className="status-details">
                            <div className="status-row">
                                <span className="status-row-label">Status</span>
                                <span className="status-row-value" style={{ color: todayAttendance.isPresent ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                    {todayAttendance.isPresent ? 'Present' : 'Absent'}
                                </span>
                            </div>
                            <div className="status-row">
                                <span className="status-row-label">Line Data</span>
                                <span className="status-row-value">{todayAttendance.lineData || '—'}</span>
                            </div>
                            <div className="status-row">
                                <span className="status-row-label">Category</span>
                                <span className="status-row-value">{todayAttendance.category || '—'}</span>
                            </div>
                            <div className="status-row">
                                <span className="status-row-label">Experience</span>
                                <span className="status-row-value">{todayAttendance.experience || '—'}</span>
                            </div>
                            <div className="status-row">
                                <span className="status-row-label">Logged At</span>
                                <span className="status-row-value">
                                    {new Date(todayAttendance.timestamp).toLocaleTimeString('en-IN', { hour12: true })}
                                </span>
                            </div>
                        </div>

                        {isEditAllowed ? (
                            <button className="edit-attendance-btn" onClick={() => setEditing(true)} disabled={submitting}>
                                ✏️ Edit My Response
                            </button>
                        ) : (
                            <div className="locked-msg">
                                🔒 Editing locked after {editDeadlineTime}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="attendance-question" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
                        <h2>{editing ? '✏️ Change Your Response' : '📋 Daily Attendance'}</h2>
                        <p className="attendance-date">
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>

                        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '16px', fontWeight: '600' }}>
                            Are you present today?
                        </p>

                        <div className="yes-no-buttons">
                            <button
                                className="btn-yes"
                                onClick={() => editing ? handleUpdate(true) : handleSubmit(true)}
                                disabled={submitting}
                            >
                                <span className="btn-icon">✓</span>
                                YES
                            </button>
                            <button
                                className="btn-no"
                                onClick={() => editing ? handleUpdate(false) : handleSubmit(false)}
                                disabled={submitting}
                            >
                                <span className="btn-icon">✗</span>
                                NO
                            </button>
                        </div>

                        {editing && (
                            <button
                                className="btn btn-outline btn-full"
                                style={{ marginTop: '14px' }}
                                onClick={() => setEditing(false)}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
