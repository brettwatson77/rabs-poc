/* 
 * Root application component
 * Renders the MasterSchedule page inside a basic padded container.
 */

import './App.css';

// React-Router
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Pages
import MasterSchedule from './pages/MasterSchedule';
import ParticipantPlanner from './pages/ParticipantPlanner';
import Finance from './pages/Finance';
import Participants from './pages/Participants';
import Staff from './pages/Staff';
import Vehicles from './pages/Vehicles';
import Venues from './pages/Venues';

// UI
import Navbar from './components/Navbar';
import Header from './components/Header';
// Context
import { AppContextProvider } from './context/AppContext';

function App() {
  return (
    <AppContextProvider>
      <Router>
        {/* Global header with date slider */}
        <Header />
        {/* Top navigation bar */}
        <Navbar />

        {/* Main routed content */}
        <main style={{ padding: '20px' }}>
          <Routes>
            <Route path="/" element={<MasterSchedule />} />
            <Route path="/planner" element={<ParticipantPlanner />} />
            <Route path="/participants" element={<Participants />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/venues" element={<Venues />} />
            <Route path="/finance" element={<Finance />} />
          </Routes>
        </main>
      </Router>
    </AppContextProvider>
  );
}

export default App;
