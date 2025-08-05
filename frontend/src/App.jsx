import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useQuery } from 'react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

// Icons
import { 
  FiCalendar, 
  FiGrid, 
  FiUsers, 
  FiDollarSign, 
  FiSettings,
  FiActivity,
  FiCheckCircle,
  FiAlertCircle
} from 'react-icons/fi';

// API base URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3009';

// Health check component
const HealthCheck = () => {
  const { data, error, isLoading } = useQuery(
    'health',
    async () => {
      const response = await axios.get(`${API_URL}/health`);
      return response.data;
    },
    {
      refetchInterval: 30000, // Check every 30 seconds
      refetchIntervalInBackground: true,
    }
  );

  if (isLoading) {
    return (
      <div className="health-check health-loading">
        <FiActivity className="health-icon pulse" />
        <span>Connecting...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="health-check health-error">
        <FiAlertCircle className="health-icon" />
        <span>Backend offline</span>
      </div>
    );
  }

  return (
    <div className="health-check health-online">
      <FiCheckCircle className="health-icon" />
      <span>Backend online</span>
    </div>
  );
};

// Layout component with navigation
const Layout = ({ children }) => {
  const location = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Update date every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="app-container">
      <header className="glass-navbar">
        <div className="navbar-container">
          <div className="navbar-brand">
            <h1 className="logo">
              <span className="bg-gradient">RABS</span>
              <span className="version">v3</span>
            </h1>
            <div className="date-display">
              {format(currentDate, 'EEEE, MMMM d, yyyy')}
            </div>
          </div>
          
          <nav className="main-nav">
            <NavLink 
              to="/" 
              end
              className={({ isActive }) => 
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              <FiGrid />
              <span>Dashboard</span>
            </NavLink>
            
            <NavLink 
              to="/master-schedule" 
              className={({ isActive }) => 
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              <FiCalendar />
              <span>Master Schedule</span>
            </NavLink>
            
            <NavLink 
              to="/roster" 
              className={({ isActive }) => 
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              <FiUsers />
              <span>Roster</span>
            </NavLink>
            
            <NavLink 
              to="/finance" 
              className={({ isActive }) => 
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              <FiDollarSign />
              <span>Finance</span>
            </NavLink>
            
            <NavLink 
              to="/settings" 
              className={({ isActive }) => 
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              <FiSettings />
              <span>Settings</span>
            </NavLink>
          </nav>
          
          <div className="navbar-right">
            <HealthCheck />
          </div>
        </div>
      </header>
      
      <main className="main-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="page-container"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      
      <footer className="app-footer glass-panel">
        <div className="container">
          <div className="footer-content">
            <div className="footer-info">
              <p>RABS v3 | RP2: From Flushed to Finished</p>
            </div>
            <div className="footer-links">
              <a href="#" onClick={(e) => e.preventDefault()}>About</a>
              <a href="#" onClick={(e) => e.preventDefault()}>Help</a>
              <a href="#" onClick={(e) => e.preventDefault()}>API</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Placeholder page components
const Dashboard = () => (
  <div className="container">
    <h2 className="page-title">Dashboard</h2>
    <p className="page-description">
      View today's schedule, active programs, and alerts.
    </p>
    
    <div className="glass-card dashboard-welcome-card mb-4">
      <h3>Welcome to RABS v3</h3>
      <p>
        The all-new Roster & Billing System for NDIS providers. 
        This clean-slate rebuild follows the RP2 methodology, 
        with API-IS-KING principle in full effect.
      </p>
      <p>
        The loom window is ready to weave the future!
      </p>
    </div>
    
    <div className="grid grid-3">
      <div className="glass-card dashboard-card">
        <div className="dashboard-card-content">
          <h4>Today's Programs</h4>
          <p className="text-muted">Loading today's schedule...</p>
        </div>
      </div>
      
      <div className="glass-card dashboard-card">
        <div className="dashboard-card-content">
          <h4>Staff On Duty</h4>
          <p className="text-muted">Loading staff roster...</p>
        </div>
      </div>
      
      <div className="glass-card dashboard-card">
        <div className="dashboard-card-content">
          <h4>Vehicle Assignments</h4>
          <p className="text-muted">Loading vehicle data...</p>
        </div>
      </div>
    </div>
  </div>
);

const MasterSchedule = () => (
  <div className="container">
    <h2 className="page-title">Master Schedule</h2>
    <p className="page-description">
      Create and manage program templates, view and edit the schedule.
    </p>
    
    <div className="glass-card mb-4">
      <div className="card-header">
        <h3>Program Templates</h3>
      </div>
      <p className="text-muted">Loading program templates...</p>
    </div>
    
    <div className="glass-card">
      <div className="card-header">
        <h3>Loom Calendar</h3>
      </div>
      <p className="text-muted">Loading loom instances...</p>
    </div>
  </div>
);

const Roster = () => (
  <div className="container">
    <h2 className="page-title">Roster</h2>
    <p className="page-description">
      Manage staff assignments, availability, and shifts.
    </p>
    
    <div className="glass-card">
      <div className="card-header">
        <h3>Staff Roster</h3>
      </div>
      <p className="text-muted">Loading roster data...</p>
    </div>
  </div>
);

const Finance = () => (
  <div className="container">
    <h2 className="page-title">Finance</h2>
    <p className="page-description">
      Manage billing codes, generate invoices, and export financial data.
    </p>
    
    <div className="glass-card">
      <div className="card-header">
        <h3>NDIS Billing</h3>
      </div>
      <p className="text-muted">Loading billing data...</p>
    </div>
  </div>
);

const Settings = () => (
  <div className="container">
    <h2 className="page-title">Settings</h2>
    <p className="page-description">
      Configure system settings, loom window, and user preferences.
    </p>
    
    <div className="glass-card">
      <div className="card-header">
        <h3>System Configuration</h3>
      </div>
      <p className="text-muted">Loading settings...</p>
    </div>
  </div>
);

// Main App component
const App = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/master-schedule" element={<MasterSchedule />} />
        <Route path="/roster" element={<Roster />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
};

export default App;
