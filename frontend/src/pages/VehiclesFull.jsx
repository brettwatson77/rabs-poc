import React, { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { format, addDays } from 'date-fns';
import { 
  FiTruck, 
  FiPlus, 
  FiAlertCircle,
  FiRefreshCw,
  FiArrowLeft,
  FiArrowRight
} from 'react-icons/fi';

// Import shared API client
import api from '../api/api';

// Import components
import SearchFilterBar from './vehicles/components/SearchFilterBar';
import FleetSummary from './vehicles/components/FleetSummary';
import VehiclesGrid from './vehicles/components/VehiclesGrid';
import DetailModal from './vehicles/components/vehicle-detail/DetailModal';
import MaintenanceDashboard from './vehicles/components/MaintenanceDashboard';
import DocumentExpiryTable from './vehicles/components/DocumentExpiryTable';

// Import hook
import useVehiclesData from './vehicles/hooks/useVehiclesData';

// Page-specific styles (matches original Vehicles page look)
import '../styles/Vehicles.css';

// VehiclesFull Page Component
const VehiclesFull = () => {
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
  const [selectedVehicleTab, setSelectedVehicleTab] = useState('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  });
  const vehiclesPerPage = 24;

  // Form state for vehicle odometer updates
  const [vehicleForm, setVehicleForm] = useState({
    odometer: 0
  });

  // Use the custom hook to fetch data
  const {
    vehiclesData,
    vehiclesLoading,
    vehiclesError,
    refetchVehicles,
    staffData,
    bookingsData,
    bookingsLoading
  } = useVehiclesData(currentWeekStart);

  // Update odometer mutation
  const updateOdometerMutation = useMutation(
    async ({ vehicleId, odometer }) => {
      const response = await api.patch(`/vehicles/${vehicleId}`, { odometer });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['vehicles']);
      }
    }
  );

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

  // When a vehicle is selected, update the form with its odometer
  const handleSelectVehicle = (vehicle) => {
    setSelectedVehicle(vehicle);
    setVehicleForm({
      odometer: vehicle.odometer || 0
    });
  };

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
        {activeTab === 'directory' && (
          <>
            {/* Search and Filter Bar */}
            <SearchFilterBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              showFilters={showFilters}
              onToggleFilters={() => setShowFilters(!showFilters)}
              filters={filters}
              onFiltersChange={setFilters}
            >
              <button 
                className="create-btn glass-button"
                onClick={() => {/* No-op - creation flow omitted */}}
              >
                <FiPlus />
                <span>New Vehicle</span>
              </button>
            </SearchFilterBar>
            
            {/* Fleet Summary */}
            <FleetSummary vehicles={vehiclesData?.data || []} />
            
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
                <p>Try adjusting your search or filters.</p>
              </div>
            ) : (
              <>
                <VehiclesGrid
                  vehicles={currentVehicles}
                  selectedVehicle={selectedVehicle}
                  onSelect={handleSelectVehicle}
                  getStatusBadge={getStatusBadge}
                  formatStatus={formatStatus}
                  needsMaintenanceSoon={needsMaintenanceSoon}
                  isExpiringDocument={isExpiringDocument}
                  isVehicleAvailable={isVehicleAvailable}
                />
                
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
          </>
        )}
        
        {activeTab === 'maintenance' && (
          <>
            <MaintenanceDashboard
              vehicles={vehiclesData?.data || []}
              vehiclesLoading={vehiclesLoading}
              needsMaintenanceSoon={needsMaintenanceSoon}
              formatDate={formatDate}
              formatCurrency={formatCurrency}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
            <DocumentExpiryTable
              vehicles={vehiclesData?.data || []}
              vehiclesLoading={vehiclesLoading}
              isExpiringDocument={isExpiringDocument}
              formatDate={formatDate}
            />
          </>
        )}
      </div>
      
      {/* Vehicle Detail Modal */}
      {selectedVehicle && (
        <DetailModal
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
          selectedTab={selectedVehicleTab}
          setSelectedTab={setSelectedVehicleTab}
          vehicleForm={vehicleForm}
          setVehicleForm={setVehicleForm}
          onUpdateOdometer={handleUpdateOdometer}
          needsMaintenanceSoon={needsMaintenanceSoon}
          formatDate={formatDate}
          formatCurrency={formatCurrency}
          getStatusBadge={getStatusBadge}
          formatStatus={formatStatus}
          isExpiringDocument={isExpiringDocument}
          getWeekDates={getWeekDates}
          getBookingsForVehicleAndDate={getBookingsForVehicleAndDate}
          bookingsData={bookingsData}
          bookingsLoading={bookingsLoading}
          currentWeekStart={currentWeekStart}
          format={format}
          addDays={addDays}
          getDriverName={getDriverName}
          onPrevWeek={handlePrevWeek}
          onNextWeek={handleNextWeek}
          onAddMaintenance={() => {/* No-op - maintenance flow omitted */}}
          onAddBooking={() => {/* No-op - booking flow omitted */}}
        />
      )}
    </div>
  );
};

export default VehiclesFull;
