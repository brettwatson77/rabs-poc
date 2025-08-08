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
  FiWheelchair
} from 'react-icons/fi';

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
        return <FiWheelchair />;
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
      {/* Search and Filter Bar */}
      <div className="search-filter-bar glass-panel">
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
                <label>Capacity</label>
                <select
                  value={filters.capacity}
                  onChange={(e) => setFilters({...filters, capacity: e.target.value})}
                >
                  <option value="all">All Capacities</option>
                  <option value="small">Small (≤ 20)</option>
                  <option value="medium">Medium (21-50)</option>
                  <option value="large">Large (50+)</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Accessibility</label>
                <select
                  value={filters.accessibility}
                  onChange={(e) => setFilters({...filters, accessibility: e.target.value})}
                >
                  <option value="all">All Features</option>
                  <option value="wheelchair">Wheelchair Access</option>
                  <option value="hearing">Hearing Loop</option>
                  <option value="vision">Vision Aids</option>
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
          <span>New Venue</span>
        </button>
      </div>
      
      {/* Venues Summary */}
      <div className="venues-summary glass-panel">
        <div className="summary-item">
          <div className="summary-icon">
            <FiMapPin />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {venuesData?.data?.length || 0}
            </div>
            <div className="summary-label">Total Venues</div>
          </div>
        </div>
        
        <div className="summary-item">
          <div className="summary-icon">
            <FiCheckCircle />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {venuesData?.data?.filter(v => v.status === 'active').length || 0}
            </div>
            <div className="summary-label">Active Venues</div>
          </div>
        </div>
        
        <div className="summary-item">
          <div className="summary-icon">
            <FiUsers />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {venuesData?.data?.reduce((total, venue) => total + (venue.capacity || 0), 0)}
            </div>
            <div className="summary-label">Total Capacity</div>
          </div>
        </div>
        
        <div className="summary-item">
          <div className="summary-icon">
            <FiCalendar />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {bookingsData?.data?.length || 0}
            </div>
            <div className="summary-label">Active Bookings</div>
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
          <p>Try adjusting your search or filters, or add a new venue.</p>
          <button 
            className="btn btn-primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <FiPlus /> Add Venue
          </button>
        </div>
      ) : (
        <>
          <div className="venues-grid">
            {currentVenues.map(venue => (
              <div 
                key={venue.id} 
                className="venue-card glass-card"
                onClick={() => setSelectedVenue(venue)}
              >
                <div className="venue-header">
                  <div className="venue-location">
                    <FiMapPin className="location-icon" />
                    <span>{venue.suburb}, {venue.state}</span>
                  </div>
                  <div className="venue-badges">
                    <span className={`badge ${getStatusBadge(venue.status)}`}>
                      {formatStatus(venue.status)}
                    </span>
                  </div>
                </div>
                
                {venue.image_url && (
                  <div className="venue-image">
                    <img src={venue.image_url} alt={venue.name} />
                  </div>
                )}
                
                <div className="venue-info">
                  <h3 className="venue-name">{venue.name}</h3>
                  <div className="venue-address">{venue.address}</div>
                  
                  <div className="venue-details">
                    <div className="detail-item">
                      <FiUsers className="detail-icon" />
                      <span>Capacity: {venue.capacity}</span>
                    </div>
                    <div className="detail-item">
                      <FiDollarSign className="detail-icon" />
                      <span>{formatCurrency(venue.hourly_rate)}/hr</span>
                    </div>
                  </div>
                </div>
                
                {/* Accessibility Features */}
                {venue.accessibility_features && venue.accessibility_features.length > 0 && (
                  <div className="venue-accessibility">
                    {venue.accessibility_features.slice(0, 3).map((feature, index) => (
                      <div key={index} className="accessibility-badge" title={feature.replace('_', ' ')}>
                        {getAccessibilityIcon(feature)}
                      </div>
                    ))}
                    {venue.accessibility_features.length > 3 && (
                      <div className="accessibility-badge more" title={`${venue.accessibility_features.length - 3} more features`}>
                        +{venue.accessibility_features.length - 3}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Facilities */}
                {venue.facilities && venue.facilities.length > 0 && (
                  <div className="venue-facilities">
                    {venue.facilities.slice(0, 3).map((facility, index) => (
                      <div key={index} className="facility-badge" title={facility.replace('_', ' ')}>
                        {getFacilityIcon(facility)}
                      </div>
                    ))}
                    {venue.facilities.length > 3 && (
                      <div className="facility-badge more" title={`${venue.facilities.length - 3} more facilities`}>
                        +{venue.facilities.length - 3}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="venue-footer">
                  <div className="venue-status">
                    {isVenueAvailable(venue) ? (
                      <span className="available-status">Available Today</span>
                    ) : (
                      <span className="unavailable-status">Booked Today</span>
                    )}
                  </div>
                  
                  <div className="venue-actions">
                    <button 
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditVenue(venue);
                      }}
                      title="Edit"
                    >
                      <FiEdit2 />
                    </button>
                    <button 
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedVenue(venue);
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
      
      {/* Venue Detail View */}
      {selectedVenue && (
        <div className="modal-overlay" onClick={() => setSelectedVenue(null)}>
          <div className="modal-content venue-detail-modal glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Venue Details</h3>
              <button className="modal-close" onClick={() => setSelectedVenue(null)}>
                <FiXCircle />
              </button>
            </div>
            
            <div className="venue-detail">
              <div className="detail-header">
                <div className="venue-banner">
                  <div className="venue-title">
                    <h2>{selectedVenue.name}</h2>
                    <div className="venue-location-display">
                      <FiMapPin />
                      <span>{selectedVenue.address}, {selectedVenue.suburb}, {selectedVenue.state} {selectedVenue.postcode}</span>
                    </div>
                  </div>
                  <div className="venue-status-badge">
                    <span className={`badge ${getStatusBadge(selectedVenue.status)}`}>
                      {formatStatus(selectedVenue.status)}
                    </span>
                  </div>
                </div>
                
                <div className="detail-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => handleEditVenue(selectedVenue)}
                  >
                    <FiEdit2 /> Edit Venue
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleAddEquipment(selectedVenue)}
                  >
                    <FiTool /> Add Equipment
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleAddBooking(selectedVenue)}
                  >
                    <FiCalendar /> Book Venue
                  </button>
                </div>
              </div>
              
              <div className="detail-tabs">
                <button 
                  className={`detail-tab-btn ${selectedVenueTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setSelectedVenueTab('overview')}
                >
                  <FiInfo />
                  <span>Overview</span>
                </button>
                <button 
                  className={`detail-tab-btn ${selectedVenueTab === 'facilities' ? 'active' : ''}`}
                  onClick={() => setSelectedVenueTab('facilities')}
                >
                  <FiGrid />
                  <span>Facilities</span>
                </button>
                <button 
                  className={`detail-tab-btn ${selectedVenueTab === 'bookings' ? 'active' : ''}`}
                  onClick={() => setSelectedVenueTab('bookings')}
                >
                  <FiCalendar />
                  <span>Bookings</span>
                </button>
                <button 
                  className={`detail-tab-btn ${selectedVenueTab === 'costs' ? 'active' : ''}`}
                  onClick={() => setSelectedVenueTab('costs')}
                >
                  <FiDollarSign />
                  <span>Costs</span>
                </button>
              </div>
              
              <div className="detail-content">
                {selectedVenueTab === 'overview' && (
                  <div className="venue-overview">
                    {selectedVenue.image_url && (
                      <div className="venue-image-large">
                        <img src={selectedVenue.image_url} alt={selectedVenue.name} />
                      </div>
                    )}
                    
                    <div className="detail-section glass-card">
                      <h4>Venue Information</h4>
                      <div className="detail-grid">
                        <div className="detail-item">
                          <div className="detail-label">Name</div>
                          <div className="detail-value">{selectedVenue.name}</div>
                        </div>
                        <div className="detail-item">
                          <div className="detail-label">Address</div>
                          <div className="detail-value">{selectedVenue.address}</div>
                        </div>
                        <div className="detail-item">
                          <div className="detail-label">Suburb</div>
                          <div className="detail-value">{selectedVenue.suburb}</div>
                        </div>
                        <div className="detail-item">
                          <div className="detail-label">State</div>
                          <div className="detail-value">{selectedVenue.state}</div>
                        </div>
                        <div className="detail-item">
                          <div className="detail-label">Postcode</div>
                          <div className="detail-value">{selectedVenue.postcode}</div>
                        </div>
                        <div className="detail-item">
                          <div className="detail-label">Capacity</div>
                          <div className="detail-value">{selectedVenue.capacity} people</div>
                        </div>
                        <div className="detail-item">
                          <div className="detail-label">Website</div>
                          <div className="detail-value">
                            {selectedVenue.website ? (
                              <a href={selectedVenue.website} target="_blank" rel="noopener noreferrer">
                                {selectedVenue.website} <FiExternalLink />
                              </a>
                            ) : 'N/A'}
                          </div>
                        </div>
                        <div className="detail-item">
                          <div className="detail-label">Status</div>
                          <div className="detail-value">
                            <span className={`badge ${getStatusBadge(selectedVenue.status)}`}>
                              {formatStatus(selectedVenue.status)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="detail-section glass-card">
                      <h4>Contact Information</h4>
                      <div className="contact-info">
                        <div className="contact-item">
                          <div className="contact-icon">
                            <FiUser />
                          </div>
                          <div className="contact-content">
                            <div className="contact-label">Contact Person</div>
                            <div className="contact-value">{selectedVenue.contact_name || 'N/A'}</div>
                          </div>
                        </div>
                        <div className="contact-item">
                          <div className="contact-icon">
                            <FiPhone />
                          </div>
                          <div className="contact-content">
                            <div className="contact-label">Phone</div>
                            <div className="contact-value">{selectedVenue.contact_phone || 'N/A'}</div>
                          </div>
                        </div>
                        <div className="contact-item">
                          <div className="contact-icon">
                            <FiMail />
                          </div>
                          <div className="contact-content">
                            <div className="contact-label">Email</div>
                            <div className="contact-value">{selectedVenue.contact_email || 'N/A'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="detail-section glass-card">
                      <h4>Operating Hours</h4>
                      <div className="operating-hours">
                        {selectedVenue.operating_hours && Object.entries(selectedVenue.operating_hours).map(([day, hours]) => (
                          <div key={day} className="hours-item">
                            <div className="day-name">{day.charAt(0).toUpperCase() + day.slice(1)}</div>
                            <div className="hours-value">
                              {hours.is_open ? (
                                <span>{hours.open} - {hours.close}</span>
                              ) : (
                                <span className="closed">Closed</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="detail-section glass-card">
                      <h4>Description & Notes</h4>
                      <div className="venue-description">
                        {selectedVenue.description ? (
                          <p>{selectedVenue.description}</p>
                        ) : (
                          <p className="text-muted">No description available.</p>
                        )}
                      </div>
                      
                      <div className="venue-notes">
                        <h5>Notes</h5>
                        {selectedVenue.notes ? (
                          <p>{selectedVenue.notes}</p>
                        ) : (
                          <p className="text-muted">No notes available.</p>
                        )}
                      </div>
                    </div>
                    
                    {selectedVenue.latitude && selectedVenue.longitude && (
                      <div className="detail-section glass-card">
                        <h4>Location Map</h4>
                        <div className="venue-map">
                          <div className="map-placeholder">
                            <FiMap className="map-icon" />
                            <p>Map would be displayed here with coordinates: {selectedVenue.latitude}, {selectedVenue.longitude}</p>
                          </div>
                          <div className="map-actions">
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${selectedVenue.latitude},${selectedVenue.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary"
                            >
                              <FiNavigation /> Open in Google Maps
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {selectedVenueTab === 'facilities' && (
                  <div className="venue-facilities-tab">
                    <div className="detail-section glass-card">
                      <h4>Accessibility Features</h4>
                      <div className="accessibility-features">
                        {selectedVenue.accessibility_features && selectedVenue.accessibility_features.length > 0 ? (
                          <div className="features-grid">
                            {selectedVenue.accessibility_features.map((feature, index) => (
                              <div key={index} className="feature-item">
                                <div className="feature-icon">
                                  {getAccessibilityIcon(feature)}
                                </div>
                                <div className="feature-name">
                                  {feature.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted">No accessibility features listed for this venue.</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="detail-section glass-card">
                      <h4>Facilities</h4>
                      <div className="facilities-list">
                        {selectedVenue.facilities && selectedVenue.facilities.length > 0 ? (
                          <div className="facilities-grid">
                            {selectedVenue.facilities.map((facility, index) => (
                              <div key={index} className="facility-item">
                                <div className="facility-icon">
                                  {getFacilityIcon(facility)}
                                </div>
                                <div className="facility-name">
                                  {facility.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted">No facilities listed for this venue.</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="detail-section glass-card">
                      <div className="section-header">
                        <h4>Equipment</h4>
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAddEquipment(selectedVenue)}
                        >
                          <FiPlus /> Add Equipment
                        </button>
                      </div>
                      
                      {selectedVenue.equipment && selectedVenue.equipment.length > 0 ? (
                        <div className="equipment-table-container">
                          <table className="equipment-table">
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Quantity</th>
                                <th>Condition</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedVenue.equipment.map((item, index) => (
                                <tr key={index}>
                                  <td>
                                    <div className="equipment-name">
                                      <span className="equipment-icon">{getEquipmentIcon(item.type)}</span>
                                      <span>{item.name}</span>
                                    </div>
                                  </td>
                                  <td>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</td>
                                  <td>{item.quantity}</td>
                                  <td>
                                    <span className={`condition-badge ${item.condition}`}>
                                      {item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}
                                    </span>
                                  </td>
                                  <td>{item.notes || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-muted">No equipment listed for this venue.</p>
                      )}
                    </div>
                  </div>
                )}
                
                {selectedVenueTab === 'bookings' && (
                  <div className="venue-bookings">
                    <div className="detail-section glass-card">
                      <div className="section-header">
                        <h4>Upcoming Bookings</h4>
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAddBooking(selectedVenue)}
                        >
                          <FiPlus /> Add Booking
                        </button>
                      </div>
                      
                      <div className="week-navigation">
                        <button className="btn btn-sm" onClick={handlePrevWeek}>
                          <FiArrowLeft /> Previous Week
                        </button>
                        <span className="week-label">
                          {format(currentWeekStart, 'MMM d')} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'MMM d, yyyy')}
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
                            const bookings = getBookingsForVenueAndDate(selectedVenue.id, date);
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
                                          <div className="booking-program">
                                            <FiTag className="icon" />
                                            <span>{getProgramName(booking.program_id)}</span>
                                          </div>
                                          <div className="booking-staff">
                                            <FiUser className="icon" />
                                            <span>{getStaffName(booking.staff_id)}</span>
                                          </div>
                                          {booking.attendees > 0 && (
                                            <div className="booking-attendees">
                                              <FiUsers className="icon" />
                                              <span>{booking.attendees} attendees</span>
                                            </div>
                                          )}
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
                        {bookingsData?.data?.filter(booking => booking.venue_id === selectedVenue.id)
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
                              <div className="booking-program">
                                <FiTag className="icon" />
                                <span>{getProgramName(booking.program_id)}</span>
                              </div>
                              <div className="booking-staff">
                                <FiUser className="icon" />
                                <span>{getStaffName(booking.staff_id)}</span>
                              </div>
                              {booking.attendees > 0 && (
                                <div className="booking-attendees">
                                  <FiUsers className="icon" />
                                  <span>{booking.attendees} attendees</span>
                                </div>
                              )}
                              {booking.notes && (
                                <div className="booking-notes">
                                  <FiFileText className="icon" />
                                  <span>{booking.notes}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        
                        {!bookingsData?.data?.some(booking => booking.venue_id === selectedVenue.id) && (
                          <p className="text-muted">No bookings found for this venue.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedVenueTab === 'costs' && (
                  <div className="venue-costs">
                    <div className="detail-section glass-card">
                      <h4>Venue Rates</h4>
                      <div className="rates-info">
                        <div className="rate-item">
                          <div className="rate-label">Hourly Rate</div>
                          <div className="rate-value">{formatCurrency(selectedVenue.hourly_rate)}</div>
                        </div>
                        <div className="rate-item">
                          <div className="rate-label">Daily Rate</div>
                          <div className="rate-value">{formatCurrency(selectedVenue.daily_rate)}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="detail-section glass-card">
                      <h4>Booking Statistics</h4>
                      <div className="stats-grid">
                        <div className="stat-item">
                          <div className="stat-icon">
                            <FiCalendar />
                          </div>
                          <div className="stat-content">
                            <div className="stat-value">{calculateTotalBookings(selectedVenue.id)}</div>
                            <div className="stat-label">Total Bookings</div>
                          </div>
                        </div>
                        
                        <div className="stat-item">
                          <div className="stat-icon">
                            <FiPercent />
                          </div>
                          <div className="stat-content">
                            <div className="stat-value">{calculateUtilizationPercentage(selectedVenue.id)}%</div>
                            <div className="stat-label">Utilization (30 days)</div>
                          </div>
                        </div>
                        
                        <div className="stat-item">
                          <div className="stat-icon">
                            <FiDollarSign />
                          </div>
                          <div className="stat-content">
                            <div className="stat-value">{formatCurrency(calculateVenueRevenue(selectedVenue.id))}</div>
                            <div className="stat-label">Total Revenue</div>
                          </div>
                        </div>
                        
                        <div className="stat-item">
                          <div className="stat-icon">
                            <FiUsers />
                          </div>
                          <div className="stat-content">
                            <div className="stat-value">
                              {bookingsData?.data
                                ?.filter(booking => booking.venue_id === selectedVenue.id)
                                .reduce((total, booking) => total + (booking.attendees || 0), 0) || 0}
                            </div>
                            <div className="stat-label">Total Attendees</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="detail-section glass-card">
                      <h4>Revenue by Program</h4>
                      {bookingsData?.data?.some(booking => booking.venue_id === selectedVenue.id) ? (
                        <div className="revenue-table-container">
                          <table className="revenue-table">
                            <thead>
                              <tr>
                                <th>Program</th>
                                <th>Bookings</th>
                                <th>Hours</th>
                                <th>Revenue</th>
                              </tr>
                            </thead>
                            <tbody>
                              {programsData?.data
                                ?.filter(program => 
                                  bookingsData?.data?.some(booking => 
                                    booking.venue_id === selectedVenue.id && booking.program_id === program.id
                                  )
                                )
                                .map(program => {
                                  const programBookings = bookingsData?.data?.filter(booking => 
                                    booking.venue_id === selectedVenue.id && booking.program_id === program.id
                                  ) || [];
                                  
                                  const totalHours = programBookings.reduce((total, booking) => {
                                    const startDate = new Date(booking.start_date + 'T' + booking.start_time);
                                    const endDate = new Date(booking.end_date + 'T' + booking.end_time);
                                    const durationHours = (endDate - startDate) / (1000 * 60 * 60);
                                    return total + durationHours;
                                  }, 0);
                                  
                                  const totalRevenue = programBookings.reduce((total, booking) => {
                                    const startDate = new Date(booking.start_date + 'T' + booking.start_time);
                                    const endDate = new Date(booking.end_date + 'T' + booking.end_time);
                                    const durationHours = (endDate - startDate) / (1000 * 60 * 60);
                                    
                                    if (durationHours > 8) {
                                      const days = Math.ceil(durationHours / 24);
                                      return total + (selectedVenue.daily_rate * days);
                                    } else {
                                      return total + (selectedVenue.hourly_rate * durationHours);
                                    }
                                  }, 0);
                                  
                                  return (
                                    <tr key={program.id}>
                                      <td>{program.name}</td>
                                      <td>{programBookings.length}</td>
                                      <td>{totalHours.toFixed(1)}</td>
                                      <td>{formatCurrency(totalRevenue)}</td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan="3" className="total-label">Total Revenue</td>
                                <td className="total-value">{formatCurrency(calculateVenueRevenue(selectedVenue.id))}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : (
                        <p className="text-muted">No bookings data available for revenue analysis.</p>
                      )}
                    </div>
                    
                    <div className="detail-section glass-card">
                      <h4>Monthly Usage Report</h4>
                      <div className="usage-chart-container">
                        <div className="chart-placeholder">
                          <FiBarChart2 className="chart-icon" />
                          <p>Monthly usage chart would be displayed here</p>
                        </div>
                        <div className="chart-legend">
                          <div className="legend-item">
                            <div className="legend-color bookings"></div>
                            <div className="legend-label">Bookings</div>
                          </div>
                          <div className="legend-item">
                            <div className="legend-color revenue"></div>
                            <div className="legend-label">Revenue</div>
                          </div>
                          <div className="legend-item">
                            <div className="legend-color attendees"></div>
                            <div className="legend-label">Attendees</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Create Venue Modal */}
      {isCreateModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content create-modal glass-panel">
            <div className="modal-header">
              <h3>Create New Venue</h3>
              <button className="modal-close" onClick={() => setIsCreateModalOpen(false)}>
                <FiXCircle />
              </button>
            </div>
            
            <form onSubmit={handleCreateVenue}>
              <div className="form-section">
                <h4>Basic Information</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="name">Venue Name*</label>
                    <input
                      type="text"
                      id="name"
                      value={venueForm.name}
                      onChange={(e) => setVenueForm({...venueForm, name: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="status">Status</label>
                    <select
                      id="status"
                      value={venueForm.status}
                      onChange={(e) => setVenueForm({...venueForm, status: e.target.value})}
                    >
                      <option value="active">Active</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="address">Address*</label>
                  <input
                    type="text"
                    id="address"
                    value={venueForm.address}
                    onChange={(e) => setVenueForm({...venueForm, address: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="suburb">Suburb*</label>
                    <input
                      type="text"
                      id="suburb"
                      value={venueForm.suburb}
                      onChange={(e) => setVenueForm({...venueForm, suburb: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="state">State*</label>
                    <select
                      id="state"
                      value={venueForm.state}
                      onChange={(e) => setVenueForm({...venueForm, state: e.target.value})}
                      required
                    >
                      <option value="">Select State</option>
                      <option value="ACT">Australian Capital Territory</option>
                      <option value="NSW">New South Wales</option>
                      <option value="NT">Northern Territory</option>
                      <option value="QLD">Queensland</option>
                      <option value="SA">South Australia</option>
                      <option value="TAS">Tasmania</option>
                      <option value="VIC">Victoria</option>
                      <option value="WA">Western Australia</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="postcode">Postcode*</label>
                    <input
                      type="text"
                      id="postcode"
                      value={venueForm.postcode}
                      onChange={(e) => setVenueForm({...venueForm, postcode: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="capacity">Capacity*</label>
                    <input
                      type="number"
                      id="capacity"
                      min="0"
                      value={venueForm.capacity}
                      onChange={(e) => setVenueForm({...venueForm, capacity: parseInt(e.target.value) || 0})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="website">Website</label>
                    <input
                      type="url"
                      id="website"
                      value={venueForm.website}
                      onChange={(e) => setVenueForm({...venueForm, website: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    value={venueForm.description}
                    onChange={(e) => setVenueForm({...venueForm, description: e.target.value})}
                    rows="3"
                  ></textarea>
                </div>
              </div>
              
              <div className="form-section">
                <h4>Contact Information</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="contact_name">Contact Name</label>
                    <input
                      type="text"
                      id="contact_name"
                      value={venueForm.contact_name}
                      onChange={(e) => setVenueForm({...venueForm, contact_name: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="contact_phone">Contact Phone</label>
                    <input
                      type="tel"
                      id="contact_phone"
                      value={venueForm.contact_phone}
                      onChange={(e) => setVenueForm({...venueForm, contact_phone: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="contact_email">Contact Email</label>
                    <input
                      type="email"
                      id="contact_email"
                      value={venueForm.contact_email}
                      onChange={(e) => setVenueForm({...venueForm, contact_email: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              
              <div className="form-section">
                <h4>Rates</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="hourly_rate">Hourly Rate ($)</label>
                    <input
                      type="number"
                      id="hourly_rate"
                      min="0"
                      step="0.01"
                      value={venueForm.hourly_rate}
                      onChange={(e) => setVenueForm({...venueForm, hourly_rate: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="daily_rate">Daily Rate ($)</label>
                    <input
                      type="number"
                      id="daily_rate"
                      min="0"
                      step="0.01"
                      value={venueForm.daily_rate}
                      onChange={(e) => setVenueForm({...venueForm, daily_rate: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
              </div>
              
              <div className="form-section">
                <h4>Accessibility Features</h4>
                <div className="checkbox-group">
                  <div className="checkbox-item">
                    <input
                      type="checkbox"
                      id="wheelchair_access"
                      checked={venueForm.accessibility_features.includes('wheelchair_access')}
                      onChange={() => handleAccessibilityToggle('wheelchair_access')}
                    />
                    <label htmlFor="wheelchair_access">
                      <FiWheelchair /> Wheelchair Access
                    </label>
                  </div>
                  
                  <div className="checkbox-item">
                    <input
                      type="checkbox"
                      id="hearing_loop"
                      checked={venueForm.accessibility_features.includes('hearing_loop')}
                      onChange={() => handleAccessibilityToggle('hearing_loop')}
                    />
                    <label htmlFor="hearing_loop">
                      <FiSpeaker /> Hearing Loop
                    </label>
                  </div>
                  
                  <div className="checkbox-item">
                    <input
                      type="checkbox"
                      id="vision_aids"
                      checked={venueForm.accessibility_features.includes('vision_aids')}
                      onChange={() => handleAccessibilityToggle('vision_aids')}
                    />
                    <label htmlFor="vision_aids">
                      <FiEye /> Vision Aids
                    </label>
                  </div>
                  
                  <div className="checkbox-item">
                    <input
                      type="checkbox"
                      id="accessible_restroom"
                      checked={venueForm.accessibility_features.includes('accessible_restroom')}
                      onChange={() => handleAccessibilityToggle('accessible_restroom')}
                    />
                    <label htmlFor="accessible_restroom">
                      <FiHome /> Accessible Restroom
                    </label>
                  </div>
                  
                  <div className="checkbox-item">
                    <input
                      type="checkbox"
                      id="elevator"
                      checked={venueForm.accessibility_features.includes('elevator')}
                      onChange={() => handleAccessibilityToggle('elevator')}
                    />
                    <label htmlFor="elevator">
                      <FiArrowUp /> Elevator
                    </label>
                  </div>
                  
                  <div className="checkbox-item">
                    <input
                      type="checkbox"
                      id="ramps"
                      checked={venueForm.accessibility_features.includes('ramps')}
                      onChange={() => handleAccessibilityToggle('ramps')}
                    />
                    <label htmlFor="ramps">
                      <FiCornerUpRight /> Ramps
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="form-section">
                <h4>Facilities</h4>
                <div className="checkbox-group">
                  <div className="checkbox-item">
                    <input
                      type="checkbox"
                      id="wifi"
                      checked={venueForm.facilities.includes('wifi')}
                      onChange={() => handleFacilityToggle('wifi')}
                    />
                    <label htmlFor="wifi">
                      <FiWifi /> WiFi
                    </label>
                  </div>
                  
                  <div className="checkbox-item">
                    <input
                      type="checkbox"
                      id="projector"
                      checked={venueForm.facilities.includes('projector')}
                      onChange={() => handleFacilityToggle('projector')}
                    />
                    <label htmlFor="projector">
                      <FiMonitor /> Projector
                    </label>
                  </div>
                  
                  <div className="checkbox-item">
                    <input
                      type="checkbox"
                      id="sound_system"
                      checked={venueForm.facilities.includes('sound_system'