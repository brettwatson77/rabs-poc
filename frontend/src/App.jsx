import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useQuery } from 'react-query';
import api from './api/api';
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
  FiAlertCircle,
  FiUser,
  FiBriefcase,
  FiTruck,
  FiMapPin
} from 'react-icons/fi';

// Real page components
import Dashboard from './pages/Dashboard';
import MasterSchedule from './pages/MasterSchedule';
import Roster from './pages/Roster';
import Finance from './pages/Finance';
import Settings from './pages/Settings';
import Participants from './pages/Participants';
import Staff from './pages/Staff';
import Vehicles from './pages/Vehicles';
import Venues from './pages/Venues';
import ProgramTemplateWizard from './pages/ProgramTemplateWizard';

// Toast notifications
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// The above four pages are full-featured components located in ./pages/

// Global UI styles
import './styles/UI.css';

// Health check component
const HealthCheck = () => {
  const { data, error, isLoading } = useQuery(
    'health',
    async () => {
      console.log('Header health URL', '/health');
      try {
        const response = await api.get('/health');
        console.log(
          'Header health URL/status/body',
          '/health',
          response.status,
          response.data
        );
        return response.data;
      } catch (err) {
        console.log(
          'Header health error',
          err.response?.status || 'network',
          err?.response?.data
        );
        throw err;
      }
    },
    {
      refetchInterval: 60000, // Check every 60 seconds
      refetchIntervalInBackground: true,
    }
  );

  // unified healthy test
  const isHealthy = (d) =>
    !!d && (d.ok === true || d.success === true || d.status === 'ok');

  if (isLoading) {
    return (
      <div className="health-check health-loading">
        <FiActivity className="health-icon pulse" />
        <span>Connecting...</span>
      </div>
    );
  }

  // Consider both HTTP 200 and data.ok === true for success
  if (error || !isHealthy(data)) {
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
          
          {/* Main text navigation (left) */}
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
              to="/schedule" 
              className={({ isActive }) => 
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              <FiCalendar />
              <span>Schedule</span>
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
          </nav>
          
          {/* Right side with icons-only navigation and system status */}
          <div className="navbar-right">
            {/* Icon-only navigation */}
            <nav className="icon-nav">
              <NavLink 
                to="/participants" 
                className={({ isActive }) => 
                  isActive ? 'icon-link active' : 'icon-link'
                }
                title="Participants"
              >
                <FiUser />
              </NavLink>
              
              <NavLink 
                to="/staff" 
                className={({ isActive }) => 
                  isActive ? 'icon-link active' : 'icon-link'
                }
                title="Staff"
              >
                <FiBriefcase />
              </NavLink>
              
              <NavLink 
                to="/vehicles" 
                className={({ isActive }) => 
                  isActive ? 'icon-link active' : 'icon-link'
                }
                title="Vehicles"
              >
                <FiTruck />
              </NavLink>
              
              <NavLink 
                to="/venues" 
                className={({ isActive }) => 
                  isActive ? 'icon-link active' : 'icon-link'
                }
                title="Venues"
              >
                <FiMapPin />
              </NavLink>
              
              <NavLink 
                to="/finance" 
                className={({ isActive }) => 
                  isActive ? 'icon-link active' : 'icon-link'
                }
                title="Finance"
              >
                <FiDollarSign />
              </NavLink>
              
              <NavLink 
                to="/settings" 
                className={({ isActive }) => 
                  isActive ? 'icon-link active' : 'icon-link'
                }
                title="Settings"
              >
                <FiSettings />
              </NavLink>
            </nav>
            
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
              <p>RABS v3.5 | from flushed to finished</p>
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

// Main App component
const App = () => {
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/schedule" element={<MasterSchedule />} />
          <Route path="/roster" element={<Roster />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/participants" element={<Participants />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/venues" element={<Venues />} />
          <Route path="/template-wizard" element={<ProgramTemplateWizard />} />
        </Routes>
      </Layout>
      <ToastContainer position="bottom-right" autoClose={3000} />
    </>
  );
};

export default App;
