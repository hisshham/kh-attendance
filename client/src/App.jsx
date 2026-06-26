import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LandingPage from './pages/LandingPage';
import WorkerLogin from './pages/WorkerLogin';
import WorkerDashboard from './pages/WorkerDashboard';
import ManagerLogin from './pages/ManagerLogin';
import ManagerDashboard from './pages/ManagerDashboard';

function ProtectedRoute({ children, role }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="loading">Loading...</div>;
    if (!user) return <Navigate to="/" replace />;
    if (role && user.role !== role) return <Navigate to="/" replace />;
    return children;
}

function AppRoutes() {
    const { user } = useAuth();

    return (
        <Routes>
            {/* Landing — role selection (redirects if already logged in) */}
            <Route path="/" element={
                user
                    ? <Navigate to={user.role === 'manager' ? '/manager' : '/worker'} replace />
                    : <LandingPage />
            } />

            {/* Separate login pages */}
            <Route path="/worker-login" element={
                user
                    ? <Navigate to={user.role === 'manager' ? '/manager' : '/worker'} replace />
                    : <WorkerLogin />
            } />
            <Route path="/manager-login" element={
                user
                    ? <Navigate to={user.role === 'manager' ? '/manager' : '/worker'} replace />
                    : <ManagerLogin />
            } />

            {/* Protected dashboards */}
            <Route path="/worker" element={
                <ProtectedRoute role="worker"><WorkerDashboard /></ProtectedRoute>
            } />
            <Route path="/manager" element={
                <ProtectedRoute role="manager"><ManagerDashboard /></ProtectedRoute>
            } />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <ThemeProvider>
                <AuthProvider>
                    <AppRoutes />
                </AuthProvider>
            </ThemeProvider>
        </BrowserRouter>
    );
}
