import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { format, startOfWeek, addDays } from 'date-fns';
import { 
  FiUser, 
  FiUsers, 
  FiSearch, 
  FiFilter, 
  FiPlus, 
  FiEdit2, 
  FiTrash2,
  FiCalendar,
  FiDollarSign,
  FiCheckSquare,
  FiTarget,
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
  FiUpload
} from 'react-icons/fi';

// External modal components
import CreateParticipantModal from './participants/modals/CreateParticipantModal';
import EditParticipantModal from './participants/modals/EditParticipantModal';
import DeleteParticipantModal from './participants/modals/DeleteParticipantModal';

// API base URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3009';

// Participants Page Component
const Participants = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('directory');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    supportLevel: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedPlanTab, setSelectedPlanTab] = useState('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const participantsPerPage = 12;

  /* ------------------------------------------------------------------
   * Weekly planner (minimal — uses existing /master-schedule/instances)
   * ------------------------------------------------------------------ */
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date()));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(selectedWeek, i));
  const formatISODate = (d) => d.toISOString().split('T')[0];

  const [instances, setInstances] = useState([]);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const [instancesError, setInstancesError] = useState('');

  useEffect(() => {
    const fetchInstances = async () => {
      setInstancesLoading(true);
      setInstancesError('');
      try {
        const res = await axios.get(`${API_URL}/api/v1/master-schedule/instances`, {
          params: {
            startDate: formatISODate(weekDays[0]),
            endDate: formatISODate(weekDays[6])
          }
        });
        setInstances(res?.data?.data || []);
      } catch (e) {
        setInstancesError('Failed to load weekly program instances.');
      } finally {
        setInstancesLoading(false);
      }
    };
    fetchInstances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek]);

  const prevWeek = () => setSelectedWeek(addDays(selectedWeek, -7));
  const nextWeek = () => setSelectedWeek(addDays(selectedWeek, 7));

  const instancesForDate = (day) => {
    const d = formatISODate(day);
    return instances.filter((i) => typeof i.date === 'string' && i.date.includes(d));
  };

  // Form state for creating/editing participant
  const [participantForm, setParticipantForm] = useState({
    first_name: '',
    last_name: '',
    ndis_number: '',
    date_of_birth: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    suburb: '',
    state: 'NSW',
    postcode: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    support_level: 'standard',
    status: 'active',
    notes: '',
    billing_codes: []
  });

  // Form state for adding a new goal
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    target_date: '',
    category: 'independence',
    status: 'not_started'
  });

  // Form state for adding a new billing code
  const [newBillingCode, setNewBillingCode] = useState({
    code: '',
    description: '',
    rate: '',
    total_amount: '',
    remaining_amount: '',
    start_date: '',
    end_date: ''
  });

  // Fetch participants data
  const { 
    data: participantsData, 
    isLoading: participantsLoading, 
    error: participantsError,
    refetch: refetchParticipants
  } = useQuery(
    ['participants'],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/participants`);
      return response.data;
    }
  );


  // Enroll participant in program mutation
  const enrollParticipantMutation = useMutation(
    async ({ participantId, programId }) => {
      const response = await axios.post(`${API_URL}/api/v1/participants/${participantId}/programs/${programId}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['participants']);
      }
    }
  );

  // Reset participant form
  const resetParticipantForm = () => {
    setParticipantForm({
      first_name: '',
      last_name: '',
      ndis_number: '',
      date_of_birth: '',
      gender: '',
      phone: '',
      email: '',
      address: '',
      suburb: '',
      state: 'NSW',
      postcode: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      support_level: 'standard',
      status: 'active',
      notes: '',
      billing_codes: []
    });
  };

  // Handle opening edit modal
  const handleEditParticipant = (participant) => {
    setParticipantForm({
      first_name: participant.first_name || '',
      last_name: participant.last_name || '',
      ndis_number: participant.ndis_number || '',
      date_of_birth: participant.date_of_birth || '',
      gender: participant.gender || '',
      phone: participant.phone || '',
      email: participant.email || '',
      address: participant.address || '',
      suburb: participant.suburb || '',
      state: participant.state || 'NSW',
      postcode: participant.postcode || '',
      emergency_contact_name: participant.emergency_contact_name || '',
      emergency_contact_phone: participant.emergency_contact_phone || '',
      support_level: participant.support_level || 'standard',
      status: participant.status || 'active',
      notes: participant.notes || '',
      billing_codes: participant.billing_codes || []
    });
    setIsEditModalOpen(true);
  };

  // Handle participant creation
  const handleCreateParticipant = (e) => {
    e.preventDefault();
    createParticipantMutation.mutate(participantForm);
  };

  // Handle participant update
  const handleUpdateParticipant = (e) => {
    e.preventDefault();
    if (selectedParticipant) {
      updateParticipantMutation.mutate({
        id: selectedParticipant.id,
        participantData: participantForm
      });
    }
  };

  // Handle participant deletion
  const handleDeleteParticipant = () => {
    if (selectedParticipant) {
      deleteParticipantMutation.mutate(selectedParticipant.id);
    }
  };

  // Handle adding a new goal
  const handleAddGoal = (e) => {
    e.preventDefault();
    if (selectedParticipant) {
      addGoalMutation.mutate({
        participantId: selectedParticipant.id,
        goalData: newGoal
      });
    }
  };

  // Handle adding a new billing code
  const handleAddBillingCode = (e) => {
    e.preventDefault();
    if (selectedParticipant) {
      addBillingCodeMutation.mutate({
        participantId: selectedParticipant.id,
        billingCodeData: newBillingCode
      });
    }
  };

  // Handle enrolling participant in a program
  const handleEnrollParticipant = (programId) => {
    if (selectedParticipant) {
      enrollParticipantMutation.mutate({
        participantId: selectedParticipant.id,
        programId
      });
    }
  };

  // Filter participants based on search term and filters
  const filteredParticipants = participantsData?.data?.filter(participant => {
    const matchesSearch = 
      participant.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participant.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participant.ndis_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${participant.first_name} ${participant.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filters.status === 'all' || participant.status === filters.status;
    const matchesSupportLevel = filters.supportLevel === 'all' || participant.support_level === filters.supportLevel;
    
    return matchesSearch && matchesStatus && matchesSupportLevel;
  }) || [];

  // Pagination logic
  const indexOfLastParticipant = currentPage * participantsPerPage;
  const indexOfFirstParticipant = indexOfLastParticipant - participantsPerPage;
  const currentParticipants = filteredParticipants.slice(indexOfFirstParticipant, indexOfLastParticipant);
  const totalPages = Math.ceil(filteredParticipants.length / participantsPerPage);

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

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return 'N/A';
    try {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      return age;
    } catch (error) {
      return 'N/A';
    }
  };

  // Get support level badge class
  const getSupportLevelBadge = (level) => {
    switch (level) {
      case 'high':
        return 'badge-red';
      case 'medium':
        return 'badge-yellow';
      case 'standard':
        return 'badge-blue';
      case 'low':
        return 'badge-green';
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
      case 'pending':
        return 'badge-yellow';
      case 'suspended':
        return 'badge-red';
      default:
        return 'badge-gray';
    }
  };

  // Get goal status badge class
  const getGoalStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return 'badge-green';
      case 'in_progress':
        return 'badge-blue';
      case 'not_started':
        return 'badge-gray';
      case 'on_hold':
        return 'badge-yellow';
      case 'cancelled':
        return 'badge-red';
      default:
        return 'badge-gray';
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
            placeholder="Search participants..."
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
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Support Level</label>
                <select
                  value={filters.supportLevel}
                  onChange={(e) => setFilters({...filters, supportLevel: e.target.value})}
                >
                  <option value="all">All Levels</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="standard">Standard</option>
                  <option value="low">Low</option>
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
          <span>New Participant</span>
        </button>
      </div>
      
      {/* Participants Grid */}
      {participantsLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading participants...</p>
        </div>
      ) : participantsError ? (
        <div className="error-container glass-panel">
          <FiAlertCircle className="error-icon" />
          <p>Error loading participants: {participantsError.message}</p>
          <button className="btn btn-primary" onClick={() => refetchParticipants()}>
            <FiRefreshCw /> Try Again
          </button>
        </div>
      ) : filteredParticipants.length === 0 ? (
        <div className="empty-state glass-panel">
          <FiUsers className="empty-icon" />
          <h3>No participants found</h3>
          <p>Try adjusting your search or filters, or add a new participant.</p>
          <button 
            className="btn btn-primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <FiPlus /> Add Participant
          </button>
        </div>
      ) : (
        <>
          <div className="participants-grid">
            {currentParticipants.map(participant => (
              <div 
                key={participant.id} 
                className="participant-card glass-card"
                onClick={() => setSelectedParticipant(participant)}
              >
                <div className="participant-header">
                  <div className="participant-avatar">
                    {participant.first_name?.[0]}{participant.last_name?.[0]}
                  </div>
                  <div className="participant-badges">
                    <span className={`badge ${getStatusBadge(participant.status)}`}>
                      {participant.status}
                    </span>
                    <span className={`badge ${getSupportLevelBadge(participant.support_level)}`}>
                      {participant.support_level}
                    </span>
                  </div>
                </div>
                
                <div className="participant-info">
                  <h3 className="participant-name">
                    {participant.first_name} {participant.last_name}
                  </h3>
                  <p className="participant-ndis">
                    <span>NDIS:</span> {participant.ndis_number || 'N/A'}
                  </p>
                  <p className="participant-age">
                    <span>Age:</span> {calculateAge(participant.date_of_birth)}
                  </p>
                </div>
                
                <div className="participant-footer">
                  <div className="participant-contact">
                    {participant.phone && (
                      <div className="contact-item">
                        <FiPhone className="contact-icon" />
                        <span>{participant.phone}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="participant-actions">
                    <button 
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditParticipant(participant);
                      }}
                      title="Edit"
                    >
                      <FiEdit2 />
                    </button>
                    <button 
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedParticipant(participant);
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
    </div>
  );

  // Render planning tab content
  const renderPlanningTab = () => (
    <div className="planning-tab">
      {/* Participant Selection */}
      <div className="planning-header glass-panel">
        <h3>Participant Planning</h3>
        <p>Select a participant from the directory to view and manage their planning.</p>
        
        <div className="search-container">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search participants for planning..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>
      
      {!selectedParticipant ? (
        <div className="participant-selection-grid">
          {filteredParticipants.slice(0, 8).map(participant => (
            <div 
              key={participant.id} 
              className="participant-selection-card glass-card"
              onClick={() => setSelectedParticipant(participant)}
            >
              <div className="participant-avatar">
                {participant.first_name?.[0]}{participant.last_name?.[0]}
              </div>
              <div className="participant-selection-info">
                <h4>{participant.first_name} {participant.last_name}</h4>
                <p>{participant.ndis_number || 'No NDIS'}</p>
              </div>
              <div className="participant-selection-badge">
                <span className={`badge ${getSupportLevelBadge(participant.support_level)}`}>
                  {participant.support_level}
                </span>
              </div>
            </div>
          ))}
          
          {filteredParticipants.length === 0 && (
            <div className="empty-state glass-panel">
              <FiUsers className="empty-icon" />
              <h3>No participants found</h3>
              <p>Try adjusting your search or add a new participant.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="participant-planning">
          <div className="planning-nav glass-panel">
            <button 
              className="back-btn"
              onClick={() => setSelectedParticipant(null)}
            >
              <FiArrowLeft />
              <span>Back to Selection</span>
            </button>
            
            <div className="participant-planning-header">
              <h3>{selectedParticipant.first_name} {selectedParticipant.last_name}</h3>
              <span className={`badge ${getSupportLevelBadge(selectedParticipant.support_level)}`}>
                {selectedParticipant.support_level}
              </span>
            </div>
            
            <div className="planning-tabs">
              <button 
                className={`planning-tab-btn ${selectedPlanTab === 'overview' ? 'active' : ''}`}
                onClick={() => setSelectedPlanTab('overview')}
              >
                <FiClipboard />
                <span>Overview</span>
              </button>
              <button 
                className={`planning-tab-btn ${selectedPlanTab === 'goals' ? 'active' : ''}`}
                onClick={() => setSelectedPlanTab('goals')}
              >
                <FiTarget />
                <span>Goals</span>
              </button>
              <button 
                className={`planning-tab-btn ${selectedPlanTab === 'programs' ? 'active' : ''}`}
                onClick={() => setSelectedPlanTab('programs')}
              >
                <FiCalendar />
                <span>Programs</span>
              </button>
              <button 
                className={`planning-tab-btn ${selectedPlanTab === 'billing' ? 'active' : ''}`}
                onClick={() => setSelectedPlanTab('billing')}
              >
                <FiDollarSign />
                <span>Billing</span>
              </button>
            </div>
          </div>
          
          <div className="planning-content">
            {selectedPlanTab === 'overview' && (
              <div className="planning-overview">
                <div className="planning-section glass-card">
                  <h4>Participant Overview</h4>
                  <div className="participant-details">
                    <div className="detail-group">
                      <div className="detail-item">
                        <span className="detail-label">NDIS Number:</span>
                        <span className="detail-value">{selectedParticipant.ndis_number || 'N/A'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Date of Birth:</span>
                        <span className="detail-value">{formatDate(selectedParticipant.date_of_birth)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Age:</span>
                        <span className="detail-value">{calculateAge(selectedParticipant.date_of_birth)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Gender:</span>
                        <span className="detail-value">{selectedParticipant.gender || 'N/A'}</span>
                      </div>
                    </div>
                    
                    <div className="detail-group">
                      <div className="detail-item">
                        <span className="detail-label">Phone:</span>
                        <span className="detail-value">{selectedParticipant.phone || 'N/A'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Email:</span>
                        <span className="detail-value">{selectedParticipant.email || 'N/A'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Address:</span>
                        <span className="detail-value">
                          {selectedParticipant.address ? (
                            <>
                              {selectedParticipant.address}, {selectedParticipant.suburb}, {selectedParticipant.state} {selectedParticipant.postcode}
                            </>
                          ) : 'N/A'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="detail-group">
                      <div className="detail-item">
                        <span className="detail-label">Emergency Contact:</span>
                        <span className="detail-value">
                          {selectedParticipant.emergency_contact_name ? (
                            <>
                              {selectedParticipant.emergency_contact_name} ({selectedParticipant.emergency_contact_phone || 'No phone'})
                            </>
                          ) : 'N/A'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Support Level:</span>
                        <span className={`detail-value badge ${getSupportLevelBadge(selectedParticipant.support_level)}`}>
                          {selectedParticipant.support_level || 'N/A'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Status:</span>
                        <span className={`detail-value badge ${getStatusBadge(selectedParticipant.status)}`}>
                          {selectedParticipant.status || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="planning-section glass-card">
                  <h4>Notes</h4>
                  <div className="notes-content">
                    {selectedParticipant.notes ? (
                      <p>{selectedParticipant.notes}</p>
                    ) : (
                      <p className="text-muted">No notes available for this participant.</p>
                    )}
                  </div>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleEditParticipant(selectedParticipant)}
                  >
                    <FiEdit2 /> Edit Notes
                  </button>
                </div>
                
                <div className="planning-section glass-card">
                  <h4>Summary</h4>
                  <div className="summary-stats">
                    <div className="stat-card">
                      <div className="stat-icon">
                        <FiTarget />
                      </div>
                      <div className="stat-content">
                        <div className="stat-value">
                          {selectedParticipant.goals?.length || 0}
                        </div>
                        <div className="stat-label">Goals</div>
                      </div>
                    </div>
                    
                    <div className="stat-card">
                      <div className="stat-icon">
                        <FiCalendar />
                      </div>
                      <div className="stat-content">
                        <div className="stat-value">
                          {selectedParticipant.programs?.length || 0}
                        </div>
                        <div className="stat-label">Programs</div>
                      </div>
                    </div>
                    
                    <div className="stat-card">
                      <div className="stat-icon">
                        <FiDollarSign />
                      </div>
                      <div className="stat-content">
                        <div className="stat-value">
                          {selectedParticipant.billing_codes?.length || 0}
                        </div>
                        <div className="stat-label">Billing Codes</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {selectedPlanTab === 'goals' && (
              <div className="planning-goals">
                <div className="planning-section glass-card">
                  <h4>Goals</h4>
                  {selectedParticipant.goals?.length > 0 ? (
                    <div className="goals-list">
                      {selectedParticipant.goals.map((goal, index) => (
                        <div key={index} className="goal-item">
                          <div className="goal-header">
                            <h5>{goal.title}</h5>
                            <span className={`badge ${getGoalStatusBadge(goal.status)}`}>
                              {goal.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="goal-description">{goal.description}</p>
                          <div className="goal-footer">
                            <div className="goal-category">
                              <FiTag className="goal-icon" />
                              <span>{goal.category}</span>
                            </div>
                            <div className="goal-target">
                              <FiCalendar className="goal-icon" />
                              <span>Target: {formatDate(goal.target_date)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted">No goals have been set for this participant.</p>
                  )}
                </div>
                
                <div className="planning-section glass-card">
                  <h4>Add New Goal</h4>
                  <form className="goal-form" onSubmit={handleAddGoal}>
                    <div className="form-group">
                      <label htmlFor="goal-title">Goal Title</label>
                      <input
                        id="goal-title"
                        type="text"
                        value={newGoal.title}
                        onChange={(e) => setNewGoal({...newGoal, title: e.target.value})}
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="goal-description">Description</label>
                      <textarea
                        id="goal-description"
                        value={newGoal.description}
                        onChange={(e) => setNewGoal({...newGoal, description: e.target.value})}
                        rows="3"
                        required
                      ></textarea>
                    </div>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="goal-category">Category</label>
                        <select
                          id="goal-category"
                          value={newGoal.category}
                          onChange={(e) => setNewGoal({...newGoal, category: e.target.value})}
                        >
                          <option value="independence">Independence</option>
                          <option value="social">Social</option>
                          <option value="health">Health</option>
                          <option value="education">Education</option>
                          <option value="employment">Employment</option>
                          <option value="housing">Housing</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="goal-status">Status</label>
                        <select
                          id="goal-status"
                          value={newGoal.status}
                          onChange={(e) => setNewGoal({...newGoal, status: e.target.value})}
                        >
                          <option value="not_started">Not Started</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="on_hold">On Hold</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="goal-target-date">Target Date</label>
                      <input
                        id="goal-target-date"
                        type="date"
                        value={newGoal.target_date}
                        onChange={(e) => setNewGoal({...newGoal, target_date: e.target.value})}
                        required
                      />
                    </div>
                    
                    <div className="form-actions">
                      <button 
                        type="submit" 
                        className="btn btn-primary"
                        disabled={addGoalMutation.isLoading}
                      >
                        {addGoalMutation.isLoading ? (
                          <>
                            <div className="loading-spinner-small"></div>
                            Adding...
                          </>
                        ) : (
                          <>
                            <FiPlus /> Add Goal
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            
            {selectedPlanTab === 'programs' && (
              <div className="planning-programs">
                <div className="planning-section glass-card">
                  <div className="planning-week-header">
                    <button className="nav-button glass-button" onClick={prevWeek}>&lt; Prev</button>
                    <h4 style={{margin: 0}}>
                      {format(weekDays[0], 'd MMM')} - {format(weekDays[6], 'd MMM yyyy')}
                    </h4>
                    <button className="nav-button glass-button" onClick={nextWeek}>Next &gt;</button>
                  </div>
                  {instancesLoading ? (
                    <div className="loading-container">
                      <div className="loading-spinner-small"></div>
                      <p>Loading weekly instances...</p>
                    </div>
                  ) : instancesError ? (
                    <div className="error-container glass-panel">
                      <FiAlertCircle className="error-icon" />
                      <p>{instancesError}</p>
                    </div>
                  ) : (
                    <div className="calendar-grid">
                      {weekDays.map((day, idx) => (
                        <div key={idx} className="day-column glass-panel">
                          <div className="day-header">
                            <div className="day-name">{format(day, 'EEE')}</div>
                            <div className="day-number">{format(day, 'd')}</div>
                          </div>
                          <div className="day-instances">
                            {instancesForDate(day).length > 0 ? (
                              instancesForDate(day).map((inst) => {
                                const ratio = inst.staff_ratio || 0;
                                const participants = inst.participant_count || 0;
                                const required = ratio > 0 ? Math.ceil(participants / ratio) : null;
                                return (
                                  <div key={inst.id} className="program-card glass-card">
                                    <h5 style={{marginBottom: 4}}>{inst.program_name}</h5>
                                    <p className="venue">{inst.venue_name}</p>
                                    <p className="time">{inst.start_time} - {inst.end_time}</p>
                                    <div className="meta-row">
                                      <span>{participants} participants</span>
                                      {required !== null && <span>Est. {required} staff</span>}
                                    </div>
                                    <div className="actions-row" style={{marginTop: 8}}>
                                      <button
                                        className="btn btn-secondary btn-sm"
                                        disabled
                                        title="Planning stub"
                                      >
                                        Plan for {selectedParticipant.first_name}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="empty-day"><span>No programs</span></div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {selectedPlanTab === 'billing' && (
              <div className="planning-billing">
                <div className="planning-section glass-card">
                  <h4>Billing Codes</h4>
                  {selectedParticipant.billing_codes?.length > 0 ? (
                    <div className="billing-codes-list">
                      {selectedParticipant.billing_codes.map((code, index) => (
                        <div key={index} className="billing-code-item">
                          <div className="billing-code-header">
                            <h5>{code.code}</h5>
                            <div className="billing-code-amount">
                              <span className="amount-remaining">
                                ${parseFloat(code.remaining_amount).toFixed(2)}
                              </span>
                              <span className="amount-separator">/</span>
                              <span className="amount-total">
                                ${parseFloat(code.total_amount).toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <p className="billing-code-description">{code.description}</p>
                          <div className="billing-code-footer">
                            <div className="billing-code-dates">
                              <FiCalendar className="billing-code-icon" />
                              <span>
                                {formatDate(code.start_date)} - {formatDate(code.end_date)}
                              </span>
                            </div>
                            <div className="billing-code-rate">
                              <FiDollarSign className="billing-code-icon" />
                              <span>${parseFloat(code.rate).toFixed(2)}/hr</span>
                            </div>
                          </div>
                          <div className="billing-code-progress">
                            <div 
                              className="progress-bar" 
                              style={{
                                width: `${(code.remaining_amount / code.total_amount) * 100}%`
                              }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted">No billing codes found for this participant.</p>
                  )}
                </div>
                
                <div className="planning-section glass-card">
                  <h4>Add Billing Code</h4>
                  <form className="billing-code-form" onSubmit={handleAddBillingCode}>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="billing-code">NDIS Code</label>
                        <input
                          id="billing-code"
                          type="text"
                          value={newBillingCode.code}
                          onChange={(e) => setNewBillingCode({...newBillingCode, code: e.target.value})}
                          required
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="billing-rate">Hourly Rate ($)</label>
                        <input
                          id="billing-rate"
                          type="number"
                          step="0.01"
                          value={newBillingCode.rate}
                          onChange={(e) => setNewBillingCode({...newBillingCode, rate: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="billing-description">Description</label>
                      <input
                        id="billing-description"
                        type="text"
                        value={newBillingCode.description}
                        onChange={(e) => setNewBillingCode({...newBillingCode, description: e.target.value})}
                        required
                      />
                    </div>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="billing-total">Total Amount ($)</label>
                        <input
                          id="billing-total"
                          type="number"
                          step="0.01"
                          value={newBillingCode.total_amount}
                          onChange={(e) => setNewBillingCode({
                            ...newBillingCode, 
                            total_amount: e.target.value,
                            remaining_amount: e.target.value
                          })}
                          required
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="billing-remaining">Remaining Amount ($)</label>
                        <input
                          id="billing-remaining"
                          type="number"
                          step="0.01"
                          value={newBillingCode.remaining_amount}
                          onChange={(e) => setNewBillingCode({...newBillingCode, remaining_amount: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="billing-start-date">Start Date</label>
                        <input
                          id="billing-start-date"
                          type="date"
                          value={newBillingCode.start_date}
                          onChange={(e) => setNewBillingCode({...newBillingCode, start_date: e.target.value})}
                          required
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="billing-end-date">End Date</label>
                        <input
                          id="billing-end-date"
                          type="date"
                          value={newBillingCode.end_date}
                          onChange={(e) => setNewBillingCode({...newBillingCode, end_date: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="form-actions">
                      <button 
                        type="submit" 
                        className="btn btn-primary"
                        disabled={addBillingCodeMutation.isLoading}
                      >
                        {addBillingCodeMutation.isLoading ? (
                          <>
                            <div className="loading-spinner-small"></div>
                            Adding...
                          </>
                        ) : (
                          <>
                            <FiPlus /> Add Billing Code
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Render reports tab content
  const renderReportsTab = () => (
    <div className="reports-tab">
      <div className="reports-header glass-panel">
        <h3>Participant Reports</h3>
        <p>Generate and view reports for participants.</p>
      </div>
      
      <div className="reports-grid">
        <div className="report-card glass-card">
          <div className="report-icon">
            <FiBarChart2 />
          </div>
          <div className="report-content">
            <h4>Participant Summary Report</h4>
            <p>Generate a summary report for all participants or filter by status.</p>
            <button className="btn btn-primary">
              <FiFileText /> Generate Report
            </button>
          </div>
        </div>
        
        <div className="report-card glass-card">
          <div className="report-icon">
            <FiTarget />
          </div>
          <div className="report-content">
            <h4>Goals Progress Report</h4>
            <p>Track progress on participant goals and outcomes.</p>
            <button className="btn btn-primary">
              <FiFileText /> Generate Report
            </button>
          </div>
        </div>
        
        <div className="report-card glass-card">
          <div className="report-icon">
            <FiDollarSign />
          </div>
          <div className="report-content">
            <h4>Billing & Funding Report</h4>
            <p>View NDIS billing codes and funding utilization.</p>
            <button className="btn btn-primary">
              <FiFileText /> Generate Report
            </button>
          </div>
        </div>
        
        <div className="report-card glass-card">
          <div className="report-icon">
            <FiCalendar />
          </div>
          <div className="report-content">
            <h4>Program Attendance Report</h4>
            <p>Track participant attendance across all programs.</p>
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

  return (
    <div className="participants-page">
      <div className="page-header">
        <h2 className="page-title">Participants</h2>
        <div className="page-tabs">
          <button 
            className={`tab-button ${activeTab === 'directory' ? 'active' : ''}`}
            onClick={() => setActiveTab('directory')}
          >
            <FiUsers />
            <span>Directory</span>
          </button>
          <button 
            className={`tab-button ${activeTab === 'planning' ? 'active' : ''}`}
            onClick={() => setActiveTab('planning')}
          >
            <FiTarget />
            <span>Planning</span>
          </button>
          <button 
            className={`tab-button ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <FiBarChart2 />
            <span>Reports</span>
          </button>
        </div>
      </div>
      
      <div className="tab-content">
        {activeTab === 'directory' && renderDirectoryTab()}
        {activeTab === 'planning' && renderPlanningTab()}
        {activeTab === 'reports' && renderReportsTab()}
      </div>
      
      {/* Modals */}
      {isCreateModalOpen && (
        <CreateParticipantModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          participantForm={participantForm}
          setParticipantForm={setParticipantForm}
          onSubmit={handleCreateParticipant}
          isSubmitting={createParticipantMutation.isLoading}
        />
      )}

      {isEditModalOpen && (
        <EditParticipantModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          participantForm={participantForm}
          setParticipantForm={setParticipantForm}
          onSubmit={handleUpdateParticipant}
          isSubmitting={updateParticipantMutation.isLoading}
        />
      )}

      {isDeleteModalOpen && (
        <DeleteParticipantModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDeleteParticipant}
          isSubmitting={deleteParticipantMutation.isLoading}
          selectedParticipant={selectedParticipant}
        />
      )}
    </div>
  );
};

export default Participants;
