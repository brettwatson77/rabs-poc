import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api, { 
  createVenue as apiCreateVenue, 
  updateVenue as apiUpdateVenue, 
  deleteVenue as apiDeleteVenue 
} from '../api/api';
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
  FiPlus,
  FiTrash2
} from 'react-icons/fi';
import { FaWheelchair } from 'react-icons/fa';
import VenueForm from '../components/VenueForm';

// Page-specific styles
import '../styles/Venues.css';

// Venues Page Component
const Venues = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    capacity: 'all',
    accessibility: 'all'
  });
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editVenue, setEditVenue] = useState(null);
  const [newVenue, setNewVenue] = useState({
    name: '',
    address: '',
    suburb: '',
    state: '',
    postcode: '',
    capacity: '',
    contact_phone: '',
    contact_email: '',
    accessibility_features: '',
    venue_type: '',
    notes: '',
    is_active: true
  });
  
  const venuesPerPage = 24;
  const queryClient = useQueryClient();

  // Fetch venues data
  const { 
    data: venuesData, 
    isLoading: venuesLoading, 
    error: venuesError,
    refetch: refetchVenues
  } = useQuery(
    ['venues'],
    async () => {
      const response = await api.get('/venues');
      return response.data;
    }
  );

  // Setup mutations
  const createMutation = useMutation(
    (venueData) => apiCreateVenue(venueData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['venues']);
        setShowAddModal(false);
        setNewVenue({
          name: '',
          address: '',
          suburb: '',
          state: '',
          postcode: '',
          capacity: '',
          contact_phone: '',
          contact_email: '',
          accessibility_features: '',
          venue_type: '',
          notes: '',
          is_active: true
        });
      }
    }
  );

  const updateMutation = useMutation(
    ({ id, data }) => apiUpdateVenue(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['venues']);
        setEditVenue(null);
        if (selectedVenue) {
          // Refresh the selected venue data
          const updatedVenue = queryClient.getQueryData(['venues'])?.data?.find(
            v => v.id === selectedVenue.id
          );
          if (updatedVenue) {
            setSelectedVenue(updatedVenue);
          }
        }
      }
    }
  );

  const deleteMutation = useMutation(
    (venueId) => apiDeleteVenue(venueId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['venues']);
        setSelectedVenue(null);
      }
    }
  );

  // Helper to normalize features from multiple sources
  const getFeatureFlags = (venue) => {
    // Start with empty features object
    const features = {};
    
    // Add features from venue.features (JSONB) if present
    if (venue.features && typeof venue.features === 'object') {
      Object.assign(features, venue.features);
    }
    
    // Add features from venue.facilities array
    if (Array.isArray(venue.facilities)) {
      venue.facilities.forEach(facility => {
        features[facility] = true;
      });
    }
    
    // Add features from accessibility_features string
    if (typeof venue.accessibility_features === 'string') {
      venue.accessibility_features.split(',').forEach(feature => {
        const trimmed = feature.trim();
        if (trimmed) {
          features[trimmed] = true;
        }
      });
    }
    
    return features;
  };

  // Format feature key to display label
  const formatLabel = (key) =>
    key
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

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
    
    // Updated accessibility matching using normalized features
    const matchesAccessibility = () => {
      if (filters.accessibility === 'all') return true;
      
      // Get normalized features
      const features = getFeatureFlags(venue);
      
      // Check for specific accessibility features
      if (filters.accessibility === 'wheelchair' && features.wheelchair_access) return true;
      if (filters.accessibility === 'hearing' && features.hearing_loop) return true;
      if (filters.accessibility === 'vision' && features.vision_aids) return true;
      
      // Legacy fallback (just in case)
      if (filters.accessibility === 'wheelchair' && 
          venue.accessibility_features?.includes('wheelchair_access')) return true;
      if (filters.accessibility === 'hearing' && 
          venue.accessibility_features?.includes('hearing_loop')) return true;
      if (filters.accessibility === 'vision' && 
          venue.accessibility_features?.includes('vision_aids')) return true;
      
      return false;
    };
    
    return matchesSearch && matchesCapacity && matchesAccessibility();
  }) || [];

  // Currency formatter
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '$0.00';
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  // Format address for display
  const formatAddress = (venue) => {
    if (!venue) return '';
    return [venue.address, venue.suburb, venue.state, venue.postcode]
      .filter(Boolean)
      .join(', ');
  };

  // Check if venue is active (best effort)
  const isVenueActive = (venue) => {
    return venue.is_active ?? venue.active ?? (venue.status ? venue.status === 'active' : true);
  };

  // Handle venue deactivation or deletion
  const handleDeleteVenue = (venue, e) => {
    if (e) {
      e.stopPropagation();
    }
    
    // If we can soft deactivate
    if ('is_active' in venue || 'active' in venue) {
      updateMutation.mutate({
        id: venue.id,
        data: { is_active: false }
      });
    } else {
      // Hard delete with confirmation
      if (window.confirm(`Are you sure you want to delete "${venue.name}"? This cannot be undone.`)) {
        deleteMutation.mutate(venue.id);
      }
    }
  };

  // Handle venue activation
  const handleActivateVenue = (venue, e) => {
    if (e) {
      e.stopPropagation();
    }
    
    updateMutation.mutate({
      id: venue.id,
      data: { is_active: true }
    });
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
      case 'onsite_parking':
      case 'street_parking':
      case 'accessible_parking':
        return <FiMapPin />;
      case 'air_conditioning':
        return <FiThermometer />;
      case 'heating':
        return <FiThermometer />;
      case 'whiteboard':
        return <FiEdit2 />;
      case 'stage':
        return <FiLayers />;
      case 'wheelchair_access':
        return <FaWheelchair />;
      case 'accessible_restroom':
        return <FiHome />;
      default:
        return <FiCheck />;
    }
  };

  // Render directory tab content
  const renderDirectoryTab = () => (
    <div className="directory-tab">
      {/* Page Header */}
      <header className="page-header">
        <h2 className="page-title">Venues</h2>
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
          </div>
        </div>

        {/* Add Venue Button */}
        <button 
          className="create-btn"
          onClick={() => setShowAddModal(true)}
        >
          <FiPlus /> Add Venue
        </button>
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
              const active = isVenueActive(venue);
              const features = getFeatureFlags(venue);
              
              return (
                <div
                  key={venue.id}
                  className={`venue-card glass-card ${selectedVenue?.id === venue.id ? 'selected' : ''}`}
                  onClick={() => setSelectedVenue(venue)}
                >
                  <div className="venue-header">
                    <div className="venue-title">
                      <h3 className="venue-name">{venue.name}</h3>
                      <span className={`status-chip ${active ? 'active' : 'inactive'}`}>
                        {active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="venue-actions">
                      <button 
                        className="action-btn edit"
                        title="Edit venue"
                        aria-label="Edit venue"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const res = await api.get(`/venues/${venue.id}`);
                            setEditVenue(res.data.data || venue);
                          } catch (error) {
                            console.error("Failed to fetch venue details:", error);
                            setEditVenue(venue);
                          }
                        }}
                      >
                        <FiEdit2 />
                      </button>
                      {active ? (
                        <button 
                          className="action-btn delete"
                          title="Deactivate venue"
                          aria-label="Deactivate venue"
                          onClick={(e) => handleDeleteVenue(venue, e)}
                        >
                          <FiX />
                        </button>
                      ) : (
                        <>
                          <button 
                            className="action-btn activate"
                            title="Activate venue"
                            aria-label="Activate venue"
                            onClick={(e) => handleActivateVenue(venue, e)}
                          >
                            <FiCheck />
                          </button>
                          <button 
                            className="action-btn delete"
                            title="Delete venue permanently"
                            aria-label="Delete venue permanently"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Are you sure you want to permanently delete "${venue.name}"?`)) {
                                deleteMutation.mutate(venue.id);
                              }
                            }}
                          >
                            <FiTrash2 />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Mini map below venue header */}
                  <div className="venue-mini-map">
                    <iframe
                      title={`mini-map-${venue.id}`}
                      src={`https://www.google.com/maps?q=${encodeURIComponent(formatAddress(venue))}&output=embed`}
                      loading="lazy"
                    />
                  </div>
                  
                  <div className="venue-info">
                    <p className="venue-address">
                      <FiMapPin className="icon" /> {formatAddress(venue)}
                    </p>
                    
                    {/* Facility Icons Row */}
                    <div className="facility-icons">
                      {(() => {
                        const keyFeatures = [
                          { key: 'wifi', icon: <FiWifi />, label: 'Wi-Fi' },
                          { key: 'projector', icon: <FiMonitor />, label: 'Projector' },
                          { key: 'sound_system', icon: <FiSpeaker />, label: 'Sound System' },
                          { key: 'kitchen', icon: <FiCoffee />, label: 'Kitchen' },
                          { key: 'onsite_parking', icon: <FiMapPin />, label: 'Onsite Parking', alt: 'parking' },
                          { key: 'wheelchair_access', icon: <FaWheelchair />, label: 'Wheelchair Access' },
                          { key: 'accessible_restroom', icon: <FiHome />, label: 'Accessible Restroom' }
                        ];
                        
                        return keyFeatures.map(({ key, icon, label, alt }) => {
                          // Check both primary key and alternative key if provided
                          const isEnabled = features[key] || (alt && features[alt]);
                          return (
                            <div 
                              key={key} 
                              className={`facility-icon ${isEnabled ? 'true' : 'false'}`} 
                              title={label}
                            >
                              {icon}
                            </div>
                          );
                        });
                      })()}
                      
                      {/* Capacity chip */}
                      <span className="capacity-chip" title="Capacity">
                        Cap {venue.capacity ?? '—'}
                      </span>
                      
                      {/* Risk assessment indicator */}
                      {(() => {
                        const hasRiskAssessment = features.risk_assessment || 
                                                features.risk_assessed || 
                                                features.risk_assessment_completed;
                        
                        if (hasRiskAssessment === true) {
                          return (
                            <span className="risk-chip ok" title="Risk assessment on file">✔</span>
                          );
                        } else if (hasRiskAssessment === false) {
                          return (
                            <span className="risk-chip bad" title="Risk assessment missing">✖</span>
                          );
                        }
                        return null;
                      })()}
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
              <div className="modal-actions">
                <button 
                  className="action-btn edit"
                  title="Edit venue"
                  aria-label="Edit venue"
                  onClick={async () => {
                    try {
                      const res = await api.get(`/venues/${selectedVenue.id}`);
                      setEditVenue(res.data.data || selectedVenue);
                    } catch (error) {
                      console.error("Failed to fetch venue details:", error);
                      setEditVenue(selectedVenue);
                    }
                  }}
                >
                  <FiEdit2 />
                </button>
                <button className="modal-close" onClick={() => setSelectedVenue(null)}>
                  <FiX />
                </button>
              </div>
            </div>

            {/* Status Chip */}
            <div className="status-section">
              <span className={`status-chip ${isVenueActive(selectedVenue) ? 'active' : 'inactive'}`}>
                {isVenueActive(selectedVenue) ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Address & Contact */}
            <div className="detail-section glass-card">
              <h4>Address & Contact</h4>
              <p>
                <FiMapPin /> {formatAddress(selectedVenue)}
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
                    formatAddress(selectedVenue)
                  )}&output=embed`}
                  loading="lazy"
                ></iframe>
              </div>
            </div>

            {/* Facilities & Accessibility */}
            <div className="detail-section glass-card">
              <h4>Facilities & Accessibility</h4>
              
              {/* Features badges from normalized features */}
              {(() => {
                const features = getFeatureFlags(selectedVenue);
                const keyFeatures = [
                  'wifi', 'projector', 'sound_system', 'kitchen', 'wheelchair_access',
                  'accessible_restroom', 'hearing_loop', 'vision_aids', 'ramps', 'elevator',
                  'onsite_parking', 'accessible_parking', 'whiteboard', 'stage'
                ];
                
                const featureBadges = keyFeatures
                  .filter(key => features[key])
                  .map(key => (
                    <span key={key} className="badge badge-blue">
                      {getFacilityIcon(key)} {formatLabel(key)}
                    </span>
                  ));
                
                if (featureBadges.length > 0) {
                  return <div className="badge-list feature-badges">{featureBadges}</div>;
                }
                return null;
              })()}
              
              {/* Legacy badges display */}
              <div className="badge-list">
                {selectedVenue.facilities?.map((f, i) => (
                  <span key={i} className="badge badge-blue">
                    {getFacilityIcon(f)} {f.replace(/_/g, ' ')}
                  </span>
                ))}
                {selectedVenue.accessibility_features?.split(',').map((a, i) => (
                  <span key={i} className="badge badge-green">
                    {getAccessibilityIcon(a.trim())} {a.trim().replace(/_/g, ' ')}
                  </span>
                ))}
                {(!selectedVenue.facilities || selectedVenue.facilities.length === 0) &&
                  (!selectedVenue.accessibility_features ||
                    selectedVenue.accessibility_features.length === 0) &&
                  !Object.values(getFeatureFlags(selectedVenue)).some(v => v) && (
                  <p className="text-muted">No facilities or accessibility features listed.</p>
                )}
              </div>
            </div>

            {/* Capacity */}
            <div className="detail-section glass-card">
              <h4>Capacity</h4>
              <p>
                Maximum Capacity: <strong>{selectedVenue.capacity || 'Not specified'}</strong>
              </p>
            </div>

            {/* Pricing */}
            {(selectedVenue.hourly_rate || selectedVenue.daily_rate) && (
              <div className="detail-section glass-card">
                <h4>Pricing</h4>
                {selectedVenue.hourly_rate && (
                  <p>
                    Hourly Rate: <strong>{formatCurrency(selectedVenue.hourly_rate)}</strong>
                  </p>
                )}
                {selectedVenue.daily_rate && (
                  <p>
                    Daily Rate: <strong>{formatCurrency(selectedVenue.daily_rate)}</strong>
                  </p>
                )}
              </div>
            )}

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

      {/* Add Venue Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content venue-form-modal glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Venue</h3>
            </div>
            <VenueForm
              value={newVenue}
              onChange={setNewVenue}
              onSubmit={() => createMutation.mutate(newVenue)}
              submitLabel="Create Venue"
              saving={createMutation.isLoading}
              onCancel={() => setShowAddModal(false)}
            />
          </div>
        </div>
      )}

      {/* Edit Venue Modal */}
      {editVenue && (
        <div className="modal-overlay" onClick={() => setEditVenue(null)}>
          <div className="modal-content venue-form-modal glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Venue</h3>
            </div>
            <VenueForm
              value={editVenue}
              onChange={setEditVenue}
              onSubmit={() => updateMutation.mutate({ id: editVenue.id, data: editVenue })}
              submitLabel="Update Venue"
              saving={updateMutation.isLoading}
              onCancel={() => setEditVenue(null)}
            />
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
