import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { format, parseISO, addDays, isBefore, isAfter, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { 
  FiMapPin, 
  FiSearch, 
  FiFilter, 
  FiPlus, 
  FiEdit2, 
  FiTrash2,
  FiCalendar,
  FiDollarSign,
  FiClipboard,
  FiFileText,
  FiBarChart2,
  FiPhone,
  FiMail,
  FiTag,
  FiAlertCircle,
  FiCheckCircle,
  FiXCircle,
  FiArrowLeft,
  FiArrowRight,
  FiRefreshCw,
  FiSave,
  FiPrinter,
  FiDownload,
  FiUpload,
  FiClock,
  FiPercent,
  FiUser,
  FiUsers,
  FiHome,
  FiTool,
  FiActivity,
  FiShield,
  FiDroplet,
  FiCreditCard,
  FiHash,
  FiAward,
  FiFlag,
  FiThermometer,
  FiSlash,
  FiRotateCw,
  FiList,
  FiGlobe,
  FiWifi,
  FiMonitor,
  FiSpeaker,
  FiCoffee,
  FiLock,
  FiImage,
  FiSettings,
  FiInfo,
  FiMaximize2,
  FiStar,
  FiTrendingUp,
  FiChevronDown,
  FiChevronUp,
  FiLink,
  FiGrid,
  FiLayers,
  FiMap,
  FiNavigation,
  FiHeart,
  FiThumbsUp,
  FiThumbsDown,
  FiMessageSquare,
  FiAlertTriangle,
  FiCheck,
  FiX,
  FiPlusCircle,
  FiMinusCircle,
  FiCornerUpRight,
  FiCornerDownRight,
  FiExternalLink,
  /* FiWheelchair removed: swapped for Font-Awesome equivalent */
  FiEye,
  FiArrowUp
} from 'react-icons/fi';
import { FaWheelchair } from 'react-icons/fa';

// API base URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3009';

// Venues Page Component
const Venues = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('directory');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    capacity: 'all',
    accessibility: 'all',
    availability: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedVenueTab, setSelectedVenueTab] = useState('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    return startOfWeek(today, { weekStartsOn: 1 }); // Week starts on Monday
  });
  const venuesPerPage = 12;

  // Form state for creating/editing venue
  const [venueForm, setVenueForm] = useState({
    name: '',
    address: '',
    suburb: '',
    state: '',
    postcode: '',
    capacity: 0,
    hourly_rate: 0,
    daily_rate: 0,
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    description: '',
    accessibility_features: [],
    facilities: [],
    equipment: [],
    operating_hours: {
      monday: { open: '09:00', close: '17:00', is_open: true },
      tuesday: { open: '09:00', close: '17:00', is_open: true },
      wednesday: { open: '09:00', close: '17:00', is_open: true },
      thursday: { open: '09:00', close: '17:00', is_open: true },
      friday: { open: '09:00', close: '17:00', is_open: true },
      saturday: { open: '10:00', close: '16:00', is_open: false },
      sunday: { open: '10:00', close: '16:00', is_open: false }
    },
    status: 'active',
    notes: '',
    website: '',
    image_url: '',
    latitude: null,
    longitude: null
  });

  // Form state for adding equipment
  const [equipmentForm, setEquipmentForm] = useState({
    name: '',
    type: 'audio',
    quantity: 1,
    condition: 'good',
    notes: ''
  });

  // Form state for adding a booking
  const [bookingForm, setBookingForm] = useState({
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_time: '17:00',
    program_id: '',
    staff_id: '',
    purpose: '',
    attendees: 0,
    notes: ''
  });

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

  // Fetch programs data for booking assignment
  const { 
    data: programsData, 
    isLoading: programsLoading 
  } = useQuery(
    ['programs'],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/programs`);
      return response.data;
    }
  );

  // Fetch staff data for booking assignment
  const { 
    data: staffData, 
    isLoading: staffLoading 
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
    isLoading: bookingsLoading,
    refetch: refetchBookings
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

  // Create venue mutation
  const createVenueMutation = useMutation(
    async (venueData) => {
      const response = await axios.post(`${API_URL}/api/v1/venues`, venueData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['venues']);
        setIsCreateModalOpen(false);
        resetVenueForm();
      }
    }
  );

  // Update venue mutation
  const updateVenueMutation = useMutation(
    async ({ id, venueData }) => {
      const response = await axios.put(`${API_URL}/api/v1/venues/${id}`, venueData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['venues']);
        setIsEditModalOpen(false);
      }
    }
  );

  // Delete venue mutation
  const deleteVenueMutation = useMutation(
    async (id) => {
      const response = await axios.delete(`${API_URL}/api/v1/venues/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['venues']);
        setIsDeleteModalOpen(false);
        setSelectedVenue(null);
      }
    }
  );

  // Add equipment mutation
  const addEquipmentMutation = useMutation(
    async ({ venueId, equipmentData }) => {
      const response = await axios.post(`${API_URL}/api/v1/venues/${venueId}/equipment`, equipmentData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['venues']);
        setIsEquipmentModalOpen(false);
        resetEquipmentForm();
      }
    }
  );

  // Add booking mutation
  const addBookingMutation = useMutation(
    async ({ venueId, bookingData }) => {
      const response = await axios.post(`${API_URL}/api/v1/venues/${venueId}/bookings`, bookingData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['venueBookings']);
        setIsBookingModalOpen(false);
        resetBookingForm();
      }
    }
  );

  // Reset venue form
  const resetVenueForm = () => {
    setVenueForm({
      name: '',
      address: '',
      suburb: '',
      state: '',
      postcode: '',
      capacity: 0,
      hourly_rate: 0,
      daily_rate: 0,
      contact_name: '',
      contact_phone: '',
      contact_email: '',
      description: '',
      accessibility_features: [],
      facilities: [],
      equipment: [],
      operating_hours: {
        monday: { open: '09:00', close: '17:00', is_open: true },
        tuesday: { open: '09:00', close: '17:00', is_open: true },
        wednesday: { open: '09:00', close: '17:00', is_open: true },
        thursday: { open: '09:00', close: '17:00', is_open: true },
        friday: { open: '09:00', close: '17:00', is_open: true },
        saturday: { open: '10:00', close: '16:00', is_open: false },
        sunday: { open: '10:00', close: '16:00', is_open: false }
      },
      status: 'active',
      notes: '',
      website: '',
      image_url: '',
      latitude: null,
      longitude: null
    });
  };

  // Reset equipment form
  const resetEquipmentForm = () => {
    setEquipmentForm({
      name: '',
      type: 'audio',
      quantity: 1,
      condition: 'good',
      notes: ''
    });
  };

  // Reset booking form
  const resetBookingForm = () => {
    setBookingForm({
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: format(new Date(), 'yyyy-MM-dd'),
      start_time: '09:00',
      end_time: '17:00',
      program_id: '',
      staff_id: '',
      purpose: '',
      attendees: 0,
      notes: ''
    });
  };

  // Handle opening edit modal
  const handleEditVenue = (venue) => {
    setVenueForm({
      name: venue.name || '',
      address: venue.address || '',
      suburb: venue.suburb || '',
      state: venue.state || '',
      postcode: venue.postcode || '',
      capacity: venue.capacity || 0,
      hourly_rate: venue.hourly_rate || 0,
      daily_rate: venue.daily_rate || 0,
      contact_name: venue.contact_name || '',
      contact_phone: venue.contact_phone || '',
      contact_email: venue.contact_email || '',
      description: venue.description || '',
      accessibility_features: venue.accessibility_features || [],
      facilities: venue.facilities || [],
      equipment: venue.equipment || [],
      operating_hours: venue.operating_hours || {
        monday: { open: '09:00', close: '17:00', is_open: true },
        tuesday: { open: '09:00', close: '17:00', is_open: true },
        wednesday: { open: '09:00', close: '17:00', is_open: true },
        thursday: { open: '09:00', close: '17:00', is_open: true },
        friday: { open: '09:00', close: '17:00', is_open: true },
        saturday: { open: '10:00', close: '16:00', is_open: false },
        sunday: { open: '10:00', close: '16:00', is_open: false }
      },
      status: venue.status || 'active',
      notes: venue.notes || '',
      website: venue.website || '',
      image_url: venue.image_url || '',
      latitude: venue.latitude || null,
      longitude: venue.longitude || null
    });
    setIsEditModalOpen(true);
  };

  // Handle opening equipment modal
  const handleAddEquipment = (venue) => {
    setIsEquipmentModalOpen(true);
  };

  // Handle opening booking modal
  const handleAddBooking = (venue) => {
    setIsBookingModalOpen(true);
  };

  // Handle venue creation
  const handleCreateVenue = (e) => {
    e.preventDefault();
    createVenueMutation.mutate(venueForm);
  };

  // Handle venue update
  const handleUpdateVenue = (e) => {
    e.preventDefault();
    if (selectedVenue) {
      updateVenueMutation.mutate({
        id: selectedVenue.id,
        venueData: venueForm
      });
    }
  };

  // Handle venue deletion
  const handleDeleteVenue = () => {
    if (selectedVenue) {
      deleteVenueMutation.mutate(selectedVenue.id);
    }
  };

  // Handle adding equipment
  const handleAddEquipmentItem = (e) => {
    e.preventDefault();
    if (selectedVenue) {
      addEquipmentMutation.mutate({
        venueId: selectedVenue.id,
        equipmentData: equipmentForm
      });
    }
  };

  // Handle adding a booking
  const handleAddBookingRecord = (e) => {
    e.preventDefault();
    if (selectedVenue) {
      addBookingMutation.mutate({
        venueId: selectedVenue.id,
        bookingData: bookingForm
      });
    }
  };

  // Handle accessibility feature toggle
  const handleAccessibilityToggle = (feature) => {
    const features = [...venueForm.accessibility_features];
    const index = features.indexOf(feature);
    
    if (index === -1) {
      features.push(feature);
    } else {
      features.splice(index, 1);
    }
    
    setVenueForm({
      ...venueForm,
      accessibility_features: features
    });
  };

  // Handle facility toggle
  const handleFacilityToggle = (facility) => {
    const facilities = [...venueForm.facilities];
    const index = facilities.indexOf(facility);
    
    if (index === -1) {
      facilities.push(facility);
    } else {
      facilities.splice(index, 1);
    }
    
    setVenueForm({
      ...venueForm,
      facilities: facilities
    });
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

  // Check if venue is available today
  const isVenueAvailable = (venue) => {
    if (venue.status !== 'active') return false;
    
    const today = new Date();
    const dayOfWeek = format(today, 'EEEE').toLowerCase();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    // Check operating hours
    if (!venue.operating_hours?.[dayOfWeek]?.is_open) return false;
    
    // Check if venue has bookings today
    return !bookingsData?.data?.some(booking => 
      booking.venue_id === venue.id && 
      booking.start_date === todayStr
    );
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

  // Get week dates array
  const getWeekDates = () => {
    return eachDayOfInterval({
      start: currentWeekStart,
      end: endOfWeek(currentWeekStart, { weekStartsOn: 1 })
    });
  };

  // Get bookings for venue and date
  const getBookingsForVenueAndDate = (venueId, date) => {
    if (!bookingsData || !bookingsData.data) return [];
    
    const dateStr = format(date, 'yyyy-MM-dd');
    return bookingsData.data.filter(booking => 
      booking.venue_id === venueId && booking.start_date === dateStr
    );
  };

  // Get staff name from ID
  const getStaffName = (staffId) => {
    if (!staffData || !staffData.data) return 'Unknown';
    
    const staff = staffData.data.find(s => s.id === staffId);
    return staff ? `${staff.first_name} ${staff.last_name}` : 'Unknown';
  };

  // Get program name from ID
  const getProgramName = (programId) => {
    if (!programsData || !programsData.data) return 'Unknown';
    
    const program = programsData.data.find(p => p.id === programId);
    return program ? program.name : 'Unknown';
  };

  // Calculate total venue bookings
  const calculateTotalBookings = (venueId) => {
    if (!bookingsData || !bookingsData.data) return 0;
    
    return bookingsData.data.filter(booking => booking.venue_id === venueId).length;
  };

  // Calculate venue utilization percentage
  const calculateUtilizationPercentage = (venueId) => {
    if (!bookingsData || !bookingsData.data) return 0;
    
    const totalDays = 30; // Last 30 days
    const bookingsInPeriod = bookingsData.data.filter(booking => {
      if (booking.venue_id !== venueId) return false;
      
      const bookingDate = new Date(booking.start_date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      return bookingDate >= thirtyDaysAgo;
    }).length;
    
    return Math.round((bookingsInPeriod / totalDays) * 100);
  };

  // Calculate revenue from venue
  const calculateVenueRevenue = (venueId) => {
    if (!bookingsData || !bookingsData.data || !venuesData || !venuesData.data) return 0;
    
    const venue = venuesData.data.find(v => v.id === venueId);
    if (!venue) return 0;
    
    return bookingsData.data
      .filter(booking => booking.venue_id === venueId)
      .reduce((total, booking) => {
        // Calculate duration in hours
        const startDate = new Date(booking.start_date + 'T' + booking.start_time);
        const endDate = new Date(booking.end_date + 'T' + booking.end_time);
        const durationHours = (endDate - startDate) / (1000 * 60 * 60);
        
        // If duration is more than 8 hours, use daily rate
        if (durationHours > 8) {
          const days = Math.ceil(durationHours / 24);
          return total + (venue.daily_rate * days);
        } else {
          return total + (venue.hourly_rate * durationHours);
        }
      }, 0);
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

  // Get equipment type icon
  const getEquipmentIcon = (type) => {
    switch (type) {
      case 'audio':
        return <FiSpeaker />;
      case 'video':
        return <FiMonitor />;
      case 'computer':
        return <FiMonitor />;
      case 'furniture':
        return <FiHome />;
      case 'sports':
        return <FiActivity />;
      case 'art':
        return <FiImage />;
      case 'other':
        return <FiTool />;
      default:
        return <FiTool />;
    }
  };

  // Render directory tab content
const renderDirectoryTab = () => (
  <div className="directory-tab">
    {/* Page Header */}
    <header className="page-header">
      <h2>Venues</h2>
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
    </header>

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
          {currentVenues.map((venue) => (
            <div
              key={venue.id}
              className="venue-card glass-card"
            >
              <div className="venue-header">
                <h3 className="venue-name">{venue.name}</h3>
                <span className={`badge ${getStatusBadge(venue.status)}`}>
                  {formatStatus(venue.status)}
                </span>
              </div>
              <div className="venue-info">
                <p className="venue-address">
                  {venue.address}, {venue.suburb} {venue.state} {venue.postcode}
                </p>
                {venue.capacity ? (
                  <p className="venue-capacity">
                    Capacity: {venue.capacity}
                  </p>
                ) : null}
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
