import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('accessToken'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (payload.exp * 1000 < Date.now()) {
                    logout();
                } else {
                    setUser(payload);
                }
            } catch {
                logout();
            }
        }
        setLoading(false);
    }, [token]);

    function loginWorker(accessToken, workerData) {
        localStorage.setItem('accessToken', accessToken);
        setToken(accessToken);
        setUser({ ...workerData, role: 'worker' });
    }

    function loginManager(accessToken, managerData) {
        localStorage.setItem('accessToken', accessToken);
        setToken(accessToken);
        setUser({ ...managerData, role: 'manager' });
    }

    function logout() {
        localStorage.removeItem('accessToken');
        setToken(null);
        setUser(null);
        api.post('/auth/logout').catch(() => { });
    }

    return (
        <AuthContext.Provider value={{ user, token, loading, loginWorker, loginManager, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
