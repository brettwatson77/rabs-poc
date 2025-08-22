import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { 
  FiMapPin, 
  FiSearch, 
  FiAlertCircle, 
  FiArrowLeft, 
  FiArrowRight, 
  FiRefreshCw, 
  FiX, 
  FiUser, 
  FiPhone, 
  FiMail, 
  FiSpeaker, 
  FiEye, 
  FiHome, 
  FiArrowUp, 
  FiCornerUpRight, 
  FiWifi, 
  FiMonitor, 
  FiCoffee, 
  FiThermometer, 
  FiLayers, 
  FiCheck, 
  FiAlertTriangle,
  FiEdit2,
  FiCalendar
} from 'react-icons/fi';
import { FaWheelchair } from 'react-icons/fa';

// API base URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3009';

// Page-specific styles
import '../styles/Venues.css';

// Venues Page Component
const Venues = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    capacity: 'all',
    accessibility: 'all',
    availability: 'all'
  });
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentWeekStart] = useState(() => {
    const today = new Date();
    return startOfWeek(today, { weekStartsOn: 1 }); // Week starts on Monday
  });
  const venuesPerPage = 24;

  // Fetch venues data
  const { 
    data: venuesData, 
    isLoading: venuesLoading, 
    error: venuesError,
    refetch: refetchVenues
  } = useQuery(
    ['venues'],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/venues`);
      return response.data;
    }
  );

  // Fetch bookings data
  const { 
    data: bookingsData
  } = useQuery(
    ['venueBookings', currentWeekStart],
    async () => {
      const endDate = format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const response = await axios.get(`${API_URL}/api/v1/venues/bookings`, {
        params: {
          start_date: format(currentWeekStart, 'yyyy-MM-dd'),
          end_date: endDate
        }
      });
      return response.data;
    }
  );

  // Helper function to get weekly bookings count for a venue
  const getWeeklyBookingsCount = (venueId) => {
    if (!bookingsData?.data) return 0;
    
    return bookingsData.data.filter(booking => booking.venue_id === venueId).length;
  };

  // Filter venues based on search term and filters
  const filteredVenues = venuesData?.data?.filter(venue => {
    const matchesSearch = 
      venue.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      venue.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      venue.suburb?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCapacity = filters.capacity === 'all' || 
      (filters.capacity === 'small' && venue.capacity <= 20) ||
      (filters.capacity === 'medium' && venue.capacity > 20 && venue.capacity <= 50) ||
      (filters.capacity === 'large' && venue.capacity > 50);
    
    const matchesAccessibility = filters.accessibility === 'all' || 
      (filters.accessibility === 'wheelchair' && venue.accessibility_features?.includes('wheelchair_access')) ||
      (filters.accessibility === 'hearing' && venue.accessibility_features?.includes('hearing_loop')) ||
      (filters.accessibility === 'vision' && venue.accessibility_features?.includes('vision_aids'));
    
    const matchesAvailability = filters.availability === 'all' || 
      (filters.availability === 'available' && isVenueAvailable(venue)) ||
      (filters.availability === 'unavailable' && !isVenueAvailable(venue));
    
    return matchesSearch && matchesCapacity && matchesAccessibility && matchesAvailability;
  }) || [];

  // Determine if a venue is available today (used in filters and status display)
  const isVenueAvailable = (venue) => {
    // Only active venues can be available
    if (venue.status !== 'active') return false;

    const today = new Date();
    const dayOfWeek = format(today, 'EEEE').toLowerCase(); // e.g. 'monday'
    const todayStr = format(today, 'yyyy-MM-dd');

    // If venue is closed today according to operating hours
    if (!venue.operating_hours?.[dayOfWeek]?.is_open) return false;

    // If the venue has an existing booking for today
    return !bookingsData?.data?.some(
      (booking) => booking.venue_id === venue.id && booking.start_date === todayStr
    );
  };

  // Currency formatter
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '$0.00';
    return `$${parseFloat(amount).toFixed(2)}`;
  };
  // Get status badge class
  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return 'badge-green';
      case 'maintenance':
        return 'badge-yellow';
      case 'closed':
        return 'badge-red';
      case 'reserved':
        return 'badge-blue';
      default:
        return 'badge-gray';
    }
  };

  // Format status for display
  const formatStatus = (status) => {
    if (!status) return 'Unknown';
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Pagination logic
  const indexOfLastVenue = currentPage * venuesPerPage;
  const indexOfFirstVenue = indexOfLastVenue - venuesPerPage;
  const currentVenues = filteredVenues.slice(indexOfFirstVenue, indexOfLastVenue);
  const totalPages = Math.ceil(filteredVenues.length / venuesPerPage);

  // Page change handlers
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Get accessibility icon
  const getAccessibilityIcon = (feature) => {
    switch (feature) {
      case 'wheelchair_access':
        return <FaWheelchair />;
      case 'hearing_loop':
        return <FiSpeaker />;
      case 'vision_aids':
        return <FiEye />;
      case 'accessible_restroom':
        return <FiHome />;
      case 'elevator':
        return <FiArrowUp />;
      case 'ramps':
        return <FiCornerUpRight />;
      default:
        return <FiCheck />;
    }
  };

  // Get facility icon
  const getFacilityIcon = (facility) => {
    switch (facility) {
      case 'wifi':
        return <FiWifi />;
      case 'projector':
        return <FiMonitor />;
      case 'sound_system':
        return <FiSpeaker />;
      case 'kitchen':
        return <FiCoffee />;
      case 'parking':
        return <FiMapPin />;
      case 'air_conditioning':
        return <FiThermometer />;
      case 'heating':
        return <FiThermometer />;
      case 'whiteboard':
        return <FiEdit2 />;
      case 'stage':
        return <FiLayers />;
      default:
        return <FiCheck />;
    }
  };

  // Render directory tab content
const renderDirectoryTab = () => (
  <div className="directory-tab">
    {/* Page Header */}
    <header className="page-header">
      <h2>Venues</h2>
    </header>

    {/* Global search / filter bar */}
    <div className="search-filter-bar glass-panel">
      {/* Search */}
      <div className="search-container">
        <FiSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search venues..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Filters */}
      <div className="filter-container">
        <div className="filter-dropdown glass-panel">
          {/* Capacity */}
          <div className="filter-group">
            <label htmlFor="capacity-filter">Capacity</label>
            <select
              id="capacity-filter"
              value={filters.capacity}
              onChange={(e) =>
                setFilters({ ...filters, capacity: e.target.value })
              }
            >
              <option value="all">All</option>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>

          {/* Accessibility */}
          <div className="filter-group">
            <label htmlFor="access-filter">Accessibility</label>
            <select
              id="access-filter"
              value={filters.accessibility}
              onChange={(e) =>
                setFilters({ ...filters, accessibility: e.target.value })
              }
            >
              <option value="all">All</option>
              <option value="wheelchair">Wheelchair</option>
              <option value="hearing">Hearing</option>
              <option value="vision">Vision</option>
            </select>
          </div>

          {/* Availability */}
          <div className="filter-group">
            <label htmlFor="availability-filter">Availability</label>
            <select
              id="availability-filter"
              value={filters.availability}
              onChange={(e) =>
                setFilters({ ...filters, availability: e.target.value })
              }
            >
              <option value="all">All</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>
        </div>
      </div>

    </div>

    {/* Venues Grid */}
    {venuesLoading ? (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading venues...</p>
      </div>
    ) : venuesError ? (
      <div className="error-container glass-panel">
        <FiAlertCircle className="error-icon" />
        <p>Error loading venues: {venuesError.message}</p>
        <button className="btn btn-primary" onClick={() => refetchVenues()}>
          <FiRefreshCw /> Try Again
        </button>
      </div>
    ) : filteredVenues.length === 0 ? (
      <div className="empty-state glass-panel">
        <FiMapPin className="empty-icon" />
        <h3>No venues found</h3>
        <p>Try adjusting your search.</p>
      </div>
    ) : (
      <>
        <div className="venues-grid">
          {currentVenues.map((venue) => {
            // Calculate booking stats
            const weeklyBookings = getWeeklyBookingsCount(venue.id);
            const capacity = venue.capacity || 0;
            const utilPercentage = capacity > 0 ? Math.min(100, Math.max(0, (weeklyBookings / 7) * 100)) : 0;
            
            return (
              <div
                key={venue.id}
                className={`venue-card glass-card ${selectedVenue?.id === venue.id ? 'selected' : ''}`}
                onClick={() => setSelectedVenue(venue)}
              >
                <div className="venue-header">
                  <h3 className="venue-name">{venue.name}</h3>
                  <span className={`badge ${getStatusBadge(venue.status)}`}>
                    {formatStatus(venue.status)}
                  </span>
                </div>
                <div className="venue-info">
                  <p className="venue-address">
                    <FiMapPin className="icon" /> {venue.address}, {venue.suburb} {venue.state} {venue.postcode}
                  </p>
                </div>
                
                {/* Middle row with utilisation bar */}
                <div className="venue-middle">
                  <div className="util-stats">
                    <span><FiCalendar /> This week: {weeklyBookings} bookings</span>
                    {capacity > 0 && <span>Capacity: {capacity}</span>}
                  </div>
                  <div className="util-bar">
                    <div className="util-fill" style={{ width: `${utilPercentage}%` }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination-container">
            <button
              className="pagination-btn"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
            >
              <FiArrowLeft /> Previous
            </button>
            <div className="pagination-info">
              Page {currentPage} of {totalPages}
            </div>
            <button
              className="pagination-btn"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              Next <FiArrowRight />
            </button>
          </div>
        )}
      </>
    )}

    {/* Venue Detail Modal */}
    {selectedVenue && (
      <div className="modal-overlay" onClick={() => setSelectedVenue(null)}>
        <div className="modal-content venue-detail-modal glass-panel" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{selectedVenue.name}</h3>
            <button className="modal-close" onClick={() => setSelectedVenue(null)}>
              <FiX />
            </button>
          </div>

          {/* Address & Contact */}
          <div className="detail-section glass-card">
            <h4>Address & Contact</h4>
            <p>
              <FiMapPin /> {selectedVenue.address}, {selectedVenue.suburb} {selectedVenue.state}{' '}
              {selectedVenue.postcode}
            </p>
            {selectedVenue.contact_name && (
              <p>
                <FiUser /> {selectedVenue.contact_name}
              </p>
            )}
            {selectedVenue.contact_phone && (
              <p>
                <FiPhone /> <a href={`tel:${selectedVenue.contact_phone}`}>{selectedVenue.contact_phone}</a>
              </p>
            )}
            {selectedVenue.contact_email && (
              <p>
                <FiMail />{' '}
                <a href={`mailto:${selectedVenue.contact_email}`}>{selectedVenue.contact_email}</a>
              </p>
            )}
          </div>

          {/* Google Maps */}
          <div className="detail-section glass-card">
            <h4>Location Map</h4>
            <div className="map-wrapper">
              <iframe
                title="venue-map"
                src={`https://www.google.com/maps?q=${encodeURIComponent(
                  `${selectedVenue.address}, ${selectedVenue.suburb} ${selectedVenue.state} ${selectedVenue.postcode}`
                )}&output=embed`}
                loading="lazy"
              ></iframe>
            </div>
          </div>

          {/* Facilities & Accessibility */}
          <div className="detail-section glass-card">
            <h4>Facilities & Accessibility</h4>
            <div className="badge-list">
              {selectedVenue.facilities?.map((f, i) => (
                <span key={i} className="badge badge-blue">
                  {getFacilityIcon(f)} {f.replace(/_/g, ' ')}
                </span>
              ))}
              {selectedVenue.accessibility_features?.map((a, i) => (
                <span key={i} className="badge badge-green">
                  {getAccessibilityIcon(a)} {a.replace(/_/g, ' ')}
                </span>
              ))}
              {(!selectedVenue.facilities || selectedVenue.facilities.length === 0) &&
                (!selectedVenue.accessibility_features ||
                  selectedVenue.accessibility_features.length === 0) && (
                  <p className="text-muted">No facilities or accessibility features listed.</p>
                )}
            </div>
          </div>

          {/* Pricing */}
          <div className="detail-section glass-card">
            <h4>Pricing</h4>
            <p>
              Hourly Rate: <strong>{formatCurrency(selectedVenue.hourly_rate)}</strong>
            </p>
            <p>
              Daily Rate: <strong>{formatCurrency(selectedVenue.daily_rate)}</strong>
            </p>
          </div>

          {/* Hazards */}
          <div className="detail-section glass-card">
            <h4>Hazards</h4>
            {selectedVenue.hazards && selectedVenue.hazards.length > 0 ? (
              <ul className="hazard-list">
                {selectedVenue.hazards.map((h, i) => (
                  <li key={i}>
                    <FiAlertTriangle /> {h}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">No hazards recorded.</p>
            )}
          </div>

          {/* Operating Hours */}
          {selectedVenue.operating_hours && (
            <div className="detail-section glass-card">
              <h4>Operating Hours</h4>
              <ul className="hours-list">
                {Object.entries(selectedVenue.operating_hours).map(([day, info]) => (
                  <li key={day}>
                    <strong>{day.charAt(0).toUpperCase() + day.slice(1)}:</strong>{' '}
                    {info.is_open ? `${info.open} – ${info.close}` : 'Closed'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);

/* -------------------------------------------------------------------------- */
/*                               Page Rendering                               */
/* -------------------------------------------------------------------------- */

return (
  <div className="venues-page">
    {renderDirectoryTab()}
  </div>
);
};

export default Venues;
