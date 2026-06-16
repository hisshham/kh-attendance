import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function WorkerLogin() {
    const { loginWorker } = useAuth();

    const [workerId, setWorkerId] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [showPinReset, setShowPinReset] = useState(false);
    const [tempToken, setTempToken] = useState(null);
    const [tempWorker, setTempWorker] = useState(null);
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');

    async function handleLogin(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await api.post('/auth/worker/login', { workerId: workerId.trim(), pin });
            if (res.data.worker.requiresPinReset) {
                setTempToken(res.data.accessToken);
                setTempWorker(res.data.worker);
                setShowPinReset(true);
                setPin('');
            } else {
                loginWorker(res.data.accessToken, res.data.worker);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed. Check your credentials.');
        } finally {
            setLoading(false);
        }
    }

    async function handlePinReset(e) {
        e.preventDefault();
        setError('');

        if (newPin.length < 4) { setError('PIN must be at least 4 digits'); return; }
        if (newPin !== confirmPin) { setError('PINs do not match'); return; }

        setLoading(true);
        try {
            await api.post('/auth/worker/change-pin', { newPin }, {
                headers: { Authorization: `Bearer ${tempToken}` },
            });
            loginWorker(tempToken, { ...tempWorker, requiresPinReset: false });
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update PIN.');
        } finally {
            setLoading(false);
        }
    }

    if (showPinReset) {
        return (
            <div className="login-container">
                <div className="login-card">
                    <div className="logo">
                        <h1>KH Attendance</h1>
                        <p>Set Your New PIN</p>
                        <span className="role-badge worker">Security Setup</span>
                    </div>

                    {error && <div className="error-msg">{error}</div>}

                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '13px' }}>
                        For security, set a new personal PIN. Do not share it.
                    </p>

                    <form onSubmit={handlePinReset}>
                        <div className="form-group">
                            <label>New Secret PIN</label>
                            <input type="password" placeholder="••••••" value={newPin}
                                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                                maxLength={6} inputMode="numeric" required autoFocus />
                        </div>
                        <div className="form-group">
                            <label>Confirm PIN</label>
                            <input type="password" placeholder="••••••" value={confirmPin}
                                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                                maxLength={6} inputMode="numeric" required />
                        </div>
                        <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                            {loading ? 'Updating...' : 'Set New PIN & Enter'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="logo">
                    <h1>KH Attendance</h1>
                    <p>Worker Attendance System</p>
                    <span className="role-badge worker">Worker Portal</span>
                </div>

                {error && <div className="error-msg">{error}</div>}

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label>Worker ID</label>
                        <input type="text" placeholder="e.g. WRK-001" value={workerId}
                            onChange={(e) => setWorkerId(e.target.value.toUpperCase())}
                            autoComplete="username" required autoFocus />
                    </div>
                    <div className="form-group">
                        <label>PIN</label>
                        <input type="password" placeholder="••••••" value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                            maxLength={6} inputMode="numeric" autoComplete="current-password" required />
                    </div>
                    <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="login-switch">
                    <Link to="/">← Back to Role Selection</Link>
                </div>
            </div>
        </div>
    );
}
