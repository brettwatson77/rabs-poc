import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { format, addDays } from 'date-fns';
import { 
  FiTruck, 
  FiSearch, 
  FiFilter, 
  FiPlus, 
  FiEdit2, 
  FiTrash2,
  FiCalendar,
  FiDollarSign,
  FiFileText,
  FiAlertCircle,
  FiCheckCircle,
  FiX,
  FiArrowLeft,
  FiArrowRight,
  FiRefreshCw,
  FiClock,
  FiUser,
  FiUsers,
  FiTool,
  FiActivity,
  FiShield,
  FiDroplet,
  FiHash
} from 'react-icons/fi';

// API base URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3009';

// Page-specific styles
import '../styles/Vehicles.css';

// Vehicles Page Component
const Vehicles = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('directory');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    fuelType: 'all',
    availability: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [, setIsCreateModalOpen] = useState(false);
  const [, setIsEditModalOpen] = useState(false);
  const [, setIsDeleteModalOpen] = useState(false);
  const [, setIsMaintenanceModalOpen] = useState(false);
  const [, setIsBookingModalOpen] = useState(false);
  const [selectedVehicleTab, setSelectedVehicleTab] = useState('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  });
  const vehiclesPerPage = 24;

  // Form state for creating/editing vehicle
  const [vehicleForm, setVehicleForm] = useState({
    registration: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    fuel_type: 'petrol',
    capacity: 5,
    odometer: 0,
    status: 'active',
    purchase_date: '',
    purchase_price: 0,
    vin: '',
    color: '',
    features: [],
    notes: '',
    insurance: {
      provider: '',
      policy_number: '',
      expiry_date: '',
      cost: 0
    },
    registration_expiry: '',
    service_interval_km: 10000,
    service_interval_months: 6,
    next_service_date: '',
    next_service_odometer: 0
  });

  // Form state for adding a new maintenance record
  const [maintenanceForm, setMaintenanceForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'service',
    description: '',
    odometer: 0,
    cost: 0,
    performed_by: '',
    parts_replaced: '',
    notes: ''
  });

  // Fetch vehicles data
  const { 
    data: vehiclesData, 
    isLoading: vehiclesLoading, 
    error: vehiclesError,
    refetch: refetchVehicles
  } = useQuery(
    ['vehicles'],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/vehicles`);
      return response.data;
    }
  );

  // Fetch staff data for driver selection
  const { 
    data: staffData
  } = useQuery(
    ['staff'],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/staff`);
      return response.data;
    }
  );

  // Fetch bookings data
  const { 
    data: bookingsData, 
    isLoading: bookingsLoading
  } = useQuery(
    ['vehicleBookings', currentWeekStart],
    async () => {
      const endDate = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
      const response = await axios.get(`${API_URL}/api/v1/vehicles/bookings`, {
        params: {
          start_date: format(currentWeekStart, 'yyyy-MM-dd'),
          end_date: endDate
        }
      });
      return response.data;
    }
  );

  // Update odometer mutation
  const updateOdometerMutation = useMutation(
    async ({ vehicleId, odometer }) => {
      const response = await axios.patch(`${API_URL}/api/v1/vehicles/${vehicleId}`, { odometer });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['vehicles']);
      }
    }
  );

  /* ------------------------------------------------------------------
   * Note: resetVehicleForm, resetMaintenanceForm, and resetBookingForm
   * were removed because they were unused and caused lint errors.
   * ----------------------------------------------------------------*/

  // Handle opening edit modal
  const handleEditVehicle = (vehicle) => {
    setVehicleForm({
      registration: vehicle.registration || '',
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year || new Date().getFullYear(),
      fuel_type: vehicle.fuel_type || 'petrol',
      capacity: vehicle.capacity || 5,
      odometer: vehicle.odometer || 0,
      status: vehicle.status || 'active',
      purchase_date: vehicle.purchase_date || '',
      purchase_price: vehicle.purchase_price || 0,
      vin: vehicle.vin || '',
      color: vehicle.color || '',
      features: vehicle.features || [],
      notes: vehicle.notes || '',
      insurance: vehicle.insurance || {
        provider: '',
        policy_number: '',
        expiry_date: '',
        cost: 0
      },
      registration_expiry: vehicle.registration_expiry || '',
      service_interval_km: vehicle.service_interval_km || 10000,
      service_interval_months: vehicle.service_interval_months || 6,
      next_service_date: vehicle.next_service_date || '',
      next_service_odometer: vehicle.next_service_odometer || 0
    });
    setIsEditModalOpen(true);
  };

  // Handle opening maintenance modal
  const handleAddMaintenance = (vehicle) => {
    setMaintenanceForm({
      ...maintenanceForm,
      odometer: vehicle.odometer || 0
    });
    setIsMaintenanceModalOpen(true);
  };

  // Handle opening booking modal
  const handleAddBooking = () => {
    setIsBookingModalOpen(true);
  };

  // Handle updating odometer
  const handleUpdateOdometer = (vehicleId, odometer) => {
    updateOdometerMutation.mutate({
      vehicleId,
      odometer
    });
  };

  // Filter vehicles based on search term and filters
  const filteredVehicles = vehiclesData?.data?.filter(vehicle => {
    const matchesSearch = 
      vehicle.registration?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${vehicle.make} ${vehicle.model}`.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filters.status === 'all' || vehicle.status === filters.status;
    const matchesFuelType = filters.fuelType === 'all' || vehicle.fuel_type === filters.fuelType;
    const matchesAvailability = filters.availability === 'all' || 
      (filters.availability === 'available' && isVehicleAvailable(vehicle)) ||
      (filters.availability === 'unavailable' && !isVehicleAvailable(vehicle));
    
    return matchesSearch && matchesStatus && matchesFuelType && matchesAvailability;
  }) || [];

  // Check if vehicle is available today
  const isVehicleAvailable = (vehicle) => {
    if (vehicle.status !== 'active') return false;
    
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    // Check if vehicle has bookings today
    return !bookingsData?.data?.some(booking => 
      booking.vehicle_id === vehicle.id && 
      booking.start_date === todayStr
    );
  };

  // Check if vehicle needs maintenance soon
  const needsMaintenanceSoon = (vehicle) => {
    if (!vehicle.next_service_date && !vehicle.next_service_odometer) return false;
    
    const today = new Date();
    const nextServiceDate = vehicle.next_service_date ? new Date(vehicle.next_service_date) : null;
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    // Check if service is due within 30 days or 1000 km
    return (nextServiceDate && nextServiceDate <= thirtyDaysFromNow) || 
      (vehicle.next_service_odometer && (vehicle.next_service_odometer - vehicle.odometer) <= 1000);
  };

  // Check if registration or insurance is expiring soon
  const isExpiringDocument = (dateString) => {
    if (!dateString) return false;
    
    const today = new Date();
    const expiryDate = new Date(dateString);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    return expiryDate <= thirtyDaysFromNow && expiryDate > today;
  };

  // Pagination logic
  const indexOfLastVehicle = currentPage * vehiclesPerPage;
  const indexOfFirstVehicle = indexOfLastVehicle - vehiclesPerPage;
  const currentVehicles = filteredVehicles.slice(indexOfFirstVehicle, indexOfLastVehicle);
  const totalPages = Math.ceil(filteredVehicles.length / vehiclesPerPage);

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

  // Week navigation handlers
  const handlePrevWeek = () => {
    setCurrentWeekStart(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setDate(newDate.getDate() - 7);
      return newDate;
    });
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setDate(newDate.getDate() + 7);
      return newDate;
    });
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Format currency
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
      case 'out_of_service':
        return 'badge-red';
      case 'reserved':
        return 'badge-blue';
      default:
        return 'badge-gray';
    }
  };

  // Get fuel type class for warning tape
  const getFuelTypeClass = (fuelType) => {
    switch (fuelType?.toLowerCase()) {
      case 'petrol':
        return 'warning-tape-petrol';
      case 'diesel':
        return 'warning-tape-diesel';
      case 'electric':
        return 'warning-tape-electric';
      case 'hybrid':
        return 'warning-tape-hybrid';
      default:
        return '';
    }
  };

  // Get fuel label class & text for pill displayed on warning tape
  const getFuelLabelClass = (fuelType) => {
    switch ((fuelType || '').toLowerCase()) {
      case 'petrol':
        return { cls: 'fuel-petrol', text: 'PETROL' };
      case 'diesel':
        return { cls: 'fuel-diesel', text: 'DIESEL' };
      case 'electric':
        return { cls: 'fuel-electric', text: 'ELECTRIC' };
      case 'hybrid':
        return { cls: 'fuel-hybrid', text: 'HYBRID' };
      default:
        return { cls: '', text: '' };
    }
  };

  // Format status for display
  const formatStatus = (status) => {
    if (!status) return 'Unknown';
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Get week dates array
  const getWeekDates = () => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      return date;
    });
  };

  // Get bookings for vehicle and date
  const getBookingsForVehicleAndDate = (vehicleId, date) => {
    if (!bookingsData || !bookingsData.data) return [];
    
    const dateStr = format(date, 'yyyy-MM-dd');
    return bookingsData.data.filter(booking => 
      booking.vehicle_id === vehicleId && booking.start_date === dateStr
    );
  };

  // Get driver name from ID
  const getDriverName = (driverId) => {
    if (!staffData || !staffData.data) return 'Unknown';
    
    const driver = staffData.data.find(staff => staff.id === driverId);
    return driver ? `${driver.first_name} ${driver.last_name}` : 'Unknown';
  };

  // Calculate total fleet value
  const calculateFleetValue = () => {
    if (!vehiclesData || !vehiclesData.data) return 0;
    
    return vehiclesData.data.reduce((total, vehicle) => {
      return total + (vehicle.purchase_price || 0);
    }, 0);
  };

  // Calculate maintenance costs
  const calculateMaintenanceCosts = () => {
    if (!vehiclesData || !vehiclesData.data) return 0;
    
    return vehiclesData.data.reduce((total, vehicle) => {
      const maintenanceCosts = vehicle.maintenance_records?.reduce((sum, record) => {
        return sum + (record.cost || 0);
      }, 0) || 0;
      
      return total + maintenanceCosts;
    }, 0);
  };

  // Render directory tab content
  const renderDirectoryTab = () => (
    <div className="directory-tab">
      {/* Search and Filter Bar */}
      <div className="search-filter-bar glass-panel">
        <div className="search-container">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search vehicles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-container">
          <button 
            className="filter-toggle-btn"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FiFilter />
            <span>Filters</span>
          </button>
          
          {showFilters && (
            <div className="filter-dropdown glass-panel">
              <div className="filter-group">
                <label>Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="out_of_service">Out of Service</option>
                  <option value="reserved">Reserved</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Fuel Type</label>
                <select
                  value={filters.fuelType}
                  onChange={(e) => setFilters({...filters, fuelType: e.target.value})}
                >
                  <option value="all">All Types</option>
                  <option value="petrol">Petrol</option>
                  <option value="diesel">Diesel</option>
                  <option value="electric">Electric</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Availability</label>
                <select
                  value={filters.availability}
                  onChange={(e) => setFilters({...filters, availability: e.target.value})}
                >
                  <option value="all">All</option>
                  <option value="available">Available Today</option>
                  <option value="unavailable">Unavailable Today</option>
                </select>
              </div>
            </div>
          )}
        </div>
        
        <button 
          className="create-btn glass-button"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <FiPlus />
          <span>New Vehicle</span>
        </button>
      </div>
      
      {/* Fleet Summary */}
      <div className="fleet-summary glass-panel">
        <div className="summary-item">
          <div className="summary-icon">
            <FiTruck />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {vehiclesData?.data?.length || 0}
            </div>
            <div className="summary-label">Total Vehicles</div>
          </div>
        </div>
        
        <div className="summary-item">
          <div className="summary-icon">
            <FiCheckCircle />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {vehiclesData?.data?.filter(v => v.status === 'active').length || 0}
            </div>
            <div className="summary-label">Active Vehicles</div>
          </div>
        </div>
        
        <div className="summary-item">
          <div className="summary-icon">
            <FiAlertCircle />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {vehiclesData?.data?.filter(v => v.status === 'maintenance').length || 0}
            </div>
            <div className="summary-label">In Maintenance</div>
          </div>
        </div>
        
        <div className="summary-item">
          <div className="summary-icon">
            <FiDollarSign />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {formatCurrency(calculateFleetValue())}
            </div>
            <div className="summary-label">Fleet Value</div>
          </div>
        </div>
      </div>
      
      {/* Vehicles Grid */}
      {vehiclesLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading vehicles...</p>
        </div>
      ) : vehiclesError ? (
        <div className="error-container glass-panel">
          <FiAlertCircle className="error-icon" />
          <p>Error loading vehicles: {vehiclesError.message}</p>
          <button className="btn btn-primary" onClick={() => refetchVehicles()}>
            <FiRefreshCw /> Try Again
          </button>
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="empty-state glass-panel">
          <FiTruck className="empty-icon" />
          <h3>No vehicles found</h3>
          <p>Try adjusting your search or filters, or add a new vehicle.</p>
          <button 
            className="btn btn-primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <FiPlus /> Add Vehicle
          </button>
        </div>
      ) : (
        <>
          <div className="vehicles-grid">
            {currentVehicles.map(vehicle => (
              <div 
                key={vehicle.id} 
                className={`vehicle-card glass-card ${getFuelTypeClass(vehicle.fuel_type)} ${getFuelLabelClass(vehicle.fuel_type).cls} ${selectedVehicle?.id === vehicle.id ? 'selected' : ''}`}
                onClick={() => setSelectedVehicle(vehicle)}
              >
                <div className="fuel-label">{getFuelLabelClass(vehicle.fuel_type).text}</div>
                <div className="vehicle-header">
                  <div className="vehicle-registration">
                    {vehicle.registration}
                  </div>
                  <div className="vehicle-badges">
                    <span className={`badge ${getStatusBadge(vehicle.status)}`}>
                      {formatStatus(vehicle.status)}
                    </span>
                  </div>
                </div>
                
                <div className="vehicle-info">
                  <h3 className="vehicle-name">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </h3>
                  <div className="vehicle-details">
                    <div className="detail-item">
                      <FiDroplet className="detail-icon" />
                      <span>{vehicle.fuel_type}</span>
                    </div>
                    <div className="detail-item">
                      <FiUsers className="detail-icon" />
                      <span>{vehicle.capacity} seats</span>
                    </div>
                    <div className="detail-item">
                      <FiHash className="detail-icon" />
                      <span>{vehicle.odometer?.toLocaleString() || 0} km</span>
                    </div>
                  </div>
                </div>
                
                {/* Alert indicators */}
                <div className="vehicle-alerts">
                  {needsMaintenanceSoon(vehicle) && (
                    <div className="alert-indicator maintenance" title="Maintenance due soon">
                      <FiTool />
                    </div>
                  )}
                  {isExpiringDocument(vehicle.registration_expiry) && (
                    <div className="alert-indicator registration" title="Registration expiring soon">
                      <FiFileText />
                    </div>
                  )}
                  {isExpiringDocument(vehicle.insurance?.expiry_date) && (
                    <div className="alert-indicator insurance" title="Insurance expiring soon">
                      <FiShield />
                    </div>
                  )}
                </div>
                
                <div className="vehicle-footer">
                  <div className="vehicle-status">
                    {isVehicleAvailable(vehicle) ? (
                      <span className="available-status">Available</span>
                    ) : (
                      <span className="unavailable-status">Unavailable</span>
                    )}
                  </div>
                  
                  {/* Compact meta icons bottom-right */}
                  <div className="vehicle-meta-icons">
                    <div className="meta-item" title={`Fuel: ${vehicle.fuel_type}`}>
                      <FiDroplet />
                      <span>{vehicle.fuel_type}</span>
                    </div>
                    <div className="meta-item" title={`Seats: ${vehicle.capacity}`}>
                      <FiUsers />
                      <span>{vehicle.capacity}</span>
                    </div>
                    <div className="meta-item" title={`Odometer: ${vehicle.odometer?.toLocaleString() || 0} km`}>
                      <FiHash />
                      <span>{vehicle.odometer?.toLocaleString() || 0} km</span>
                    </div>
                  </div>
                  
                  <div className="vehicle-actions">
                    <button 
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedVehicle(vehicle);
                        setIsDeleteModalOpen(true);
                      }}
                      title="Delete"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination-container">
              <button 
                className="pagination-btn"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
              >
                <FiArrowLeft />
                <span>Previous</span>
              </button>
              
              <div className="pagination-info">
                Page {currentPage} of {totalPages}
              </div>
              
              <button 
                className="pagination-btn"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                <span>Next</span>
                <FiArrowRight />
              </button>
            </div>
          )}
        </>
      )}
      
      {/* Vehicle Detail View */}
      {selectedVehicle && (
        <div className="modal-overlay" onClick={() => setSelectedVehicle(null)}>
          <div className="modal-content vehicle-detail-modal glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Vehicle Details</h3>
              <button className="modal-close" onClick={() => setSelectedVehicle(null)}>
                <FiX />
              </button>
            </div>
            
            <div className="vehicle-detail">
              <div className="detail-header">
                <div className={`vehicle-banner ${getFuelTypeClass(selectedVehicle.fuel_type)}`}>
                  <div className="vehicle-title">
                    <h2>{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</h2>
                    <div className="vehicle-registration-display">{selectedVehicle.registration}</div>
                  </div>
                  <div className="vehicle-status-badge">
                    <span className={`badge ${getStatusBadge(selectedVehicle.status)}`}>
                      {formatStatus(selectedVehicle.status)}
                    </span>
                  </div>
                </div>
                
                <div className="detail-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => handleEditVehicle(selectedVehicle)}
                  >
                    <FiEdit2 /> Edit Vehicle
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleAddMaintenance(selectedVehicle)}
                  >
                    <FiTool /> Add Maintenance
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleAddBooking()}
                  >
                    <FiCalendar /> Book Vehicle
                  </button>
                </div>
              </div>
              
              {/* Global tab bar */}
              <div className="tab-bar">
                <button 
                  className={`tab-btn ${selectedVehicleTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setSelectedVehicleTab('overview')}
                >
                  <FiTruck />
                  <span>Overview</span>
                </button>
                <button 
                  className={`tab-btn ${selectedVehicleTab === 'maintenance' ? 'active' : ''}`}
                  onClick={() => setSelectedVehicleTab('maintenance')}
                >
                  <FiTool />
                  <span>Maintenance</span>
                </button>
                <button 
                  className={`tab-btn ${selectedVehicleTab === 'bookings' ? 'active' : ''}`}
                  onClick={() => setSelectedVehicleTab('bookings')}
                >
                  <FiCalendar />
                  <span>Bookings</span>
                </button>
                <button 
                  className={`tab-btn ${selectedVehicleTab === 'costs' ? 'active' : ''}`}
                  onClick={() => setSelectedVehicleTab('costs')}
                >
                  <FiDollarSign />
                  <span>Costs</span>
                </button>
              </div>
              
              <div className="detail-content">
                {selectedVehicleTab === 'overview' && (
                  <div className="vehicle-overview">
                    <div className="detail-section glass-card">
                      <h4>Vehicle Information</h4>
                      <div className="detail-grid">
                        <div className="detail-item">
                          <div className="detail-label">Make</div>
                          <div className="detail-value">{selectedVehicle.make}</div>
                        </div>
                        <div className="detail-item">
                          <div className="detail-label">Model</div>
                          <div className="detail-value">{selectedVehicle.model}</div>
                        </div>
                        <div className="detail-item">
                          <div className="detail-label">Year</div>
                          <div className="detail-value">{selectedVehicle.year}</div>
                        </div>
                        <div className="detail-item">
                          <div className="detail-label">Registration</div>
                          <div className="detail-value">{selectedVehicle.registration}</div>
                        </div>
                        <div className="detail-item">
                          <div className="detail-label">VIN</div>
                          <div className="detail-value">{selectedVehicle.vin || 'N/A'}</div>
                        </div>
                        <div className="detail-item">
                          <div className="detail-label">Color</div>
                          <div className="detail-value">{selectedVehicle.color || 'N/A'}</div>
                        </div>
                        <div className="detail-item">
                          <div className="detail-label">Fuel Type</div>
                          <div className="detail-value">{selectedVehicle.fuel_type}</div>
                        </div>
                        <div className="detail-item">
                          <div className="detail-label">Capacity</div>
                          <div className="detail-value">{selectedVehicle.capacity} seats</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="detail-section glass-card">
                      <h4>Odometer & Service</h4>
                      <div className="odometer-section">
                        <div className="odometer-display">
                          <div className="odometer-value">
                            {selectedVehicle.odometer?.toLocaleString() || 0}
                          </div>
                          <div className="odometer-unit">kilometers</div>
                        </div>
                        <div className="odometer-update">
                          <input 
                            type="number"
                            value={vehicleForm.odometer}
                            onChange={(e) => setVehicleForm({...vehicleForm, odometer: parseInt(e.target.value) || 0})}
                            className="odometer-input"
                            min="0"
                          />
                          <button 
                            className="btn btn-primary"
                            onClick={() => handleUpdateOdometer(selectedVehicle.id, vehicleForm.odometer)}
                          >
                            Update Odometer
                          </button>
                        </div>
                      </div>
                      
                      <div className="service-info">
                        <div className="service-item">
                          <div className="service-label">Next Service Date</div>
                          <div className="service-value">
                            {formatDate(selectedVehicle.next_service_date)}
                          </div>
                        </div>
                        <div className="service-item">
                          <div className="service-label">Next Service Odometer</div>
                          <div className="service-value">
                            {selectedVehicle.next_service_odometer?.toLocaleString() || 'N/A'} km
                          </div>
                        </div>
                        <div className="service-item">
                          <div className="service-label">Service Interval</div>
                          <div className="service-value">
                            Every {selectedVehicle.service_interval_km?.toLocaleString() || 10000} km or {selectedVehicle.service_interval_months || 6} months
                          </div>
                        </div>
                      </div>
                      
                      {needsMaintenanceSoon(selectedVehicle) && (
                        <div className="maintenance-alert">
                          <FiAlertCircle className="alert-icon" />
                          <div className="alert-message">
                            <strong>Service Due Soon!</strong> Schedule maintenance for this vehicle.
                          </div>
                          <button 
                            className="btn btn-primary"
                            onClick={() => handleAddMaintenance(selectedVehicle)}
                          >
                            Schedule Service
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="detail-section glass-card">
                      <h4>Registration & Insurance</h4>
                      <div className="document-grid">
                        <div className="document-item">
                          <div className="document-header">
                            <h5>Registration</h5>
                            {isExpiringDocument(selectedVehicle.registration_expiry) ? (
                              <span className="badge badge-yellow">Expiring Soon</span>
                            ) : selectedVehicle.registration_expiry && new Date(selectedVehicle.registration_expiry) < new Date() ? (
                              <span className="badge badge-red">Expired</span>
                            ) : (
                              <span className="badge badge-green">Valid</span>
                            )}
                          </div>
                          <div className="document-details">
                            <div className="document-detail">
                              <div className="detail-label">Expiry Date</div>
                              <div className="detail-value">{formatDate(selectedVehicle.registration_expiry)}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="document-item">
                          <div className="document-header">
                            <h5>Insurance</h5>
                            {isExpiringDocument(selectedVehicle.insurance?.expiry_date) ? (
                              <span className="badge badge-yellow">Expiring Soon</span>
                            ) : selectedVehicle.insurance?.expiry_date && new Date(selectedVehicle.insurance.expiry_date) < new Date() ? (
                              <span className="badge badge-red">Expired</span>
                            ) : (
                              <span className="badge badge-green">Valid</span>
                            )}
                          </div>
                          <div className="document-details">
                            <div className="document-detail">
                              <div className="detail-label">Provider</div>
                              <div className="detail-value">{selectedVehicle.insurance?.provider || 'N/A'}</div>
                            </div>
                            <div className="document-detail">
                              <div className="detail-label">Policy Number</div>
                              <div className="detail-value">{selectedVehicle.insurance?.policy_number || 'N/A'}</div>
                            </div>
                            <div className="document-detail">
                              <div className="detail-label">Expiry Date</div>
                              <div className="detail-value">{formatDate(selectedVehicle.insurance?.expiry_date)}</div>
                            </div>
                            <div className="document-detail">
                              <div className="detail-label">Cost</div>
                              <div className="detail-value">{formatCurrency(selectedVehicle.insurance?.cost)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="detail-section glass-card">
                      <h4>Features & Notes</h4>
                      <div className="features-list">
                        {selectedVehicle.features && selectedVehicle.features.length > 0 ? (
                          selectedVehicle.features.map((feature, index) => (
                            <div key={index} className="feature-tag">
                              <FiCheckCircle className="feature-icon" />
                              <span>{feature}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-muted">No features listed</p>
                        )}
                      </div>
                      
                      <div className="notes-section">
                        <h5>Notes</h5>
                        {selectedVehicle.notes ? (
                          <p>{selectedVehicle.notes}</p>
                        ) : (
                          <p className="text-muted">No notes available for this vehicle.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedVehicleTab === 'maintenance' && (
                  <div className="vehicle-maintenance">
                    <div className="detail-section glass-card">
                      <div className="section-header">
                        <h4>Maintenance History</h4>
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAddMaintenance(selectedVehicle)}
                        >
                          <FiPlus /> Add Record
                        </button>
                      </div>
                      
                      {selectedVehicle.maintenance_records?.length > 0 ? (
                        <div className="maintenance-timeline">
                          {selectedVehicle.maintenance_records
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .map((record, index) => (
                              <div key={index} className="maintenance-record">
                                <div className="record-header">
                                  <div className="record-date">
                                    <FiCalendar className="icon" />
                                    <span>{formatDate(record.date)}</span>
                                  </div>
                                  <div className="record-type">
                                    <span className={`badge ${record.type === 'service' ? 'badge-blue' : record.type === 'repair' ? 'badge-yellow' : 'badge-green'}`}>
                                      {record.type}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="record-content">
                                  <h5>{record.description}</h5>
                                  <div className="record-details">
                                    <div className="record-detail">
                                      <div className="detail-label">Odometer</div>
                                      <div className="detail-value">{record.odometer?.toLocaleString() || 0} km</div>
                                    </div>
                                    <div className="record-detail">
                                      <div className="detail-label">Cost</div>
                                      <div className="detail-value">{formatCurrency(record.cost)}</div>
                                    </div>
                                    <div className="record-detail">
                                      <div className="detail-label">Performed By</div>
                                      <div className="detail-value">{record.performed_by || 'N/A'}</div>
                                    </div>
                                  </div>
                                  
                                  {record.parts_replaced && (
                                    <div className="parts-replaced">
                                      <div className="detail-label">Parts Replaced</div>
                                      <div className="detail-value">{record.parts_replaced}</div>
                                    </div>
                                  )}
                                  
                                  {record.notes && (
                                    <div className="record-notes">
                                      <div className="detail-label">Notes</div>
                                      <div className="detail-value">{record.notes}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-muted">No maintenance records available for this vehicle.</p>
                      )}
                    </div>
                    
                    <div className="detail-section glass-card">
                      <h4>Service Schedule</h4>
                      <div className="service-schedule">
                        <div className="schedule-item">
                          <div className="schedule-header">
                            <h5>Next Regular Service</h5>
                            {needsMaintenanceSoon(selectedVehicle) ? (
                              <span className="badge badge-yellow">Due Soon</span>
                            ) : (
                              <span className="badge badge-green">On Track</span>
                            )}
                          </div>
                          <div className="schedule-details">
                            <div className="schedule-detail">
                              <div className="detail-label">Due Date</div>
                              <div className="detail-value">{formatDate(selectedVehicle.next_service_date)}</div>
                            </div>
                            <div className="schedule-detail">
                              <div className="detail-label">Due Odometer</div>
                              <div className="detail-value">{selectedVehicle.next_service_odometer?.toLocaleString() || 'N/A'} km</div>
                            </div>
                            <div className="schedule-detail">
                              <div className="detail-label">Current Odometer</div>
                              <div className="detail-value">{selectedVehicle.odometer?.toLocaleString() || 0} km</div>
                            </div>
                            <div className="schedule-detail">
                              <div className="detail-label">Remaining</div>
                              <div className="detail-value">
                                {selectedVehicle.next_service_odometer && selectedVehicle.odometer
                                  ? `${(selectedVehicle.next_service_odometer - selectedVehicle.odometer).toLocaleString()} km`
                                  : 'N/A'}
                              </div>
                            </div>
                          </div>
                          
                          <button 
                            className="btn btn-primary"
                            onClick={() => handleAddMaintenance(selectedVehicle)}
                          >
                            Schedule Service
                          </button>
                        </div>
                        
                        <div className="maintenance-recommendations">
                          <h5>Recommended Maintenance</h5>
                          <div className="recommendation-list">
                            <div className="recommendation-item">
                              <div className="recommendation-header">
                                <span>Oil Change</span>
                                <span className="badge badge-blue">Every 10,000 km</span>
                              </div>
                              <div className="recommendation-progress">
                                <div className="progress-bar" style={{ 
                                  width: `${Math.min(100, 100 - ((selectedVehicle.odometer % 10000) / 100))}%` 
                                }}></div>
                              </div>
                              <div className="recommendation-status">
                                {10000 - (selectedVehicle.odometer % 10000)} km remaining
                              </div>
                            </div>
                            
                            <div className="recommendation-item">
                              <div className="recommendation-header">
                                <span>Tire Rotation</span>
                                <span className="badge badge-blue">Every 15,000 km</span>
                              </div>
                              <div className="recommendation-progress">
                                <div className="progress-bar" style={{ 
                                  width: `${Math.min(100, 100 - ((selectedVehicle.odometer % 15000) / 150))}%` 
                                }}></div>
                              </div>
                              <div className="recommendation-status">
                                {15000 - (selectedVehicle.odometer % 15000)} km remaining
                              </div>
                            </div>
                            
                            <div className="recommendation-item">
                              <div className="recommendation-header">
                                <span>Brake Inspection</span>
                                <span className="badge badge-blue">Every 20,000 km</span>
                              </div>
                              <div className="recommendation-progress">
                                <div className="progress-bar" style={{ 
                                  width: `${Math.min(100, 100 - ((selectedVehicle.odometer % 20000) / 200))}%` 
                                }}></div>
                              </div>
                              <div className="recommendation-status">
                                {20000 - (selectedVehicle.odometer % 20000)} km remaining
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedVehicleTab === 'bookings' && (
                  <div className="vehicle-bookings">
                    <div className="detail-section glass-card">
                      <div className="section-header">
                        <h4>Upcoming Bookings</h4>
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAddBooking()}
                        >
                          <FiPlus /> Add Booking
                        </button>
                      </div>
                      
                      <div className="week-navigation">
                        <button className="btn btn-sm" onClick={handlePrevWeek}>
                          <FiArrowLeft /> Previous Week
                        </button>
                        <span className="week-label">
                          {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
                        </span>
                        <button className="btn btn-sm" onClick={handleNextWeek}>
                          Next Week <FiArrowRight />
                        </button>
                      </div>
                      
                      {bookingsLoading ? (
                        <div className="loading-container">
                          <div className="loading-spinner-small"></div>
                          <p>Loading bookings...</p>
                        </div>
                      ) : (
                        <div className="weekly-calendar">
                          {getWeekDates().map((date, index) => {
                            const bookings = getBookingsForVehicleAndDate(selectedVehicle.id, date);
                            const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                            
                            return (
                              <div key={index} className={`calendar-day ${isToday ? 'today' : ''}`}>
                                <div className="day-header">
                                  <span className="day-name">{format(date, 'EEE')}</span>
                                  <span className="day-date">{format(date, 'd MMM')}</span>
                                </div>
                                
                                <div className="day-bookings">
                                  {bookings.length > 0 ? (
                                    bookings.map((booking, bookingIndex) => (
                                      <div key={bookingIndex} className="booking-item">
                                        <div className="booking-time">
                                          {booking.start_time} - {booking.end_time}
                                        </div>
                                        <div className="booking-details">
                                          <div className="booking-driver">
                                            <FiUser className="icon" />
                                            <span>{getDriverName(booking.driver_id)}</span>
                                          </div>
                                          <div className="booking-purpose">
                                            <span>{booking.purpose || 'No purpose specified'}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="no-bookings">
                                      <span>Available</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    
                    <div className="detail-section glass-card">
                      <h4>All Bookings</h4>
                      <div className="bookings-list">
                        {bookingsData?.data?.filter(booking => booking.vehicle_id === selectedVehicle.id)
                          .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
                          .map((booking, index) => (
                            <div key={index} className="booking-list-item">
                              <div className="booking-date">
                                <FiCalendar className="icon" />
                                <span>{formatDate(booking.start_date)}</span>
                                {booking.start_date !== booking.end_date && (
                                  <span className="date-range">
                                    - {formatDate(booking.end_date)}
                                  </span>
                                )}
                              </div>
                              <div className="booking-time">
                                <FiClock className="icon" />
                                <span>{booking.start_time} - {booking.end_time}</span>
                              </div>
                              <div className="booking-driver">
                                <FiUser className="icon" />
                                <span>{getDriverName(booking.driver_id)}</span>
                              </div>
                              <div className="booking-purpose">
                                {booking.purpose}
                              </div>
                              {booking.notes && (
                                <div className="booking-notes">
                                  <FiFileText className="icon" />
                                  <span>{booking.notes}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        
                        {!bookingsData?.data?.some(booking => booking.vehicle_id === selectedVehicle.id) && (
                          <p className="text-muted">No bookings found for this vehicle.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedVehicleTab === 'costs' && (
                  <div className="vehicle-costs">
                    <div className="detail-section glass-card">
                      <h4>Cost Summary</h4>
                      <div className="cost-summary">
                        <div className="cost-item">
                          <div className="cost-label">Purchase Price</div>
                          <div className="cost-value">{formatCurrency(selectedVehicle.purchase_price)}</div>
                        </div>
                        <div className="cost-item">
                          <div className="cost-label">Maintenance Total</div>
                          <div className="cost-value">
                            {formatCurrency(selectedVehicle.maintenance_records?.reduce((total, record) => total + (record.cost || 0), 0) || 0)}
                          </div>
                        </div>
                        <div className="cost-item">
                          <div className="cost-label">Insurance (Annual)</div>
                          <div className="cost-value">{formatCurrency(selectedVehicle.insurance?.cost)}</div>
                        </div>
                        <div className="cost-item total">
                          <div className="cost-label">Total Cost of Ownership</div>
                          <div className="cost-value">
                            {formatCurrency(
                              (selectedVehicle.purchase_price || 0) +
                              (selectedVehicle.maintenance_records?.reduce((total, record) => total + (record.cost || 0), 0) || 0) +
                              (selectedVehicle.insurance?.cost || 0)
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="detail-section glass-card">
                      <h4>Cost Per Kilometer</h4>
                      <div className="cost-per-km">
                        <div className="cost-calculation">
                          <div className="calculation-formula">
                            <span className="formula-label">Total Costs</span>
                            <span className="formula-divider">/</span>
                            <span className="formula-label">Total Kilometers</span>
                            <span className="formula-equals">=</span>
                            <span className="formula-label">Cost per KM</span>
                          </div>
                          <div className="calculation-values">
                            <span className="formula-value">
                              {formatCurrency(
                                (selectedVehicle.purchase_price || 0) +
                                (selectedVehicle.maintenance_records?.reduce((total, record) => total + (record.cost || 0), 0) || 0) +
                                (selectedVehicle.insurance?.cost || 0)
                              )}
                            </span>
                            <span className="formula-divider">/</span>
                            <span className="formula-value">
                              {selectedVehicle.odometer?.toLocaleString() || 0} km
                            </span>
                            <span className="formula-equals">=</span>
                            <span className="formula-value highlight">
                              {selectedVehicle.odometer && selectedVehicle.odometer > 0
                                ? formatCurrency(
                                    ((selectedVehicle.purchase_price || 0) +
                                    (selectedVehicle.maintenance_records?.reduce((total, record) => total + (record.cost || 0), 0) || 0) +
                                    (selectedVehicle.insurance?.cost || 0)) / selectedVehicle.odometer
                                  )
                                : '$0.00'
                              } / km
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="detail-section glass-card">
                      <h4>Maintenance Cost Breakdown</h4>
                      {selectedVehicle.maintenance_records?.length > 0 ? (
                        <div className="maintenance-costs">
                          <div className="cost-table-container">
                            <table className="cost-table">
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Type</th>
                                  <th>Description</th>
                                  <th>Cost</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedVehicle.maintenance_records
                                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                                  .map((record, index) => (
                                    <tr key={index}>
                                      <td>{formatDate(record.date)}</td>
                                      <td>
                                        <span className={`badge ${record.type === 'service' ? 'badge-blue' : record.type === 'repair' ? 'badge-yellow' : 'badge-green'}`}>
                                          {record.type}
                                        </span>
                                      </td>
                                      <td>{record.description}</td>
                                      <td className="cost-column">{formatCurrency(record.cost)}</td>
                                    </tr>
                                  ))}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <td colSpan="3" className="total-label">Total Maintenance Costs</td>
                                  <td className="total-value">
                                    {formatCurrency(selectedVehicle.maintenance_records.reduce((total, record) => total + (record.cost || 0), 0))}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted">No maintenance records available for cost analysis.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ------------------------------------------------------------------
             * Modal footer actions (Close / Edit / Delete)
             * ----------------------------------------------------------------*/}
            <div className="modal-footer-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedVehicle(null)}
              >
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleEditVehicle(selectedVehicle)}
              >
                <FiEdit2 /> Edit
              </button>
              <button
                className="btn btn-danger"
                onClick={() => setIsDeleteModalOpen(true)}
              >
                <FiTrash2 /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render maintenance tab content
  const renderMaintenanceTab = () => (
    <div className="maintenance-tab">
      <div className="maintenance-header glass-panel">
        <h3>Fleet Maintenance</h3>
        <p>Track and manage vehicle maintenance, services, and repairs.</p>
        
        <div className="search-container">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search maintenance records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>
      
      <div className="maintenance-summary glass-card">
        <div className="summary-item">
          <div className="summary-icon">
            <FiTool />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {vehiclesData?.data?.reduce((count, vehicle) => {
                return count + (vehicle.maintenance_records?.length || 0);
              }, 0) || 0}
            </div>
            <div className="summary-label">Total Records</div>
          </div>
        </div>
        
        <div className="summary-item">
          <div className="summary-icon">
            <FiAlertCircle />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {vehiclesData?.data?.filter(vehicle => needsMaintenanceSoon(vehicle)).length || 0}
            </div>
            <div className="summary-label">Due Soon</div>
          </div>
        </div>
        
        <div className="summary-item">
          <div className="summary-icon">
            <FiDollarSign />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {formatCurrency(calculateMaintenanceCosts())}
            </div>
            <div className="summary-label">Total Costs</div>
          </div>
        </div>
        
        <div className="summary-item">
          <div className="summary-icon">
            <FiActivity />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {vehiclesData?.data?.reduce((count, vehicle) => {
                const thisYearRecords = vehicle.maintenance_records?.filter(record => {
                  if (!record.date) return false;
                  const recordYear = new Date(record.date).getFullYear();
                  const currentYear = new Date().getFullYear();
                  return recordYear === currentYear;
                }) || [];
                return count + thisYearRecords.length;
              }, 0) || 0}
            </div>
            <div className="summary-label">Records This Year</div>
          </div>
        </div>
      </div>
      
      <div className="upcoming-maintenance glass-card">
        <h4>Upcoming Maintenance</h4>
        
        {vehiclesLoading ? (
          <div className="loading-container">
            <div className="loading-spinner-small"></div>
            <p>Loading maintenance data...</p>
          </div>
        ) : (
          <div className="maintenance-schedule-table">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Registration</th>
                  <th>Service Type</th>
                  <th>Due Date</th>
                  <th>Due Odometer</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehiclesData?.data
                  ?.filter(vehicle => needsMaintenanceSoon(vehicle))
                  .sort((a, b) => {
                    const dateA = a.next_service_date ? new Date(a.next_service_date) : new Date(9999, 0, 1);
                    const dateB = b.next_service_date ? new Date(b.next_service_date) : new Date(9999, 0, 1);
                    return dateA - dateB;
                  })
                  .map(vehicle => (
                    <tr key={vehicle.id}>
                      <td>
                        <div className="vehicle-name-cell">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </div>
                      </td>
                      <td>{vehicle.registration}</td>
                      <td>Regular Service</td>
                      <td>{formatDate(vehicle.next_service_date)}</td>
                      <td>{vehicle.next_service_odometer?.toLocaleString() || 'N/A'} km</td>
                      <td>
                        {vehicle.next_service_date && new Date(vehicle.next_service_date) < new Date() ? (
                          <span className="badge badge-red">Overdue</span>
                        ) : (
                          <span className="badge badge-yellow">Due Soon</span>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="btn btn-sm"
                            onClick={() => {
                              setSelectedVehicle(vehicle);
                              handleAddMaintenance(vehicle);
                            }}
                          >
                            <FiTool /> Service
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                
                {vehiclesData?.data?.filter(vehicle => needsMaintenanceSoon(vehicle)).length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center">
                      <div className="empty-state-small">
                        <FiCheckCircle className="success-icon" />
                        <p>No upcoming maintenance needed.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <div className="maintenance-history glass-card">
        <h4>Maintenance History</h4>
        
        {vehiclesLoading ? (
          <div className="loading-container">
            <div className="loading-spinner-small"></div>
            <p>Loading maintenance history...</p>
          </div>
        ) : (
          <div className="maintenance-history-table">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Vehicle</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Odometer</th>
                  <th>Cost</th>
                  <th>Performed By</th>
                </tr>
              </thead>
              <tbody>
                {vehiclesData?.data?.flatMap(vehicle => 
                  (vehicle.maintenance_records || []).map(record => ({
                    vehicle,
                    record
                  }))
                )
                .filter(item => 
                  item.record.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  item.vehicle.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  item.vehicle.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  item.vehicle.registration?.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .sort((a, b) => new Date(b.record.date) - new Date(a.record.date))
                .slice(0, 20)
                .map((item, index) => (
                  <tr key={index}>
                    <td>{formatDate(item.record.date)}</td>
                    <td>
                      <div className="vehicle-name-cell">
                        <span className="vehicle-model">{item.vehicle.year} {item.vehicle.make} {item.vehicle.model}</span>
                        <span className="vehicle-registration">{item.vehicle.registration}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${item.record.type === 'service' ? 'badge-blue' : item.record.type === 'repair' ? 'badge-yellow' : 'badge-green'}`}>
                        {item.record.type}
                      </span>
                    </td>
                    <td>{item.record.description}</td>
                    <td>{item.record.odometer?.toLocaleString() || 0} km</td>
                    <td>{formatCurrency(item.record.cost)}</td>
                    <td>{item.record.performed_by || 'N/A'}</td>
                  </tr>
                ))}
                
                {vehiclesData?.data?.flatMap(vehicle => vehicle.maintenance_records || []).length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center">
                      <div className="empty-state-small">
                        <FiFileText className="empty-icon" />
                        <p>No maintenance records found.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <div className="document-expiry glass-card">
        <h4>Document Expiry Tracking</h4>
        
        {vehiclesLoading ? (
          <div className="loading-container">
            <div className="loading-spinner-small"></div>
            <p>Loading document data...</p>
          </div>
        ) : (
          <div className="document-expiry-table">
            <table className="expiry-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Registration Number</th>
                  <th>Registration Expiry</th>
                  <th>Insurance Provider</th>
                  <th>Insurance Expiry</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vehiclesData?.data
                  ?.filter(vehicle => 
                    isExpiringDocument(vehicle.registration_expiry) || 
                    isExpiringDocument(vehicle.insurance?.expiry_date)
                  )
                  .sort((a, b) => {
                    const regDateA = a.registration_expiry ? new Date(a.registration_expiry) : new Date(9999, 0, 1);
                    const regDateB = b.registration_expiry ? new Date(b.registration_expiry) : new Date(9999, 0, 1);
                    const insDateA = a.insurance?.expiry_date ? new Date(a.insurance.expiry_date) : new Date(9999, 0, 1);
                    const insDateB = b.insurance?.expiry_date ? new Date(b.insurance.expiry_date) : new Date(9999, 0, 1);
                    
                    const earliestA = regDateA < insDateA ? regDateA : insDateA;
                    const earliestB = regDateB < insDateB ? regDateB : insDateB;
                    
                    return earliestA - earliestB;
                  })
                  .map(vehicle => (
                    <tr key={vehicle.id}>
                      <td>
                        <div className="vehicle-name-cell">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </div>
                      </td>
                      <td>{vehicle.registration}</td>
                      <td>
                        {formatDate(vehicle.registration_expiry)}
                        {isExpiringDocument(vehicle.registration_expiry) && (
                          <span className="badge badge-yellow">Expiring Soon</span>
                        )}
                      </td>
                      <td>{vehicle.insurance?.provider || 'N/A'}</td>
                      <td>
                        {formatDate(vehicle.insurance?.expiry_date)}
                        {isExpiringDocument(vehicle.insurance?.expiry_date) && (
                          <span className="badge badge-yellow">Expiring Soon</span>
                        )}
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm"
                          onClick={() => {
                            setSelectedVehicle(vehicle);
                            handleEditVehicle(vehicle);
                          }}
                        >
                          <FiEdit2 /> Update
                        </button>
                      </td>
                    </tr>
                  ))}
                
                {vehiclesData?.data?.filter(vehicle => 
                  isExpiringDocument(vehicle.registration_expiry) || 
                  isExpiringDocument(vehicle.insurance?.expiry_date)
                ).length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center">
                      <div className="empty-state-small">
                        <FiCheckCircle className="success-icon" />
                        <p>No documents expiring soon.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

/* -------------------------------------------------------------------------- */
/*                               Page Rendering                               */
/* -------------------------------------------------------------------------- */

return (
  <div className="vehicles-page">
    {/* Page Header */}
    <header className="page-header">
      <h2>Vehicles</h2>
    </header>

    {/* Tab Navigation */}
    <div className="tab-bar">
      <button
        className={`tab-btn ${activeTab === 'directory' ? 'active' : ''}`}
        onClick={() => setActiveTab('directory')}
      >
        Directory
      </button>
      <button
        className={`tab-btn ${activeTab === 'maintenance' ? 'active' : ''}`}
        onClick={() => setActiveTab('maintenance')}
      >
        Maintenance
      </button>
    </div>

    {/* Tab Content */}
    <div className="tab-content">
      {activeTab === 'directory' && renderDirectoryTab()}
      {activeTab === 'maintenance' && renderMaintenanceTab()}
    </div>
  </div>
);
};

export default Vehicles;
