import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function ManagerLogin() {
    const { loginManager } = useAuth();
    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await api.post('/auth/manager/login', { username: username.trim(), pin });
            loginManager(res.data.accessToken, res.data.manager);
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="logo">
                    <h1>KH Attendance</h1>
                    <p>Management Console</p>
                    <span className="role-badge manager">Master Login</span>
                </div>

                {error && <div className="error-msg">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Username</label>
                        <input type="text" placeholder="manager" value={username}
                            onChange={(e) => setUsername(e.target.value)}
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
