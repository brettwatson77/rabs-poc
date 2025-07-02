import React from 'react';
import { Link } from 'react-router-dom';

const navStyles = {
  backgroundColor: '#2d3748',
  padding: '1rem 2rem',
  marginBottom: '2rem',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
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
      </ul>
    </nav>
  );
};

export default Navbar;
