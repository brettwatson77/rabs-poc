import React, { useState, useEffect } from 'react';
import { getVenues, createVenue, updateVenue, deleteVenue } from '../api/api';
import '../styles/CrudPage.css';
import '../styles/Venues.css';

const Venues = () => {
    const [venues, setVenues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [formData, setFormData] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterAccessibility, setFilterAccessibility] = useState('all');
    const [filterSuburb, setFilterSuburb] = useState('all');
    const [sortBy, setSortBy] = useState('name');

    const initialFormState = {
        id: null,
        name: '',
        address: '',
        suburb: '',
        postcode: '',
        venue_type: 'community', // main, community, partner
        capacity: 20,
        booking_lead_time: 48, // hours
        notes: '',
        amenities: {
            kitchen: false,
            parking: false,
            wifi: false,
            outdoor_space: false,
            air_conditioning: false,
            projector: false,
            bathroom: false
        },
        accessibility: {
            wheelchair_access: false,
            accessible_bathroom: false,
            hearing_loop: false,
            low_sensory_area: false,
            elevator: false
        },
        status: 'active' // active, inactive, under_maintenance
    };

    useEffect(() => {
        fetchVenues();
    }, []);

    const fetchVenues = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getVenues();
            setVenues(data);
        } catch (err) {
            setError('Failed to fetch venues. Please ensure the backend is running.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddClick = () => {
        setFormData(initialFormState);
        setEditMode(false);
        setIsFormVisible(true);
    };

    const handleEditClick = (venue) => {
        // Handle both cases: when data is already an object or when it's a JSON string
        const parseJsonField = (field) => {
            if (!field) return {};
            if (typeof field === 'object') return field;
            try {
                return JSON.parse(field);
            } catch (e) {
                console.error('Error parsing JSON field:', e);
                return {};
            }
        };
        
        const amenities = parseJsonField(venue.amenities);
        const accessibility = parseJsonField(venue.accessibility);
        
        setFormData({ 
            ...venue, 
            venue_type: venue.venue_type || (venue.is_main_centre ? 'main' : 'community'),
            capacity: venue.capacity || 20,
            booking_lead_time: venue.booking_lead_time || 48,
            status: venue.status || 'active',
            amenities,
            accessibility
        });
        setEditMode(true);
        setIsFormVisible(true);
    };

    const handleDeleteClick = async (id) => {
        if (window.confirm('Are you sure you want to delete this venue?')) {
            try {
                await deleteVenue(id);
                fetchVenues();
            } catch (err) {
                setError('Failed to delete venue.');
                console.error(err);
            }
        }
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        if (name.startsWith('amenities.')) {
            const amenityKey = name.split('.')[1];
            setFormData(prev => ({
                ...prev,
                amenities: {
                    ...prev.amenities,
                    [amenityKey]: checked
                }
            }));
        } else if (name.startsWith('accessibility.')) {
            const accessibilityKey = name.split('.')[1];
            setFormData(prev => ({
                ...prev,
                accessibility: {
                    ...prev.accessibility,
                    [accessibilityKey]: checked
                }
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            // Prepare data for API
            const dataPayload = { 
                ...formData,
                is_main_centre: formData.venue_type === 'main' ? 1 : 0,
                amenities: JSON.stringify(formData.amenities),
                accessibility: JSON.stringify(formData.accessibility)
            };
            
            if (editMode) {
                await updateVenue(formData.id, dataPayload);
            } else {
                await createVenue(dataPayload);
            }
            fetchVenues();
            setIsFormVisible(false);
            setFormData(null);
        } catch (err) {
            setError('Failed to save venue. Please check the form data.');
            console.error(err);
        }
    };

    const handleCancelClick = () => {
        setIsFormVisible(false);
        setFormData(null);
        setError(null);
    };

    /* ----------------------------------------------------------
     * UI Helper Utilities
     * -------------------------------------------------------- */
    const getVenueTypeDisplay = (type) => {
        switch(type) {
            case 'main': return 'Main Centre';
            case 'partner': return 'Partner Location';
            default: return 'Community Venue';
        }
    };

    const getVenueTypeColor = (type) => {
        switch(type) {
            case 'main': return '#4caf50'; // Green
            case 'partner': return '#ff9800'; // Orange
            default: return '#2196f3'; // Blue
        }
    };

    const getStatusColor = (status) => {
        switch(status) {
            case 'active': return '#4caf50'; // Green
            case 'inactive': return '#9e9e9e'; // Grey
            case 'under_maintenance': return '#ff9800'; // Orange
            default: return '#9e9e9e';
        }
    };

    const getStatusDisplay = (status) => {
        switch(status) {
            case 'active': return 'Active';
            case 'inactive': return 'Inactive';
            case 'under_maintenance': return 'Under Maintenance';
            default: return 'Unknown';
        }
    };

    const getAmenityIcon = (amenity) => {
        switch(amenity) {
            case 'kitchen': return '🍽️';
            case 'parking': return '🅿️';
            case 'wifi': return '📶';
            case 'outdoor_space': return '🌳';
            case 'air_conditioning': return '❄️';
            case 'projector': return '📽️';
            case 'bathroom': return '🚻';
            default: return '✓';
        }
    };

    const getAccessibilityIcon = (feature) => {
        switch(feature) {
            case 'wheelchair_access': return '♿';
            case 'accessible_bathroom': return '🚽';
            case 'hearing_loop': return '👂';
            case 'low_sensory_area': return '🧠';
            case 'elevator': return '🔼';
            default: return '✓';
        }
    };

    // Get unique suburbs for filter dropdown
    const uniqueSuburbs = [...new Set(venues.map(v => v.suburb))].sort();

    /* ----------------------------------------------------------
     * Filter + sort venues
     * -------------------------------------------------------- */
    const filteredVenues = venues.filter(v => {
        // Search filter
        if (search.trim() !== '') {
            const term = search.toLowerCase();
            if (!v.name.toLowerCase().includes(term) && 
                !v.address.toLowerCase().includes(term) && 
                !v.suburb.toLowerCase().includes(term) &&
                !v.postcode.includes(term)) {
                return false;
            }
        }
        
        // Type filter
        if (filterType !== 'all') {
            const venueType = v.venue_type || (v.is_main_centre ? 'main' : 'community');
            if (venueType !== filterType) {
                return false;
            }
        }
        
        // Accessibility filter
        if (filterAccessibility !== 'all') {
            // Handle both cases: when data is already an object or when it's a JSON string
            const parseJsonField = (field) => {
                if (!field) return {};
                if (typeof field === 'object') return field;
                try {
                    return JSON.parse(field);
                } catch (e) {
                    console.error('Error parsing JSON field:', e);
                    return {};
                }
            };
            
            const accessibilityFeatures = parseJsonField(v.accessibility);
            
            if (filterAccessibility === 'wheelchair' && !accessibilityFeatures.wheelchair_access) {
                return false;
            } else if (filterAccessibility === 'full' && 
                      (!accessibilityFeatures.wheelchair_access || 
                       !accessibilityFeatures.accessible_bathroom)) {
                return false;
            }
        }
        
        // Suburb filter
        if (filterSuburb !== 'all' && v.suburb !== filterSuburb) {
            return false;
        }
        
        return true;
    }).sort((a, b) => {
        switch(sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'suburb':
                return a.suburb.localeCompare(b.suburb);
            case 'type':
                const typeA = a.venue_type || (a.is_main_centre ? 'main' : 'community');
                const typeB = b.venue_type || (b.is_main_centre ? 'main' : 'community');
                return typeA.localeCompare(typeB);
            case 'capacity':
                return (b.capacity || 0) - (a.capacity || 0);
            default:
                return 0;
        }
    });

    // Helper function to parse JSON fields safely
    const parseJsonField = (field) => {
        if (!field) return {};
        if (typeof field === 'object') return field;
        try {
            return JSON.parse(field);
        } catch (e) {
            console.error('Error parsing JSON field:', e);
            return {};
        }
    };

    return (
        <div className="crud-page-container">
            {/* ---------- Universal Header Pattern ---------------- */}
            <div className="venues-header">
                {/* Left – title & subtitle */}
                <div className="venues-title">
                    <h1>Venue Management</h1>
                    <p className="venues-subtitle">
                        Manage venues, capacity, accessibility, and facility requirements
                    </p>
                </div>

                {/* Right – search & primary action */}
                <div className="venues-actions">
                    <div className="search-container">
                        <input
                            type="text"
                            placeholder="Search by name, address, suburb..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    {!isFormVisible && (
                        <button onClick={handleAddClick} className="add-button">
                            Add New Venue
                        </button>
                    )}
                </div>
            </div>
            {error && <p className="error-message">{error}</p>}
            
            {!isFormVisible && (
                <>
                    {/* --- Control Bar -------------------------------- */}
                    <div className="venue-control-bar">
                        <div className="venue-filters">
                            <select 
                                value={filterType} 
                                onChange={(e) => setFilterType(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">All Types</option>
                                <option value="main">Main Centres</option>
                                <option value="community">Community Venues</option>
                                <option value="partner">Partner Locations</option>
                            </select>
                            
                            <select 
                                value={filterAccessibility} 
                                onChange={(e) => setFilterAccessibility(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">All Accessibility</option>
                                <option value="wheelchair">Wheelchair Access</option>
                                <option value="full">Full Accessibility</option>
                            </select>
                            
                            <select 
                                value={filterSuburb} 
                                onChange={(e) => setFilterSuburb(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">All Suburbs</option>
                                {uniqueSuburbs.map(suburb => (
                                    <option key={suburb} value={suburb}>{suburb}</option>
                                ))}
                            </select>
                            
                            <select 
                                value={sortBy} 
                                onChange={(e) => setSortBy(e.target.value)}
                                className="filter-select"
                            >
                                <option value="name">Sort by Name</option>
                                <option value="suburb">Sort by Suburb</option>
                                <option value="type">Sort by Type</option>
                                <option value="capacity">Sort by Capacity</option>
                            </select>
                        </div>
                    </div>
                    
                    {/* --- Card Grid ---------------------------------- */}
                    {loading ? (
                        <p>Loading venues...</p>
                    ) : (
                        <div className="venue-card-grid">
                            {filteredVenues.length === 0 ? (
                                <p className="no-results">No venues match your filters</p>
                            ) : (
                                filteredVenues.map(v => {
                                    const venueType = v.venue_type || (v.is_main_centre ? 'main' : 'community');
                                    const typeColor = getVenueTypeColor(venueType);
                                    const status = v.status || 'active';
                                    const statusColor = getStatusColor(status);
                                    const amenities = parseJsonField(v.amenities);
                                    const accessibility = parseJsonField(v.accessibility);
                                    
                                    return (
                                        <div className="venue-card" key={v.id}>
                                            <div className="venue-card-header">
                                                <h3>{v.name}</h3>
                                                <span 
                                                    className="venue-type-chip"
                                                    style={{ backgroundColor: typeColor }}
                                                >
                                                    {getVenueTypeDisplay(venueType)}
                                                </span>
                                            </div>
                                            
                                            <div className="venue-location">
                                                <div className="location-icon">📍</div>
                                                <div className="location-details">
                                                    <div>{v.address}</div>
                                                    <div>{v.suburb}, {v.postcode}</div>
                                                </div>
                                            </div>
                                            
                                            {/* Capacity Section */}
                                            <div className="capacity-section">
                                                <div className="capacity-header">
                                                    <span>Capacity</span>
                                                    <span className="capacity-value">
                                                        {v.capacity || 20} people
                                                    </span>
                                                </div>
                                                <div className="capacity-bar-container">
                                                    <div className="capacity-bar-bg">
                                                        <div 
                                                            className="capacity-bar-fg"
                                                            style={{ 
                                                                width: `${Math.min(((v.capacity || 20)/100)*100, 100)}%`
                                                            }}
                                                        ></div>
                                                    </div>
                                                </div>
                                                <div className="booking-lead">
                                                    <span>Booking lead time: {v.booking_lead_time || 48} hours</span>
                                                </div>
                                            </div>
                                            
                                            {/* Status Indicator */}
                                            <div className="venue-status">
                                                <span 
                                                    className="status-indicator"
                                                    style={{ backgroundColor: statusColor }}
                                                ></span>
                                                <span className="status-text">
                                                    {getStatusDisplay(status)}
                                                </span>
                                            </div>
                                            
                                            {/* Amenities Section */}
                                            <div className="amenities-section">
                                                <h4>Amenities</h4>
                                                <div className="amenities-grid">
                                                    {Object.entries(amenities).map(([key, value]) => 
                                                        value && (
                                                            <div key={key} className="amenity-tag" title={key.replace('_', ' ')}>
                                                                <span className="amenity-icon">{getAmenityIcon(key)}</span>
                                                                <span className="amenity-name">{key.replace('_', ' ')}</span>
                                                            </div>
                                                        )
                                                    )}
                                                    {!Object.values(amenities).some(v => v) && (
                                                        <span className="no-amenities">No amenities listed</span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Accessibility Section */}
                                            <div className="accessibility-section">
                                                <h4>Accessibility</h4>
                                                <div className="accessibility-grid">
                                                    {Object.entries(accessibility).map(([key, value]) => 
                                                        value && (
                                                            <div key={key} className="accessibility-tag" title={key.replace('_', ' ')}>
                                                                <span className="accessibility-icon">{getAccessibilityIcon(key)}</span>
                                                                <span className="accessibility-name">{key.replace('_', ' ')}</span>
                                                            </div>
                                                        )
                                                    )}
                                                    {!Object.values(accessibility).some(v => v) && (
                                                        <span className="no-accessibility">No accessibility features listed</span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Actions */}
                                            <div className="venue-card-actions">
                                                <button
                                                    className="edit-button"
                                                    onClick={() => handleEditClick(v)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="delete-button"
                                                    onClick={() => handleDeleteClick(v.id)}
                                                >
                                                    Delete
                                                </button>
                                                <button
                                                    className="map-button"
                                                    onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(`${v.address}, ${v.suburb} ${v.postcode}`)}`)}
                                                >
                                                    Map
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </>
            )}

            {isFormVisible && formData && (
                <div className="form-container venue-form">
                    <h2>{editMode ? 'Edit Venue' : 'Add New Venue'}</h2>
                    <form onSubmit={handleFormSubmit}>
                        <div className="form-grid">
                            <div className="form-field">
                                <label>Venue Name</label>
                                <input type="text" name="name" value={formData.name} onChange={handleFormChange} required />
                            </div>
                            <div className="form-field">
                                <label>Venue Type</label>
                                <select 
                                    name="venue_type" 
                                    value={formData.venue_type} 
                                    onChange={handleFormChange}
                                >
                                    <option value="main">Main Centre</option>
                                    <option value="community">Community Venue</option>
                                    <option value="partner">Partner Location</option>
                                </select>
                            </div>
                            <div className="form-field">
                                <label>Address</label>
                                <input type="text" name="address" value={formData.address} onChange={handleFormChange} required />
                            </div>
                            <div className="form-field">
                                <label>Suburb</label>
                                <input type="text" name="suburb" value={formData.suburb} onChange={handleFormChange} required />
                            </div>
                            <div className="form-field">
                                <label>Postcode</label>
                                <input type="text" name="postcode" value={formData.postcode} onChange={handleFormChange} required />
                            </div>
                            <div className="form-field">
                                <label>Capacity (people)</label>
                                <input type="number" name="capacity" value={formData.capacity} onChange={handleFormChange} min="1" max="500" />
                            </div>
                            <div className="form-field">
                                <label>Booking Lead Time (hours)</label>
                                <input type="number" name="booking_lead_time" value={formData.booking_lead_time} onChange={handleFormChange} min="0" max="168" />
                            </div>
                            <div className="form-field">
                                <label>Status</label>
                                <select 
                                    name="status" 
                                    value={formData.status} 
                                    onChange={handleFormChange}
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="under_maintenance">Under Maintenance</option>
                                </select>
                            </div>
                            
                            {/* Amenities Section */}
                            <div className="form-field full-width">
                                <label>Amenities</label>
                                <div className="checkbox-grid">
                                    <label className="checkbox-label">
                                        <input 
                                            type="checkbox" 
                                            name="amenities.kitchen" 
                                            checked={formData.amenities.kitchen} 
                                            onChange={handleFormChange} 
                                        />
                                        <span className="checkbox-icon">{getAmenityIcon('kitchen')}</span>
                                        Kitchen
                                    </label>
                                    <label className="checkbox-label">
                                        <input 
                                            type="checkbox" 
                                            name="amenities.parking" 
                                            checked={formData.amenities.parking} 
                                            onChange={handleFormChange} 
                                        />
                                        <span className="checkbox-icon">{getAmenityIcon('parking')}</span>
                                        Parking
                                    </label>
                                    <label className="checkbox-label">
                                        <input 
                                            type="checkbox" 
                                            name="amenities.wifi" 
                                            checked={formData.amenities.wifi} 
                                            onChange={handleFormChange} 
                                        />
                                        <span className="checkbox-icon">{getAmenityIcon('wifi')}</span>
                                        WiFi
                                    </label>
                                    <label className="checkbox-label">
                                        <input 
                                            type="checkbox" 
                                            name="amenities.outdoor_space" 
                                            checked={formData.amenities.outdoor_space} 
                                            onChange={handleFormChange} 
                                        />
                                        <span className="checkbox-icon">{getAmenityIcon('outdoor_space')}</span>
                                        Outdoor Space
                                    </label>
                                    <label className="checkbox-label">
                                        <input 
                                            type="checkbox" 
                                            name="amenities.air_conditioning" 
                                            checked={formData.amenities.air_conditioning} 
                                            onChange={handleFormChange} 
                                        />
                                        <span className="checkbox-icon">{getAmenityIcon('air_conditioning')}</span>
                                        Air Conditioning
                                    </label>
                                    <label className="checkbox-label">
                                        <input 
                                            type="checkbox" 
                                            name="amenities.projector" 
                                            checked={formData.amenities.projector} 
                                            onChange={handleFormChange} 
                                        />
                                        <span className="checkbox-icon">{getAmenityIcon('projector')}</span>
                                        Projector
                                    </label>
                                    <label className="checkbox-label">
                                        <input 
                                            type="checkbox" 
                                            name="amenities.bathroom" 
                                            checked={formData.amenities.bathroom} 
                                            onChange={handleFormChange} 
                                        />
                                        <span className="checkbox-icon">{getAmenityIcon('bathroom')}</span>
                                        Bathroom
                                    </label>
                                </div>
                            </div>
                            
                            {/* Accessibility Section */}
                            <div className="form-field full-width">
                                <label>Accessibility Features</label>
                                <div className="checkbox-grid">
                                    <label className="checkbox-label">
                                        <input 
                                            type="checkbox" 
                                            name="accessibility.wheelchair_access" 
                                            checked={formData.accessibility.wheelchair_access} 
                                            onChange={handleFormChange} 
                                        />
                                        <span className="checkbox-icon">{getAccessibilityIcon('wheelchair_access')}</span>
                                        Wheelchair Access
                                    </label>
                                    <label className="checkbox-label">
                                        <input 
                                            type="checkbox" 
                                            name="accessibility.accessible_bathroom" 
                                            checked={formData.accessibility.accessible_bathroom} 
                                            onChange={handleFormChange} 
                                        />
                                        <span className="checkbox-icon">{getAccessibilityIcon('accessible_bathroom')}</span>
                                        Accessible Bathroom
                                    </label>
                                    <label className="checkbox-label">
                                        <input 
                                            type="checkbox" 
                                            name="accessibility.hearing_loop" 
                                            checked={formData.accessibility.hearing_loop} 
                                            onChange={handleFormChange} 
                                        />
                                        <span className="checkbox-icon">{getAccessibilityIcon('hearing_loop')}</span>
                                        Hearing Loop
                                    </label>
                                    <label className="checkbox-label">
                                        <input 
                                            type="checkbox" 
                                            name="accessibility.low_sensory_area" 
                                            checked={formData.accessibility.low_sensory_area} 
                                            onChange={handleFormChange} 
                                        />
                                        <span className="checkbox-icon">{getAccessibilityIcon('low_sensory_area')}</span>
                                        Low Sensory Area
                                    </label>
                                    <label className="checkbox-label">
                                        <input 
                                            type="checkbox" 
                                            name="accessibility.elevator" 
                                            checked={formData.accessibility.elevator} 
                                            onChange={handleFormChange} 
                                        />
                                        <span className="checkbox-icon">{getAccessibilityIcon('elevator')}</span>
                                        Elevator
                                    </label>
                                </div>
                            </div>
                            
                            <div className="form-field full-width">
                                <label>Notes</label>
                                <textarea name="notes" value={formData.notes || ''} onChange={handleFormChange}></textarea>
                            </div>
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="save-button">Save Venue</button>
                            <button type="button" onClick={handleCancelClick} className="cancel-button">Cancel</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Venues;
