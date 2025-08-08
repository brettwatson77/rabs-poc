import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { format, parseISO, isWithinInterval, addDays } from 'date-fns';
import { 
  FiBriefcase, 
  FiUsers, 
  FiSearch, 
  FiFilter, 
  FiPlus, 
  FiEdit2, 
  FiTrash2,
  FiCalendar,
  FiDollarSign,
  FiCheckSquare,
  FiClipboard,
  FiFileText,
  FiBarChart2,
  FiStar,
  FiPhone,
  FiMail,
  FiHome,
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
  FiAward,
  FiBook,
  FiPercent,
  FiTrendingUp,
  FiUser,
  FiImage,
  FiLock,
  FiMapPin,
  FiShield
} from 'react-icons/fi';

// API base URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3009';

// Staff Page Component
const Staff = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('directory');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    role: 'all',
    status: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isQualificationModalOpen, setIsQualificationModalOpen] = useState(false);
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);
  const [selectedProfileTab, setSelectedProfileTab] = useState('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  });
  const staffPerPage = 12;

  // Form state for creating/editing staff
  const [staffForm, setStaffForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'support_worker',
    employment_type: 'full_time',
    contract_hours: 38,
    hourly_rate: 0,
    start_date: '',
    address: '',
    suburb: '',
    state: 'NSW',
    postcode: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    photo_url: '',
    qualifications: [],
    availability: {
      monday: { available: false, start_time: '09:00', end_time: '17:00' },
      tuesday: { available: false, start_time: '09:00', end_time: '17:00' },
      wednesday: { available: false, start_time: '09:00', end_time: '17:00' },
      thursday: { available: false, start_time: '09:00', end_time: '17:00' },
      friday: { available: false, start_time: '09:00', end_time: '17:00' },
      saturday: { available: false, start_time: '09:00', end_time: '17:00' },
      sunday: { available: false, start_time: '09:00', end_time: '17:00' }
    },
    status: 'active',
    notes: ''
  });

  // Form state for adding a new qualification
  const [newQualification, setNewQualification] = useState({
    name: '',
    issuer: '',
    issue_date: '',
    expiry_date: '',
    certificate_number: '',
    type: 'certification',
    status: 'valid'
  });

  // Form state for adding a performance review
  const [newPerformanceReview, setNewPerformanceReview] = useState({
    review_date: format(new Date(), 'yyyy-MM-dd'),
    reviewer: '',
    rating: 3,
    strengths: '',
    areas_for_improvement: '',
    goals: '',
    comments: ''
  });

  // Fetch staff data
  const { 
    data: staffData, 
    isLoading: staffLoading, 
    error: staffError,
    refetch: refetchStaff
  } = useQuery(
    ['staff'],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/staff`);
      return response.data;
    }
  );

  // Fetch shifts data
  const { 
    data: shiftsData, 
    isLoading: shiftsLoading,
    refetch: refetchShifts
  } = useQuery(
    ['shifts', format(currentWeekStart, 'yyyy-MM-dd')],
    async () => {
      const endDate = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
      const response = await axios.get(`${API_URL}/api/v1/roster`, {
        params: {
          start_date: format(currentWeekStart, 'yyyy-MM-dd'),
          end_date: endDate
        }
      });
      return response.data;
    }
  );

  // Create staff mutation
  const createStaffMutation = useMutation(
    async (staffData) => {
      const response = await axios.post(`${API_URL}/api/v1/staff`, staffData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['staff']);
        setIsCreateModalOpen(false);
        resetStaffForm();
      }
    }
  );

  // Update staff mutation
  const updateStaffMutation = useMutation(
    async ({ id, staffData }) => {
      const response = await axios.put(`${API_URL}/api/v1/staff/${id}`, staffData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['staff']);
        setIsEditModalOpen(false);
      }
    }
  );

  // Delete staff mutation
  const deleteStaffMutation = useMutation(
    async (id) => {
      const response = await axios.delete(`${API_URL}/api/v1/staff/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['staff']);
        setIsDeleteModalOpen(false);
        setSelectedStaff(null);
      }
    }
  );

  // Add qualification mutation
  const addQualificationMutation = useMutation(
    async ({ staffId, qualificationData }) => {
      const response = await axios.post(`${API_URL}/api/v1/staff/${staffId}/qualifications`, qualificationData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['staff']);
        setIsQualificationModalOpen(false);
        setNewQualification({
          name: '',
          issuer: '',
          issue_date: '',
          expiry_date: '',
          certificate_number: '',
          type: 'certification',
          status: 'valid'
        });
      }
    }
  );

  // Add performance review mutation
  const addPerformanceReviewMutation = useMutation(
    async ({ staffId, reviewData }) => {
      const response = await axios.post(`${API_URL}/api/v1/staff/${staffId}/reviews`, reviewData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['staff']);
        setIsPerformanceModalOpen(false);
        setNewPerformanceReview({
          review_date: format(new Date(), 'yyyy-MM-dd'),
          reviewer: '',
          rating: 3,
          strengths: '',
          areas_for_improvement: '',
          goals: '',
          comments: ''
        });
      }
    }
  );

  // Update availability mutation
  const updateAvailabilityMutation = useMutation(
    async ({ staffId, availabilityData }) => {
      const response = await axios.put(`${API_URL}/api/v1/staff/${staffId}/availability`, availabilityData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['staff']);
      }
    }
  );

  // Reset staff form
  const resetStaffForm = () => {
    setStaffForm({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      role: 'support_worker',
      employment_type: 'full_time',
      contract_hours: 38,
      hourly_rate: 0,
      start_date: '',
      address: '',
      suburb: '',
      state: 'NSW',
      postcode: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      photo_url: '',
      qualifications: [],
      availability: {
        monday: { available: false, start_time: '09:00', end_time: '17:00' },
        tuesday: { available: false, start_time: '09:00', end_time: '17:00' },
        wednesday: { available: false, start_time: '09:00', end_time: '17:00' },
        thursday: { available: false, start_time: '09:00', end_time: '17:00' },
        friday: { available: false, start_time: '09:00', end_time: '17:00' },
        saturday: { available: false, start_time: '09:00', end_time: '17:00' },
        sunday: { available: false, start_time: '09:00', end_time: '17:00' }
      },
      status: 'active',
      notes: ''
    });
  };

  // Handle opening edit modal
  const handleEditStaff = (staff) => {
    setStaffForm({
      first_name: staff.first_name || '',
      last_name: staff.last_name || '',
      email: staff.email || '',
      phone: staff.phone || '',
      role: staff.role || 'support_worker',
      employment_type: staff.employment_type || 'full_time',
      contract_hours: staff.contract_hours || 38,
      hourly_rate: staff.hourly_rate || 0,
      start_date: staff.start_date || '',
      address: staff.address || '',
      suburb: staff.suburb || '',
      state: staff.state || 'NSW',
      postcode: staff.postcode || '',
      emergency_contact_name: staff.emergency_contact_name || '',
      emergency_contact_phone: staff.emergency_contact_phone || '',
      photo_url: staff.photo_url || '',
      qualifications: staff.qualifications || [],
      availability: staff.availability || {
        monday: { available: false, start_time: '09:00', end_time: '17:00' },
        tuesday: { available: false, start_time: '09:00', end_time: '17:00' },
        wednesday: { available: false, start_time: '09:00', end_time: '17:00' },
        thursday: { available: false, start_time: '09:00', end_time: '17:00' },
        friday: { available: false, start_time: '09:00', end_time: '17:00' },
        saturday: { available: false, start_time: '09:00', end_time: '17:00' },
        sunday: { available: false, start_time: '09:00', end_time: '17:00' }
      },
      status: staff.status || 'active',
      notes: staff.notes || ''
    });
    setIsEditModalOpen(true);
  };

  // Handle staff creation
  const handleCreateStaff = (e) => {
    e.preventDefault();
    createStaffMutation.mutate(staffForm);
  };

  // Handle staff update
  const handleUpdateStaff = (e) => {
    e.preventDefault();
    if (selectedStaff) {
      updateStaffMutation.mutate({
        id: selectedStaff.id,
        staffData: staffForm
      });
    }
  };

  // Handle staff deletion
  const handleDeleteStaff = () => {
    if (selectedStaff) {
      deleteStaffMutation.mutate(selectedStaff.id);
    }
  };

  // Handle adding a new qualification
  const handleAddQualification = (e) => {
    e.preventDefault();
    if (selectedStaff) {
      addQualificationMutation.mutate({
        staffId: selectedStaff.id,
        qualificationData: newQualification
      });
    }
  };

  // Handle adding a new performance review
  const handleAddPerformanceReview = (e) => {
    e.preventDefault();
    if (selectedStaff) {
      addPerformanceReviewMutation.mutate({
        staffId: selectedStaff.id,
        reviewData: newPerformanceReview
      });
    }
  };

  // Handle updating availability
  const handleUpdateAvailability = (day, field, value) => {
    const updatedAvailability = {
      ...staffForm.availability,
      [day]: {
        ...staffForm.availability[day],
        [field]: value
      }
    };
    setStaffForm({
      ...staffForm,
      availability: updatedAvailability
    });
  };

  // Handle saving availability
  const handleSaveAvailability = () => {
    if (selectedStaff) {
      updateAvailabilityMutation.mutate({
        staffId: selectedStaff.id,
        availabilityData: staffForm.availability
      });
    }
  };

  // Filter staff based on search term and filters
  const filteredStaff = staffData?.data?.filter(staff => {
    const matchesSearch = 
      staff.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${staff.first_name} ${staff.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filters.role === 'all' || staff.role === filters.role;
    const matchesStatus = filters.status === 'all' || staff.status === filters.status;
    
    return matchesSearch && matchesRole && matchesStatus;
  }) || [];

  // Pagination logic
  const indexOfLastStaff = currentPage * staffPerPage;
  const indexOfFirstStaff = indexOfLastStaff - staffPerPage;
  const currentStaff = filteredStaff.slice(indexOfFirstStaff, indexOfLastStaff);
  const totalPages = Math.ceil(filteredStaff.length / staffPerPage);

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

  // Get role badge class
  const getRoleBadge = (role) => {
    switch (role) {
      case 'manager':
        return 'badge-purple';
      case 'team_leader':
        return 'badge-blue';
      case 'support_worker':
        return 'badge-green';
      case 'admin':
        return 'badge-yellow';
      default:
        return 'badge-gray';
    }
  };

  // Get employment type badge class
  const getEmploymentTypeBadge = (type) => {
    switch (type) {
      case 'full_time':
        return 'badge-blue';
      case 'part_time':
        return 'badge-green';
      case 'casual':
        return 'badge-yellow';
      case 'contractor':
        return 'badge-purple';
      default:
        return 'badge-gray';
    }
  };

  // Get status badge class
  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return 'badge-green';
      case 'inactive':
        return 'badge-gray';
      case 'on_leave':
        return 'badge-yellow';
      case 'terminated':
        return 'badge-red';
      default:
        return 'badge-gray';
    }
  };

  // Get qualification status badge class
  const getQualificationStatusBadge = (status) => {
    switch (status) {
      case 'valid':
        return 'badge-green';
      case 'expired':
        return 'badge-red';
      case 'expiring_soon':
        return 'badge-yellow';
      default:
        return 'badge-gray';
    }
  };

  // Check if qualification is expiring soon (within 30 days)
  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false;
    
    const today = new Date();
    const expiry = new Date(expiryDate);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    return expiry <= thirtyDaysFromNow && expiry > today;
  };

  // Check qualification status
  const checkQualificationStatus = (qualification) => {
    if (!qualification.expiry_date) return 'valid';
    
    const today = new Date();
    const expiry = new Date(qualification.expiry_date);
    
    if (expiry < today) {
      return 'expired';
    } else if (isExpiringSoon(qualification.expiry_date)) {
      return 'expiring_soon';
    } else {
      return 'valid';
    }
  };

  // Format role for display
  const formatRole = (role) => {
    if (!role) return 'Unknown';
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Format employment type for display
  const formatEmploymentType = (type) => {
    if (!type) return 'Unknown';
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Get week dates array
  const getWeekDates = () => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      return date;
    });
  };

  // Get day name
  const getDayName = (date) => {
    return format(date, 'EEEE');
  };

  // Get shifts for staff and date
  const getShiftsForStaffAndDate = (staffId, date) => {
    if (!shiftsData || !shiftsData.data) return [];
    
    const dateStr = format(date, 'yyyy-MM-dd');
    return shiftsData.data.filter(shift => 
      shift.staff_id === staffId && shift.date === dateStr
    );
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
            placeholder="Search staff..."
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
                <label>Role</label>
                <select
                  value={filters.role}
                  onChange={(e) => setFilters({...filters, role: e.target.value})}
                >
                  <option value="all">All Roles</option>
                  <option value="manager">Manager</option>
                  <option value="team_leader">Team Leader</option>
                  <option value="support_worker">Support Worker</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_leave">On Leave</option>
                  <option value="terminated">Terminated</option>
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
          <span>New Staff</span>
        </button>
      </div>
      
      {/* Staff Grid */}
      {staffLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading staff...</p>
        </div>
      ) : staffError ? (
        <div className="error-container glass-panel">
          <FiAlertCircle className="error-icon" />
          <p>Error loading staff: {staffError.message}</p>
          <button className="btn btn-primary" onClick={() => refetchStaff()}>
            <FiRefreshCw /> Try Again
          </button>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="empty-state glass-panel">
          <FiUsers className="empty-icon" />
          <h3>No staff found</h3>
          <p>Try adjusting your search or filters, or add a new staff member.</p>
          <button 
            className="btn btn-primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <FiPlus /> Add Staff
          </button>
        </div>
      ) : (
        <>
          <div className="staff-grid">
            {currentStaff.map(staff => (
              <div 
                key={staff.id} 
                className="staff-card glass-card"
                onClick={() => setSelectedStaff(staff)}
              >
                <div className="staff-header">
                  <div className="staff-avatar">
                    {staff.photo_url ? (
                      <img src={staff.photo_url} alt={`${staff.first_name} ${staff.last_name}`} />
                    ) : (
                      <div className="staff-initials">
                        {staff.first_name?.[0]}{staff.last_name?.[0]}
                      </div>
                    )}
                  </div>
                  <div className="staff-badges">
                    <span className={`badge ${getStatusBadge(staff.status)}`}>
                      {staff.status}
                    </span>
                    <span className={`badge ${getRoleBadge(staff.role)}`}>
                      {formatRole(staff.role)}
                    </span>
                  </div>
                </div>
                
                <div className="staff-info">
                  <h3 className="staff-name">
                    {staff.first_name} {staff.last_name}
                  </h3>
                  <p className="staff-employment">
                    <span className={`badge ${getEmploymentTypeBadge(staff.employment_type)}`}>
                      {formatEmploymentType(staff.employment_type)}
                    </span>
                    {staff.contract_hours && (
                      <span className="contract-hours">
                        {staff.contract_hours} hrs/week
                      </span>
                    )}
                  </p>
                  <p className="staff-rate">
                    <FiDollarSign className="icon" />
                    {formatCurrency(staff.hourly_rate)}/hr
                  </p>
                </div>
                
                <div className="staff-footer">
                  <div className="staff-contact">
                    {staff.phone && (
                      <div className="contact-item">
                        <FiPhone className="contact-icon" />
                        <span>{staff.phone}</span>
                      </div>
                    )}
                    {staff.email && (
                      <div className="contact-item">
                        <FiMail className="contact-icon" />
                        <span>{staff.email}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="staff-actions">
                    <button 
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditStaff(staff);
                      }}
                      title="Edit"
                    >
                      <FiEdit2 />
                    </button>
                    <button 
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStaff(staff);
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
      
      {/* Staff Profile View */}
      {selectedStaff && (
        <div className="modal-overlay" onClick={() => setSelectedStaff(null)}>
          <div className="modal-content staff-profile-modal glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Staff Profile</h3>
              <button className="modal-close" onClick={() => setSelectedStaff(null)}>
                <FiXCircle />
              </button>
            </div>
            
            <div className="staff-profile">
              <div className="profile-header">
                <div className="profile-avatar">
                  {selectedStaff.photo_url ? (
                    <img src={selectedStaff.photo_url} alt={`${selectedStaff.first_name} ${selectedStaff.last_name}`} />
                  ) : (
                    <div className="profile-initials">
                      {selectedStaff.first_name?.[0]}{selectedStaff.last_name?.[0]}
                    </div>
                  )}
                </div>
                
                <div className="profile-info">
                  <h2>{selectedStaff.first_name} {selectedStaff.last_name}</h2>
                  <div className="profile-badges">
                    <span className={`badge ${getRoleBadge(selectedStaff.role)}`}>
                      {formatRole(selectedStaff.role)}
                    </span>
                    <span className={`badge ${getEmploymentTypeBadge(selectedStaff.employment_type)}`}>
                      {formatEmploymentType(selectedStaff.employment_type)}
                    </span>
                    <span className={`badge ${getStatusBadge(selectedStaff.status)}`}>
                      {selectedStaff.status}
                    </span>
                  </div>
                </div>
                
                <div className="profile-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditStaff(selectedStaff);
                    }}
                  >
                    <FiEdit2 /> Edit Profile
                  </button>
                </div>
              </div>
              
              <div className="profile-tabs">
                <button 
                  className={`profile-tab-btn ${selectedProfileTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setSelectedProfileTab('overview')}
                >
                  <FiUser />
                  <span>Overview</span>
                </button>
                <button 
                  className={`profile-tab-btn ${selectedProfileTab === 'qualifications' ? 'active' : ''}`}
                  onClick={() => setSelectedProfileTab('qualifications')}
                >
                  <FiAward />
                  <span>Qualifications</span>
                </button>
                <button 
                  className={`profile-tab-btn ${selectedProfileTab === 'availability' ? 'active' : ''}`}
                  onClick={() => setSelectedProfileTab('availability')}
                >
                  <FiCalendar />
                  <span>Availability</span>
                </button>
                <button 
                  className={`profile-tab-btn ${selectedProfileTab === 'performance' ? 'active' : ''}`}
                  onClick={() => setSelectedProfileTab('performance')}
                >
                  <FiTrendingUp />
                  <span>Performance</span>
                </button>
              </div>
              
              <div className="profile-content">
                {selectedProfileTab === 'overview' && (
                  <div className="profile-overview">
                    <div className="profile-section glass-card">
                      <h4>Contact Information</h4>
                      <div className="profile-details">
                        <div className="detail-item">
                          <FiMail className="detail-icon" />
                          <div className="detail-content">
                            <span className="detail-label">Email</span>
                            <span className="detail-value">{selectedStaff.email || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="detail-item">
                          <FiPhone className="detail-icon" />
                          <div className="detail-content">
                            <span className="detail-label">Phone</span>
                            <span className="detail-value">{selectedStaff.phone || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="detail-item">
                          <FiHome className="detail-icon" />
                          <div className="detail-content">
                            <span className="detail-label">Address</span>
                            <span className="detail-value">
                              {selectedStaff.address ? (
                                <>
                                  {selectedStaff.address}, {selectedStaff.suburb}, {selectedStaff.state} {selectedStaff.postcode}
                                </>
                              ) : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="profile-section glass-card">
                      <h4>Employment Details</h4>
                      <div className="profile-details">
                        <div className="detail-item">
                          <FiBriefcase className="detail-icon" />
                          <div className="detail-content">
                            <span className="detail-label">Role</span>
                            <span className="detail-value">{formatRole(selectedStaff.role)}</span>
                          </div>
                        </div>
                        <div className="detail-item">
                          <FiClock className="detail-icon" />
                          <div className="detail-content">
                            <span className="detail-label">Employment Type</span>
                            <span className="detail-value">{formatEmploymentType(selectedStaff.employment_type)}</span>
                          </div>
                        </div>
                        <div className="detail-item">
                          <FiCalendar className="detail-icon" />
                          <div className="detail-content">
                            <span className="detail-label">Start Date</span>
                            <span className="detail-value">{formatDate(selectedStaff.start_date)}</span>
                          </div>
                        </div>
                        <div className="detail-item">
                          <FiClock className="detail-icon" />
                          <div className="detail-content">
                            <span className="detail-label">Contract Hours</span>
                            <span className="detail-value">{selectedStaff.contract_hours || 0} hours/week</span>
                          </div>
                        </div>
                        <div className="detail-item">
                          <FiDollarSign className="detail-icon" />
                          <div className="detail-content">
                            <span className="detail-label">Hourly Rate</span>
                            <span className="detail-value">{formatCurrency(selectedStaff.hourly_rate)}/hour</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="profile-section glass-card">
                      <h4>Emergency Contact</h4>
                      <div className="profile-details">
                        <div className="detail-item">
                          <FiUser className="detail-icon" />
                          <div className="detail-content">
                            <span className="detail-label">Name</span>
                            <span className="detail-value">{selectedStaff.emergency_contact_name || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="detail-item">
                          <FiPhone className="detail-icon" />
                          <div className="detail-content">
                            <span className="detail-label">Phone</span>
                            <span className="detail-value">{selectedStaff.emergency_contact_phone || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="profile-section glass-card">
                      <h4>Notes</h4>
                      <div className="notes-content">
                        {selectedStaff.notes ? (
                          <p>{selectedStaff.notes}</p>
                        ) : (
                          <p className="text-muted">No notes available for this staff member.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedProfileTab === 'qualifications' && (
                  <div className="profile-qualifications">
                    <div className="profile-section glass-card">
                      <div className="section-header">
                        <h4>Qualifications & Certifications</h4>
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => setIsQualificationModalOpen(true)}
                        >
                          <FiPlus /> Add Qualification
                        </button>
                      </div>
                      
                      {selectedStaff.qualifications?.length > 0 ? (
                        <div className="qualifications-list">
                          {selectedStaff.qualifications.map((qualification, index) => {
                            const status = checkQualificationStatus(qualification);
                            return (
                              <div key={index} className="qualification-item">
                                <div className="qualification-header">
                                  <h5>{qualification.name}</h5>
                                  <span className={`badge ${getQualificationStatusBadge(status)}`}>
                                    {status === 'valid' ? 'Valid' : status === 'expired' ? 'Expired' : 'Expiring Soon'}
                                  </span>
                                </div>
                                <div className="qualification-details">
                                  <div className="qualification-detail">
                                    <FiBook className="detail-icon" />
                                    <span>Issued by {qualification.issuer}</span>
                                  </div>
                                  <div className="qualification-detail">
                                    <FiCalendar className="detail-icon" />
                                    <span>Issued: {formatDate(qualification.issue_date)}</span>
                                  </div>
                                  {qualification.expiry_date && (
                                    <div className="qualification-detail">
                                      <FiCalendar className="detail-icon" />
                                      <span>Expires: {formatDate(qualification.expiry_date)}</span>
                                    </div>
                                  )}
                                  {qualification.certificate_number && (
                                    <div className="qualification-detail">
                                      <FiTag className="detail-icon" />
                                      <span>Certificate #: {qualification.certificate_number}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-muted">No qualifications recorded for this staff member.</p>
                      )}
                    </div>
                    
                    <div className="profile-section glass-card">
                      <h4>Required Qualifications</h4>
                      <div className="required-qualifications">
                        <div className="required-qualification-item">
                          <div className="qualification-name">
                            <FiShield className="icon" />
                            <span>Working with Children Check</span>
                          </div>
                          <div className="qualification-status">
                            {selectedStaff.qualifications?.some(q => 
                              q.name?.toLowerCase().includes('working with children') && 
                              checkQualificationStatus(q) === 'valid'
                            ) ? (
                              <span className="badge badge-green">Valid</span>
                            ) : (
                              <span className="badge badge-red">Missing</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="required-qualification-item">
                          <div className="qualification-name">
                            <FiShield className="icon" />
                            <span>Police Check</span>
                          </div>
                          <div className="qualification-status">
                            {selectedStaff.qualifications?.some(q => 
                              q.name?.toLowerCase().includes('police check') && 
                              checkQualificationStatus(q) === 'valid'
                            ) ? (
                              <span className="badge badge-green">Valid</span>
                            ) : (
                              <span className="badge badge-red">Missing</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="required-qualification-item">
                          <div className="qualification-name">
                            <FiShield className="icon" />
                            <span>First Aid Certificate</span>
                          </div>
                          <div className="qualification-status">
                            {selectedStaff.qualifications?.some(q => 
                              q.name?.toLowerCase().includes('first aid') && 
                              checkQualificationStatus(q) === 'valid'
                            ) ? (
                              <span className="badge badge-green">Valid</span>
                            ) : (
                              <span className="badge badge-red">Missing</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedProfileTab === 'availability' && (
                  <div className="profile-availability">
                    <div className="profile-section glass-card">
                      <h4>Weekly Availability</h4>
                      <div className="availability-editor">
                        {Object.keys(staffForm.availability || {}).map(day => (
                          <div key={day} className="availability-day">
                            <div className="day-header">
                              <span className="day-name">{day.charAt(0).toUpperCase() + day.slice(1)}</span>
                              <div className="day-toggle">
                                <input
                                  type="checkbox"
                                  id={`available-${day}`}
                                  checked={staffForm.availability[day].available}
                                  onChange={(e) => handleUpdateAvailability(day, 'available', e.target.checked)}
                                />
                                <label htmlFor={`available-${day}`}>
                                  {staffForm.availability[day].available ? 'Available' : 'Unavailable'}
                                </label>
                              </div>
                            </div>
                            
                            {staffForm.availability[day].available && (
                              <div className="time-range">
                                <div className="time-input">
                                  <label>From</label>
                                  <input
                                    type="time"
                                    value={staffForm.availability[day].start_time}
                                    onChange={(e) => handleUpdateAvailability(day, 'start_time', e.target.value)}
                                  />
                                </div>
                                <div className="time-input">
                                  <label>To</label>
                                  <input
                                    type="time"
                                    value={staffForm.availability[day].end_time}
                                    onChange={(e) => handleUpdateAvailability(day, 'end_time', e.target.value)}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      <div className="availability-actions">
                        <button 
                          className="btn btn-primary"
                          onClick={handleSaveAvailability}
                          disabled={updateAvailabilityMutation.isLoading}
                        >
                          {updateAvailabilityMutation.isLoading ? (
                            <>
                              <div className="loading-spinner-small"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <FiSave /> Save Availability
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div className="profile-section glass-card">
                      <div className="section-header">
                        <h4>Current Week Schedule</h4>
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
                      </div>
                      
                      {shiftsLoading ? (
                        <div className="loading-container">
                          <div className="loading-spinner-small"></div>
                          <p>Loading schedule...</p>
                        </div>
                      ) : (
                        <div className="weekly-schedule">
                          {getWeekDates().map((date, index) => {
                            const dayName = getDayName(date).toLowerCase();
                            const isAvailable = selectedStaff.availability?.[dayName]?.available;
                            const shifts = getShiftsForStaffAndDate(selectedStaff.id, date);
                            
                            return (
                              <div key={index} className="schedule-day">
                                <div className={`day-header ${isAvailable ? 'available' : 'unavailable'}`}>
                                  <span className="day-name">{format(date, 'EEE')}</span>
                                  <span className="day-date">{format(date, 'd MMM')}</span>
                                </div>
                                
                                <div className="day-shifts">
                                  {shifts.length > 0 ? (
                                    shifts.map((shift, shiftIndex) => (
                                      <div key={shiftIndex} className="shift-item">
                                        <div className="shift-time">
                                          {shift.start_time} - {shift.end_time}
                                        </div>
                                        <div className="shift-details">
                                          <span className="shift-program">{shift.program_name || 'Unassigned'}</span>
                                          <span className="shift-venue">{shift.venue_name || 'No venue'}</span>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="no-shifts">
                                      {isAvailable ? 'No shifts scheduled' : 'Unavailable'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {selectedProfileTab === 'performance' && (
                  <div className="profile-performance">
                    <div className="profile-section glass-card">
                      <div className="section-header">
                        <h4>Performance Reviews</h4>
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => setIsPerformanceModalOpen(true)}
                        >
                          <FiPlus /> Add Review
                        </button>
                      </div>
                      
                      {selectedStaff.performance_reviews?.length > 0 ? (
                        <div className="performance-reviews-list">
                          {selectedStaff.performance_reviews.map((review, index) => (
                            <div key={index} className="performance-review-item">
                              <div className="review-header">
                                <div className="review-date">
                                  <FiCalendar className="icon" />
                                  <span>{formatDate(review.review_date)}</span>
                                </div>
                                <div className="review-rating">
                                  {Array.from({ length: 5 }, (_, i) => (
                                    <FiStar 
                                      key={i} 
                                      className={i < review.rating ? 'star-filled' : 'star-empty'} 
                                    />
                                  ))}
                                </div>
                              </div>
                              
                              <div className="review-content">
                                <div className="review-section">
                                  <h5>Strengths</h5>
                                  <p>{review.strengths || 'None specified'}</p>
                                </div>
                                
                                <div className="review-section">
                                  <h5>Areas for Improvement</h5>
                                  <p>{review.areas_for_improvement || 'None specified'}</p>
                                </div>
                                
                                <div className="review-section">
                                  <h5>Goals</h5>
                                  <p>{review.goals || 'None specified'}</p>
                                </div>
                                
                                <div className="review-section">
                                  <h5>Comments</h5>
                                  <p>{review.comments || 'No comments'}</p>
                                </div>
                              </div>
                              
                              <div className="review-footer">
                                <span className="reviewer">
                                  Reviewed by: {review.reviewer || 'Unknown'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted">No performance reviews recorded for this staff member.</p>
                      )}
                    </div>
                    
                    <div className="profile-section glass-card">
                      <h4>Performance Metrics</h4>
                      <div className="performance-metrics">
                        <div className="metric-item">
                          <div className="metric-header">
                            <span className="metric-name">Attendance Rate</span>
                            <span className="metric-value">98%</span>
                          </div>
                          <div className="metric-progress">
                            <div className="progress-bar" style={{ width: '98%' }}></div>
                          </div>
                        </div>
                        
                        <div className="metric-item">
                          <div className="metric-header">
                            <span className="metric-name">Shift Completion</span>
                            <span className="metric-value">100%</span>
                          </div>
                          <div className="metric-progress">
                            <div className="progress-bar" style={{ width: '100%' }}></div>
                          </div>
                        </div>
                        
                        <div className="metric-item">
                          <div className="metric-header">
                            <span className="metric-name">Documentation Compliance</span>
                            <span className="metric-value">92%</span>
                          </div>
                          <div className="metric-progress">
                            <div className="progress-bar" style={{ width: '92%' }}></div>
                          </div>
                        </div>
                        
                        <div className="metric-item">
                          <div className="metric-header">
                            <span className="metric-name">Training Completion</span>
                            <span className="metric-value">85%</span>
                          </div>
                          <div className="metric-progress">
                            <div className="progress-bar" style={{ width: '85%' }}></div>
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
    </div>
  );

  // Render qualifications tab content
  const renderQualificationsTab = () => (
    <div className="qualifications-tab">
      <div className="qualifications-header glass-panel">
        <h3>Staff Qualifications</h3>
        <p>Track and manage staff qualifications, certifications, and compliance.</p>
        
        <div className="search-container">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search qualifications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>
      
      <div className="qualifications-summary glass-card">
        <div className="summary-item">
          <div className="summary-icon valid">
            <FiCheckCircle />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {staffData?.data?.reduce((count, staff) => {
                const validQuals = staff.qualifications?.filter(q => checkQualificationStatus(q) === 'valid') || [];
                return count + validQuals.length;
              }, 0) || 0}
            </div>
            <div className="summary-label">Valid Qualifications</div>
          </div>
        </div>
        
        <div className="summary-item">
          <div className="summary-icon expiring">
            <FiAlertCircle />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {staffData?.data?.reduce((count, staff) => {
                const expiringQuals = staff.qualifications?.filter(q => checkQualificationStatus(q) === 'expiring_soon') || [];
                return count + expiringQuals.length;
              }, 0) || 0}
            </div>
            <div className="summary-label">Expiring Soon</div>
          </div>
        </div>
        
        <div className="summary-item">
          <div className="summary-icon expired">
            <FiXCircle />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {staffData?.data?.reduce((count, staff) => {
                const expiredQuals = staff.qualifications?.filter(q => checkQualificationStatus(q) === 'expired') || [];
                return count + expiredQuals.length;
              }, 0) || 0}
            </div>
            <div className="summary-label">Expired</div>
          </div>
        </div>
        
        <div className="summary-item">
          <div className="summary-icon compliance">
            <FiPercent />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {staffData?.data?.length > 0 ? 
                Math.round(
                  (staffData.data.filter(staff => 
                    staff.qualifications?.some(q => 
                      q.name?.toLowerCase().includes('working with children') && 
                      checkQualificationStatus(q) === 'valid'
                    ) &&
                    staff.qualifications?.some(q => 
                      q.name?.toLowerCase().includes('police check') && 
                      checkQualificationStatus(q) === 'valid'
                    )
                  ).length / staffData.data.length) * 100
                ) : 0}%
            </div>
            <div className="summary-label">Compliance Rate</div>
          </div>
        </div>
      </div>
      
      <div className="qualifications-table glass-card">
        <h4>Qualification Tracking</h4>
        
        {staffLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading qualifications...</p>
          </div>
        ) : staffError ? (
          <div className="error-container">
            <FiAlertCircle className="error-icon" />
            <p>Error loading qualifications: {staffError.message}</p>
            <button className="btn btn-primary" onClick={() => refetchStaff()}>
              <FiRefreshCw /> Try Again
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="qualifications-tracking-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Working with Children</th>
                  <th>Police Check</th>
                  <th>First Aid</th>
                  <th>Other Qualifications</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map(staff => {
                  const wwccQual = staff.qualifications?.find(q => 
                    q.name?.toLowerCase().includes('working with children')
                  );
                  const policeQual = staff.qualifications?.find(q => 
                    q.name?.toLowerCase().includes('police check')
                  );
                  const firstAidQual = staff.qualifications?.find(q => 
                    q.name?.toLowerCase().includes('first aid')
                  );
                  const otherQuals = staff.qualifications?.filter(q => 
                    !q.name?.toLowerCase().includes('working with children') && 
                    !q.name?.toLowerCase().includes('police check') && 
                    !q.name?.toLowerCase().includes('first aid')
                  ) || [];
                  
                  return (
                    <tr key={staff.id}>
                      <td>
                        <div className="staff-name-cell">
                          <div className="staff-avatar-small">
                            {staff.photo_url ? (
                              <img src={staff.photo_url} alt={`${staff.first_name} ${staff.last_name}`} />
                            ) : (
                              <div className="staff-initials-small">
                                {staff.first_name?.[0]}{staff.last_name?.[0]}
                              </div>
                            )}
                          </div>
                          <div className="staff-name">
                            {staff.first_name} {staff.last_name}
                          </div>
                        </div>
                      </td>
                      <td>
                        {wwccQual ? (
                          <div className="qualification-cell">
                            <span className={`badge ${getQualificationStatusBadge(checkQualificationStatus(wwccQual))}`}>
                              {checkQualificationStatus(wwccQual) === 'valid' ? 'Valid' : 
                               checkQualificationStatus(wwccQual) === 'expired' ? 'Expired' : 'Expiring Soon'}
                            </span>
                            <span className="expiry-date">
                              {wwccQual.expiry_date ? `Expires: ${formatDate(wwccQual.expiry_date)}` : 'No expiry'}
                            </span>
                          </div>
                        ) : (
                          <span className="badge badge-red">Missing</span>
                        )}
                      </td>
                      <td>
                        {policeQual ? (
                          <div className="qualification-cell">
                            <span className={`badge ${getQualificationStatusBadge(checkQualificationStatus(policeQual))}`}>
                              {checkQualificationStatus(policeQual) === 'valid' ? 'Valid' : 
                               checkQualificationStatus(policeQual) === 'expired' ? 'Expired' : 'Expiring Soon'}
                            </span>
                            <span className="expiry-date">
                              {policeQual.expiry_date ? `Expires: ${formatDate(policeQual.expiry_date)}` : 'No expiry'}
                            </span>
                          </div>
                        ) : (
                          <span className="badge badge-red">Missing</span>
                        )}
                      </td>
                      <td>
                        {firstAidQual ? (
                          <div className="qualification-cell">
                            <span className={`badge ${getQualificationStatusBadge(checkQualificationStatus(firstAidQual))}`}>
                              {checkQualificationStatus(firstAidQual) === 'valid' ? 'Valid' : 
                               checkQualificationStatus(firstAidQual) === 'expired' ? 'Expired' : 'Expiring Soon'}
                            </span>
                            <span className="expiry-date">
                              {firstAidQual.expiry_date ? `Expires: ${formatDate(firstAidQual.expiry_date)}` : 'No expiry'}
                            </span>
                          </div>
                        ) : (
                          <span className="badge badge-red">Missing</span>
                        )}
                      </td>
                      <td>
                        {otherQuals.length > 0 ? (
                          <div className="other-qualifications">
                            {otherQuals.map((qual, index) => (
                              <div key={index} className="other-qual-item">
                                <span className="qual-name">{qual.name}</span>
                                <span className={`badge ${getQualificationStatusBadge(checkQualificationStatus(qual))}`}>
                                  {checkQualificationStatus(qual) === 'valid' ? 'Valid' : 
                                   checkQualificationStatus(qual) === 'expired' ? 'Expired' : 'Expiring Soon'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="btn btn-sm"
                            onClick={() => {
                              setSelectedStaff(staff);
                              setSelectedProfileTab('qualifications');
                            }}
                          >
                            <FiEdit2 /> Manage
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <div className="expiring-qualifications glass-card">
        <h4>Expiring Qualifications</h4>
        
        {staffLoading ? (
          <div className="loading-container">
            <div className="loading-spinner-small"></div>
            <p>Loading expiring qualifications...</p>
          </div>
        ) : (
          <div className="expiring-list">
            {staffData?.data?.flatMap(staff => 
              (staff.qualifications || [])
                .filter(qual => checkQualificationStatus(qual) === 'expiring_soon')
                .map((qual, index) => ({
                  staffId: staff.id,
                  staffName: `${staff.first_name} ${staff.last_name}`,
                  staffPhoto: staff.photo_url,
                  qualification: qual
                }))
            ).length > 0 ? (
              staffData?.data?.flatMap(staff => 
                (staff.qualifications || [])
                  .filter(qual => checkQualificationStatus(qual) === 'expiring_soon')
                  .map((qual, index) => (
                    <div key={`${staff.id}-${index}`} className="expiring-item">
                      <div className="staff-info">
                        <div className="staff-avatar-small">
                          {staff.photo_url ? (
                            <img src={staff.photo_url} alt={`${staff.first_name} ${staff.last_name}`} />
                          ) : (
                            <div className="staff-initials-small">
                              {staff.first_name?.[0]}{staff.last_name?.[0]}
                            </div>
                          )}
                        </div>
                        <span>{staff.first_name} {staff.last_name}</span>
                      </div>
                      <div className="qualification-info">
                        <span className="qual-name">{qual.name}</span>
                        <span className="expiry-date">Expires: {formatDate(qual.expiry_date)}</span>
                      </div>
                      <button 
                        className="btn btn-sm"
                        onClick={() => {
                          setSelectedStaff(staff);
                          setSelectedProfileTab('qualifications');
                        }}
                      >
                        <FiEdit2 /> Update
                      </button>
                    </div>
                  ))
              )
            ) : (
              <div className="empty-state-small">
                <FiCheckCircle className="success-icon" />
                <p>No qualifications expiring soon.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Render availability tab content
  const renderAvailabilityTab = () => (
    <div className="availability-tab">
      <div className="availability-header glass-panel">
        <h3>Staff Availability</h3>
        <p>View and manage staff availability for scheduling.</p>
        
        <div className="week-navigation">
          <button className="btn btn-secondary" onClick={handlePrevWeek}>
            <FiArrowLeft /> Previous Week
          </button>
          <span className="week-label">
            {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
          </span>
          <button className="btn btn-secondary" onClick={handleNextWeek}>
            Next Week <FiArrowRight />
          </button>
        </div>
      </div>
      
      {staffLoading || shiftsLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading availability data...</p>
        </div>
      ) : staffError ? (
        <div className="error-container glass-panel">
          <FiAlertCircle className="error-icon" />
          <p>Error loading staff data: {staffError.message}</p>
          <button className="btn btn-primary" onClick={() => refetchStaff()}>
            <FiRefreshCw /> Try Again
          </button>
        </div>
      ) : (
        <div className="availability-grid glass-card">
          <div className="availability-table">
            <div className="availability-header-row">
              <div className="staff-column">Staff</div>
              {getWeekDates().map((date, index) => (
                <div key={index} className="day-column">
                  <div className="day-name">{format(date, 'EEE')}</div>
                  <div className="day-date">{format(date, 'd MMM')}</div>
                </div>
              ))}
            </div>
            
            {filteredStaff.map(staff => (
              <div key={staff.id} className="availability-row">
                <div className="staff-column">
                  <div className="staff-info">
                    <div className="staff-avatar-small">
                      {staff.photo_url ? (
                        <img src={staff.photo_url} alt={`${staff.first_name} ${staff.last_name}`} />
                      ) : (
                        <div className="staff-initials-small">
                          {staff.first_name?.[0]}{staff.last_name?.[0]}
                        </div>
                      )}
                    </div>
                    <div className="staff-details">
                      <div className="staff-name">{staff.first_name} {staff.last_name}</div>
                      <div className="staff-role">{formatRole(staff.role)}</div>
                    </div>
                  </div>
                </div>
                
                {getWeekDates().map((date, index) => {
                  const dayName = format(date, 'EEEE').toLowerCase();
                  const isAvailable = staff.availability?.[dayName]?.available;
                  const shifts = getShiftsForStaffAndDate(staff.id, date);
                  
                  return (
                    <div 
                      key={index} 
                      className={`day-column ${isAvailable ? 'available' : 'unavailable'}`}
                      onClick={() => {
                        setSelectedStaff(staff);
                        setSelectedProfileTab('availability');
                      }}
                    >
                      {isAvailable && (
                        <div className="availability-time">
                          {staff.availability[dayName].start_time} - {staff.availability[dayName].end_time}
                        </div>
                      )}
                      
                      {shifts.length > 0 && (
                        <div className="shift-indicators">
                          {shifts.map((shift, shiftIndex) => (
                            <div key={shiftIndex} className="shift-indicator" title={`${shift.program_name || 'Unassigned'}: ${shift.start_time} - ${shift.end_time}`}>
                              <FiCalendar />
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {!isAvailable && <div className="unavailable-text">Unavailable</div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="availability-legend glass-card">
        <h4>Legend</h4>
        <div className="legend-items">
          <div className="legend-item">
            <div className="legend-color available"></div>
            <span>Available</span>
          </div>
          <div className="legend-item">
            <div className="legend-color unavailable"></div>
            <span>Unavailable</span>
          </div>
          <div className="legend-item">
            <div className="legend-icon">
              <FiCalendar />
            </div>
            <span>Scheduled Shift</span>
          </div>
        </div>
      </div>
      
      <div className="availability-actions glass-card">
        <h4>Quick Actions</h4>
        <div className="action-buttons">
          <button className="btn btn-primary">
            <FiDownload /> Export Schedule
          </button>
          <button className="btn btn-secondary">
            <FiPrinter /> Print View
          </button>
          <button className="btn btn-secondary">
            <FiRefreshCw /> Refresh Data
          </button>
        </div>
      </div>
    </div>
  );

  // Render reports tab content
  const renderReportsTab = () => (
    <div className="reports-tab">
      <div className="reports-header glass-panel">
        <h3>Staff Reports</h3>
        <p>Generate and view reports for staff management and compliance.</p>
      </div>
      
      <div className="reports-grid">
        <div className="report-card glass-card">
          <div className="report-icon">
            <FiUsers />
          </div>
          <div className="report-content">
            <h4>Staff Directory Report</h4>
            <p>Generate a comprehensive report of all staff members and their details.</p>
            <button className="btn btn-primary">
              <FiFileText /> Generate Report
            </button>
          </div>
        </div>
        
        <div className="report-card glass-card">
          <div className="report-icon">
            <FiAward />
          </div>
          <div className="report-content">
            <h4>Qualifications Compliance Report</h4>
            <p>Track staff qualification status and compliance requirements.</p>
            <button className="btn btn-primary">
              <FiFileText /> Generate Report
            </button>
          </div>
        </div>
        
        <div className="report-card glass-card">
          <div className="report-icon">
            <FiClock />
          </div>
          <div className="report-content">
            <h4>Hours & Availability Report</h4>
            <p>View staff hours, availability, and scheduling statistics.</p>
            <button className="btn btn-primary">
              <FiFileText /> Generate Report
            </button>
          </div>
        </div>
        
        <div className="report-card glass-card">
          <div className="report-icon">
            <FiTrendingUp />
          </div>
          <div className="report-content">
            <h4>Performance & Reviews Report</h4>
            <p>Analyze staff performance metrics and review history.</p>
            <button className="btn btn-primary">
              <FiFileText /> Generate Report
            </button>
          </div>
        </div>
      </div>
      
      <div className="export-options glass-panel">
        <h4>Export Options</h4>
        <div className="export-buttons">
          <button className="btn btn-secondary">
            <FiDownload /> Export to Excel
          </button>
          <button className="btn btn-secondary">
            <FiDownload /> Export to PDF
          </button>
          <button className="btn btn-secondary">
            <FiPrinter /> Print Reports
          </button>
        </div>
      </div>
    </div>
  );

// Truncated modal stubs
const renderCreateModal = () => null;
const renderEditModal = () => null;
const renderDeleteModal = () => null;

// Ensure component returns something if not already returned above
return null;
};

export default Staff;
