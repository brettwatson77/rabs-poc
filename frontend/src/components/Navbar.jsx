import React from 'react';
import { Link } from 'react-router-dom';

const navStyles = {
  backgroundColor: '#2d3748',
  /* 1rem top/bottom, 20px left/right to match main content padding */
  padding: '1rem 20px',
  /* Keep navbar flush; individual pages can manage their own spacing */
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  /* Consistent spacing between any left-side items (future logo) and the ul */
  gap: '1.5rem',
};

const ulStyles = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  gap: '1.5rem',
};

const linkStyles = {
  color: '#fff',
  textDecoration: 'none',
  fontSize: '1.1rem',
  fontWeight: '500',
};

const Navbar = () => {
  return (
    <nav style={navStyles}>
      <ul style={ulStyles}>
        <li>
          <Link to="/dashboard" style={linkStyles}>Dashboard</Link>
        </li>
        <li>
          <Link to="/" style={linkStyles}>Master Schedule</Link>
        </li>
        <li>
          <Link to="/planner" style={linkStyles}>Participant Planner</Link>
        </li>
        <li>
          <Link to="/participants" style={linkStyles}>Participants</Link>
        </li>
        <li>
          <Link to="/staff" style={linkStyles}>Staff</Link>
        </li>
        <li>
          <Link to="/vehicles" style={linkStyles}>Vehicles</Link>
        </li>
        <li>
          <Link to="/venues" style={linkStyles}>Venues</Link>
        </li>
        <li>
          <Link to="/finance" style={linkStyles}>Finance</Link>
        </li>
        <li>
          <Link to="/dynamic-demo" style={linkStyles}>Dynamic Demo</Link>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;
