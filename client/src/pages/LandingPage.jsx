import { Link } from 'react-router-dom';

export default function LandingPage() {
    return (
        <div className="landing-container">
            {/* Animated background orbs */}
            <div className="landing-orb orb-1"></div>
            <div className="landing-orb orb-2"></div>
            <div className="landing-orb orb-3"></div>

            <div className="landing-content">
                <div className="landing-logo">
                    <div className="landing-icon">
                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                            {/* KH Petal-inspired logo */}
                            <defs>
                                <linearGradient id="kh1" x1="0" y1="0" x2="48" y2="48">
                                    <stop stopColor="#f59e0b"/>
                                    <stop offset="0.5" stopColor="#f97316"/>
                                    <stop offset="1" stopColor="#14b8a6"/>
                                </linearGradient>
                            </defs>
                            {/* Stylized KH letters */}
                            <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle"
                                fill="url(#kh1)" fontFamily="Outfit, sans-serif" fontWeight="800" fontSize="22">
                                KH
                            </text>
                            {/* Petal accents */}
                            <circle cx="8" cy="8" r="4" fill="#f59e0b" opacity="0.3"/>
                            <circle cx="40" cy="8" r="3" fill="#14b8a6" opacity="0.3"/>
                            <circle cx="40" cy="40" r="4" fill="#f97316" opacity="0.3"/>
                            <circle cx="8" cy="40" r="3" fill="#22c55e" opacity="0.3"/>
                        </svg>
                    </div>
                    <h1 className="landing-title">KH Attendance</h1>
                    <p className="landing-subtitle">Smart workforce attendance tracking system</p>
                </div>

                <div className="landing-cards">
                    <Link to="/worker-login" className="role-card worker-card" id="worker-login-link">
                        <div className="role-card-icon">
                            <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
                                <circle cx="20" cy="14" r="7" stroke="currentColor" strokeWidth="2"/>
                                <path d="M8 34c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                        </div>
                        <h2>Worker</h2>
                        <p>Mark your daily attendance — just tap Yes or No</p>
                        <span className="role-card-arrow">→</span>
                    </Link>

                    <Link to="/manager-login" className="role-card manager-card" id="manager-login-link">
                        <div className="role-card-icon">
                            <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
                                <circle cx="20" cy="12" r="6" stroke="currentColor" strokeWidth="2"/>
                                <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M28 8l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M32 12h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                        </div>
                        <h2>Master</h2>
                        <p>Manage workers, categories & view attendance reports</p>
                        <span className="role-card-arrow">→</span>
                    </Link>
                </div>

                <p className="landing-footer-text">
                    Secure • Real-time • Push Notifications
                </p>
            </div>
        </div>
    );
}
