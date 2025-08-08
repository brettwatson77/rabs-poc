import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { format, parseISO, startOfWeek, addDays, isSameDay, isWithinInterval, addWeeks } from 'date-fns';
import { 
  FiUsers, 
  FiCalendar, 
  FiSearch, 
  FiFilter, 
  FiPlusCircle, 
  FiEdit2, 
  FiTrash2, 
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiUpload,
  FiClock,
  FiUserCheck,
  FiUserX,
  FiSettings,
  FiMessageSquare
} from 'react-icons/fi';

// API base URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3009';

// Roster component
const Roster = () => {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOptions, setFilterOptions] = useState({
    role: 'all',
    availability: 'all'
  });
  const [viewMode, setViewMode] = useState('list'); // 'list', 'calendar', 'availability'
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(currentDate));
  const [newShift, setNewShift] = useState({
    staffId: null,
    date: format(currentDate, 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '17:00',
    programId: null,
    notes: ''
  });
  const [bulkSelected, setBulkSelected] = useState([]);
  const [bulkAction, setBulkAction] = useState('');

  // Format date for API requests
  const formattedWeekStart = format(selectedWeek, 'yyyy-MM-dd');
  const formattedWeekEnd = format(addDays(selectedWeek, 6), 'yyyy-MM-dd');

  // Fetch staff list
  const { 
    data: staffData, 
    isLoading: staffLoading, 
    error: staffError,
    refetch: refetchStaff
  } = useQuery(
    ['staffList'],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/staff`);
      return response.data;
    }
  );

  // Fetch roster data for the selected week
  const { 
    data: rosterData, 
    isLoading: rosterLoading, 
    error: rosterError,
    refetch: refetchRoster
  } = useQuery(
    ['rosterData', formattedWeekStart, formattedWeekEnd],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/roster/shifts`, {
        params: { 
          start_date: formattedWeekStart,
          end_date: formattedWeekEnd
        }
      });
      return response.data;
    }
  );

  // Fetch programs for shift assignment
  const { 
    data: programsData, 
    isLoading: programsLoading 
  } = useQuery(
    ['programsList'],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/programs`);
      return response.data;
    }
  );

  // Fetch staff availability
  const { 
    data: availabilityData, 
    isLoading: availabilityLoading,
    error: availabilityError
  } = useQuery(
    ['staffAvailability', formattedWeekStart, formattedWeekEnd],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/staff/availability`, {
        params: { 
          start_date: formattedWeekStart,
          end_date: formattedWeekEnd
        }
      });
      return response.data;
    }
  );

  // Create shift mutation
  const createShiftMutation = useMutation(
    async (shiftData) => {
      const response = await axios.post(`${API_URL}/api/v1/roster/shifts`, shiftData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['rosterData']);
        setIsShiftModalOpen(false);
        resetNewShift();
      }
    }
  );

  // Update shift mutation
  const updateShiftMutation = useMutation(
    async ({ shiftId, shiftData }) => {
      const response = await axios.put(`${API_URL}/api/v1/roster/shifts/${shiftId}`, shiftData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['rosterData']);
        setIsShiftModalOpen(false);
      }
    }
  );

  // Delete shift mutation
  const deleteShiftMutation = useMutation(
    async (shiftId) => {
      const response = await axios.delete(`${API_URL}/api/v1/roster/shifts/${shiftId}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['rosterData']);
      }
    }
  );

  // Update staff availability mutation
  const updateAvailabilityMutation = useMutation(
    async ({ staffId, availabilityData }) => {
      const response = await axios.put(`${API_URL}/api/v1/staff/${staffId}/availability`, availabilityData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['staffAvailability']);
      }
    }
  );

  // Bulk action mutation
  const bulkActionMutation = useMutation(
    async ({ action, staffIds, actionData }) => {
      const response = await axios.post(`${API_URL}/api/v1/staff/bulk-action`, {
        action,
        staff_ids: staffIds,
        data: actionData
      });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['staffList']);
        queryClient.invalidateQueries(['rosterData']);
        setBulkSelected([]);
        setBulkAction('');
      }
    }
  );

  // Reset new shift form
  const resetNewShift = () => {
    setNewShift({
      staffId: null,
      date: format(currentDate, 'yyyy-MM-dd'),
      startTime: '09:00',
      endTime: '17:00',
      programId: null,
      notes: ''
    });
  };

  // Handle staff selection for profile view
  const handleStaffSelect = (staff) => {
    setSelectedStaff(staff);
    setIsProfileModalOpen(true);
  };

  // Open shift modal for creating a new shift
  const handleNewShift = (staffId, date) => {
    setNewShift({
      ...newShift,
      staffId,
      date: format(date, 'yyyy-MM-dd')
    });
    setIsShiftModalOpen(true);
  };

  // Open shift modal for editing an existing shift
  const handleEditShift = (shift) => {
    setNewShift({
      staffId: shift.staff_id,
      date: shift.date,
      startTime: shift.start_time,
      endTime: shift.end_time,
      programId: shift.program_id,
      notes: shift.notes || '',
      shiftId: shift.id
    });
    setIsShiftModalOpen(true);
  };

  // Handle shift submission (create or update)
  const handleShiftSubmit = (e) => {
    e.preventDefault();
    
    const shiftData = {
      staff_id: newShift.staffId,
      date: newShift.date,
      start_time: newShift.startTime,
      end_time: newShift.endTime,
      program_id: newShift.programId,
      notes: newShift.notes
    };

    if (newShift.shiftId) {
      updateShiftMutation.mutate({ 
        shiftId: newShift.shiftId, 
        shiftData 
      });
    } else {
      createShiftMutation.mutate(shiftData);
    }
  };

  // Handle shift deletion
  const handleDeleteShift = (shiftId) => {
    if (confirm('Are you sure you want to delete this shift?')) {
      deleteShiftMutation.mutate(shiftId);
    }
  };

  // Handle availability toggle
  const handleAvailabilityToggle = (staffId, date, isAvailable) => {
    updateAvailabilityMutation.mutate({
      staffId,
      availabilityData: {
        date: format(date, 'yyyy-MM-dd'),
        is_available: !isAvailable
      }
    });
  };

  // Navigate to previous week
  const goToPreviousWeek = () => {
    setSelectedWeek(prevWeek => addDays(prevWeek, -7));
  };

  // Navigate to next week
  const goToNextWeek = () => {
    setSelectedWeek(prevWeek => addDays(prevWeek, 7));
  };

  // Go to current week
  const goToCurrentWeek = () => {
    setSelectedWeek(startOfWeek(new Date()));
  };

  // Filter staff based on search and filter options
  const filteredStaff = () => {
    if (!staffData || !staffData.data) return [];
    
    return staffData.data.filter(staff => {
      const nameMatch = `${staff.first_name} ${staff.last_name}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      
      const roleMatch = filterOptions.role === 'all' || 
        staff.role === filterOptions.role;
      
      // Filter by availability if needed
      let availabilityMatch = true;
      if (filterOptions.availability !== 'all' && availabilityData) {
        const staffAvailability = availabilityData.data.find(
          a => a.staff_id === staff.id
        );
        
        if (staffAvailability) {
          const isAvailableToday = staffAvailability.dates.some(
            a => isSameDay(parseISO(a.date), currentDate) && a.is_available
          );
          
          availabilityMatch = filterOptions.availability === 'available' ? 
            isAvailableToday : !isAvailableToday;
        }
      }
      
      return nameMatch && roleMatch && availabilityMatch;
    });
  };

  // Get shifts for a specific staff and date
  const getShiftsForStaffAndDate = (staffId, date) => {
    if (!rosterData || !rosterData.data) return [];
    
    return rosterData.data.filter(shift => 
      shift.staff_id === staffId && 
      isSameDay(parseISO(shift.date), date)
    );
  };

  // Get availability for a specific staff and date
  const getAvailabilityForStaffAndDate = (staffId, date) => {
    if (!availabilityData || !availabilityData.data) return null;
    
    const staffAvailability = availabilityData.data.find(
      a => a.staff_id === staffId
    );
    
    if (!staffAvailability) return null;
    
    const dateAvailability = staffAvailability.dates.find(
      a => isSameDay(parseISO(a.date), date)
    );
    
    return dateAvailability ? dateAvailability.is_available : null;
  };

  // Calculate staff-to-participant ratio for a shift
  const calculateRatio = (shift) => {
    if (!shift.participants_count || shift.participants_count === 0) return 'N/A';
    
    const ratio = shift.participants_count / (shift.staff_count || 1);
    return `1:${Math.round(ratio)}`;
  };

  // Handle bulk selection
  const handleBulkSelect = (staffId) => {
    setBulkSelected(prev => {
      if (prev.includes(staffId)) {
        return prev.filter(id => id !== staffId);
      } else {
        return [...prev, staffId];
      }
    });
  };

  // Handle select all for bulk actions
  const handleSelectAll = () => {
    if (!staffData || !staffData.data) return;
    
    if (bulkSelected.length === filteredStaff().length) {
      setBulkSelected([]);
    } else {
      setBulkSelected(filteredStaff().map(staff => staff.id));
    }
  };

  // Execute bulk action
  const executeBulkAction = () => {
    if (bulkSelected.length === 0 || !bulkAction) return;
    
    let actionData = {};
    
    switch (bulkAction) {
      case 'assign-program':
        actionData = {
          program_id: prompt('Enter program ID:'),
          date: format(currentDate, 'yyyy-MM-dd')
        };
        break;
      case 'set-availability':
        actionData = {
          date: format(currentDate, 'yyyy-MM-dd'),
          is_available: confirm('Set as available? (Cancel for unavailable)')
        };
        break;
      case 'update-rate':
        actionData = {
          hourly_rate: prompt('Enter new hourly rate:')
        };
        break;
      default:
        return;
    }
    
    bulkActionMutation.mutate({
      action: bulkAction,
      staffIds: bulkSelected,
      actionData
    });
  };

  // Generate week days array for calendar view
  const weekDays = Array.from({ length: 7 }, (_, i) => 
    addDays(selectedWeek, i)
  );

  // Render week navigation
  const renderWeekNavigation = () => (
    <div className="week-navigation">
      <button 
        className="btn btn-icon" 
        onClick={goToPreviousWeek}
        aria-label="Previous week"
      >
        <FiChevronLeft />
      </button>
      <button 
        className="btn btn-text"
        onClick={goToCurrentWeek}
      >
        {format(selectedWeek, 'MMM d')} - {format(addDays(selectedWeek, 6), 'MMM d, yyyy')}
      </button>
      <button 
        className="btn btn-icon"
        onClick={goToNextWeek}
        aria-label="Next week"
      >
        <FiChevronRight />
      </button>
    </div>
  );

  // Render staff list view
  const renderStaffList = () => (
    <div className="staff-list-container">
      <table className="staff-table glass-table">
        <thead>
          <tr>
            <th>
              <input 
                type="checkbox" 
                checked={bulkSelected.length > 0 && bulkSelected.length === filteredStaff().length}
                onChange={handleSelectAll}
              />
            </th>
            <th>Staff</th>
            <th>Role</th>
            <th>Contact</th>
            <th>Availability</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredStaff().map(staff => (
            <tr key={staff.id} className={bulkSelected.includes(staff.id) ? 'selected' : ''}>
              <td>
                <input 
                  type="checkbox" 
                  checked={bulkSelected.includes(staff.id)}
                  onChange={() => handleBulkSelect(staff.id)}
                />
              </td>
              <td onClick={() => handleStaffSelect(staff)} className="staff-name">
                <div className="staff-avatar">
                  {staff.first_name.charAt(0)}{staff.last_name.charAt(0)}
                </div>
                <div>
                  <div className="staff-full-name">{staff.first_name} {staff.last_name}</div>
                  <div className="staff-id">ID: {staff.id}</div>
                </div>
              </td>
              <td>{staff.role || 'Support Worker'}</td>
              <td>
                <div>{staff.email || 'No email'}</div>
                <div>{staff.phone || 'No phone'}</div>
              </td>
              <td>
                {availabilityLoading ? (
                  <span className="loading-indicator-small"></span>
                ) : (
                  <div className="availability-indicator">
                    {getAvailabilityForStaffAndDate(staff.id, currentDate) === true ? (
                      <span className="available"><FiCheckCircle /> Available Today</span>
                    ) : getAvailabilityForStaffAndDate(staff.id, currentDate) === false ? (
                      <span className="unavailable"><FiXCircle /> Unavailable Today</span>
                    ) : (
                      <span className="unknown">No data</span>
                    )}
                  </div>
                )}
              </td>
              <td>
                <div className="action-buttons">
                  <button 
                    className="btn btn-icon" 
                    onClick={() => handleNewShift(staff.id, currentDate)}
                    title="Add Shift"
                  >
                    <FiPlusCircle />
                  </button>
                  <button 
                    className="btn btn-icon"
                    onClick={() => handleStaffSelect(staff)}
                    title="View Profile"
                  >
                    <FiUsers />
                  </button>
                  <button 
                    className="btn btn-icon"
                    onClick={() => handleAvailabilityToggle(
                      staff.id, 
                      currentDate, 
                      getAvailabilityForStaffAndDate(staff.id, currentDate)
                    )}
                    title="Toggle Availability"
                  >
                    <FiCalendar />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {filteredStaff().length === 0 && !staffLoading && (
            <tr>
              <td colSpan="6" className="no-results">
                No staff found matching your search criteria
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {staffLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading staff data...</p>
        </div>
      )}
    </div>
  );

  // Render calendar view
  const renderCalendarView = () => (
    <div className="roster-calendar-container">
      <div className="calendar-header">
        {weekDays.map(day => (
          <div key={format(day, 'yyyy-MM-dd')} className="calendar-day-header">
            <div className="day-name">{format(day, 'EEE')}</div>
            <div className="day-date">{format(day, 'd MMM')}</div>
          </div>
        ))}
      </div>
      <div className="calendar-body">
        {filteredStaff().map(staff => (
          <div key={staff.id} className="calendar-row">
            <div className="calendar-staff-info">
              <div className="staff-avatar">
                {staff.first_name.charAt(0)}{staff.last_name.charAt(0)}
              </div>
              <div className="staff-name">{staff.first_name} {staff.last_name}</div>
            </div>
            {weekDays.map(day => {
              const shifts = getShiftsForStaffAndDate(staff.id, day);
              const isAvailable = getAvailabilityForStaffAndDate(staff.id, day);
              
              return (
                <div 
                  key={format(day, 'yyyy-MM-dd')} 
                  className={`calendar-cell ${isAvailable === false ? 'unavailable' : ''}`}
                  onClick={() => handleNewShift(staff.id, day)}
                >
                  {shifts.length > 0 ? (
                    <div className="shift-container">
                      {shifts.map(shift => (
                        <div 
                          key={shift.id} 
                          className="shift-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditShift(shift);
                          }}
                        >
                          <div className="shift-time">
                            {shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}
                          </div>
                          <div className="shift-program">
                            {shift.program_title || 'Unassigned'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-shift">
                      {isAvailable === false ? (
                        <span className="unavailable-text">Unavailable</span>
                      ) : (
                        <span className="add-shift">+ Add Shift</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {filteredStaff().length === 0 && !staffLoading && (
          <div className="no-results-calendar">
            No staff found matching your search criteria
          </div>
        )}
      </div>
      {(staffLoading || rosterLoading) && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading roster data...</p>
        </div>
      )}
    </div>
  );

  // Render availability view
  const renderAvailabilityView = () => (
    <div className="availability-container">
      <div className="availability-header">
        {weekDays.map(day => (
          <div key={format(day, 'yyyy-MM-dd')} className="availability-day-header">
            <div className="day-name">{format(day, 'EEE')}</div>
            <div className="day-date">{format(day, 'd MMM')}</div>
          </div>
        ))}
      </div>
      <div className="availability-body">
        {filteredStaff().map(staff => (
          <div key={staff.id} className="availability-row">
            <div className="availability-staff-info">
              <div className="staff-avatar">
                {staff.first_name.charAt(0)}{staff.last_name.charAt(0)}
              </div>
              <div className="staff-name">{staff.first_name} {staff.last_name}</div>
            </div>
            {weekDays.map(day => {
              const isAvailable = getAvailabilityForStaffAndDate(staff.id, day);
              
              return (
                <div 
                  key={format(day, 'yyyy-MM-dd')} 
                  className="availability-cell"
                  onClick={() => handleAvailabilityToggle(staff.id, day, isAvailable)}
                >
                  {isAvailable === true ? (
                    <div className="availability-indicator available">
                      <FiCheckCircle />
                      <span>Available</span>
                    </div>
                  ) : isAvailable === false ? (
                    <div className="availability-indicator unavailable">
                      <FiXCircle />
                      <span>Unavailable</span>
                    </div>
                  ) : (
                    <div className="availability-indicator unknown">
                      <FiAlertCircle />
                      <span>Not Set</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {filteredStaff().length === 0 && !staffLoading && (
          <div className="no-results-availability">
            No staff found matching your search criteria
          </div>
        )}
      </div>
      {(staffLoading || availabilityLoading) && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading availability data...</p>
        </div>
      )}
    </div>
  );

  // Render staff profile modal
  const renderStaffProfileModal = () => {
    if (!selectedStaff) return null;
    
    return (
      <div className="modal-overlay" onClick={() => setIsProfileModalOpen(false)}>
        <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Staff Profile</h3>
            <button className="btn-close" onClick={() => setIsProfileModalOpen(false)}>
              <FiXCircle />
            </button>
          </div>
          <div className="modal-body">
            <div className="staff-profile">
              <div className="staff-profile-header">
                <div className="staff-avatar large">
                  {selectedStaff.first_name.charAt(0)}{selectedStaff.last_name.charAt(0)}
                </div>
                <div className="staff-info">
                  <h2>{selectedStaff.first_name} {selectedStaff.last_name}</h2>
                  <p className="staff-role">{selectedStaff.role || 'Support Worker'}</p>
                  <p className="staff-id">ID: {selectedStaff.id}</p>
                </div>
              </div>
              
              <div className="staff-details">
                <div className="detail-section">
                  <h4>Contact Information</h4>
                  <div className="detail-item">
                    <strong>Email:</strong> {selectedStaff.email || 'Not provided'}
                  </div>
                  <div className="detail-item">
                    <strong>Phone:</strong> {selectedStaff.phone || 'Not provided'}
                  </div>
                  <div className="detail-item">
                    <strong>Address:</strong> {selectedStaff.address || 'Not provided'}
                  </div>
                </div>
                
                <div className="detail-section">
                  <h4>Employment Details</h4>
                  <div className="detail-item">
                    <strong>Start Date:</strong> {selectedStaff.start_date ? format(parseISO(selectedStaff.start_date), 'MMM d, yyyy') : 'Not provided'}
                  </div>
                  <div className="detail-item">
                    <strong>Contract Type:</strong> {selectedStaff.contract_type || 'Not specified'}
                  </div>
                  <div className="detail-item">
                    <strong>Contract Hours:</strong> {selectedStaff.contract_hours || 'Not specified'} hours/week
                  </div>
                  <div className="detail-item">
                    <strong>Hourly Rate:</strong> ${selectedStaff.hourly_rate || 'Not specified'}
                  </div>
                </div>
                
                <div className="detail-section">
                  <h4>Qualifications & Skills</h4>
                  <div className="detail-item">
                    <strong>Qualifications:</strong> {selectedStaff.qualifications ? selectedStaff.qualifications.join(', ') : 'None listed'}
                  </div>
                  <div className="detail-item">
                    <strong>Languages:</strong> {selectedStaff.languages ? selectedStaff.languages.join(', ') : 'None listed'}
                  </div>
                  <div className="detail-item">
                    <strong>Driver's License:</strong> {selectedStaff.has_drivers_license ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
              
              <div className="staff-shifts">
                <h4>Upcoming Shifts</h4>
                {rosterLoading ? (
                  <div className="loading-container-small">
                    <div className="loading-spinner-small"></div>
                    <p>Loading shifts...</p>
                  </div>
                ) : rosterData && rosterData.data ? (
                  <div className="shifts-list">
                    {rosterData.data
                      .filter(shift => shift.staff_id === selectedStaff.id)
                      .slice(0, 5)
                      .map(shift => (
                        <div key={shift.id} className="shift-item-small">
                          <div className="shift-date">
                            {format(parseISO(shift.date), 'EEE, MMM d')}
                          </div>
                          <div className="shift-time">
                            {shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}
                          </div>
                          <div className="shift-program">
                            {shift.program_title || 'Unassigned'}
                          </div>
                        </div>
                      ))}
                    {rosterData.data.filter(shift => shift.staff_id === selectedStaff.id).length === 0 && (
                      <p className="no-shifts">No upcoming shifts</p>
                    )}
                  </div>
                ) : (
                  <p className="error-message">Failed to load shifts</p>
                )}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button 
              className="btn btn-secondary" 
              onClick={() => handleNewShift(selectedStaff.id, currentDate)}
            >
              <FiPlusCircle /> Add Shift
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => {
                // In a real app, this would open an edit form
                alert('Edit staff functionality would go here');
              }}
            >
              <FiEdit2 /> Edit Profile
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render shift modal
  const renderShiftModal = () => (
    <div className="modal-overlay" onClick={() => setIsShiftModalOpen(false)}>
      <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{newShift.shiftId ? 'Edit Shift' : 'Add New Shift'}</h3>
          <button className="btn-close" onClick={() => setIsShiftModalOpen(false)}>
            <FiXCircle />
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleShiftSubmit} className="shift-form">
            <div className="form-group">
              <label htmlFor="shift-date">Date</label>
              <input
                id="shift-date"
                type="date"
                value={newShift.date}
                onChange={e => setNewShift({...newShift, date: e.target.value})}
                required
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="shift-start">Start Time</label>
                <input
                  id="shift-start"
                  type="time"
                  value={newShift.startTime}
                  onChange={e => setNewShift({...newShift, startTime: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="shift-end">End Time</label>
                <input
                  id="shift-end"
                  type="time"
                  value={newShift.endTime}
                  onChange={e => setNewShift({...newShift, endTime: e.target.value})}
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="shift-program">Program</label>
              <select
                id="shift-program"
                value={newShift.programId || ''}
                onChange={e => setNewShift({...newShift, programId: e.target.value || null})}
              >
                <option value="">-- Select Program --</option>
                {programsData && programsData.data && programsData.data.map(program => (
                  <option key={program.id} value={program.id}>
                    {program.title}
                  </option>
                ))}
              </select>
              {programsLoading && <span className="loading-indicator-small"></span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="shift-notes">Notes</label>
              <textarea
                id="shift-notes"
                value={newShift.notes}
                onChange={e => setNewShift({...newShift, notes: e.target.value})}
                placeholder="Add any notes about this shift..."
                rows="3"
              ></textarea>
            </div>
          </form>
        </div>
        <div className="modal-footer">
          {newShift.shiftId && (
            <button 
              type="button" 
              className="btn btn-danger"
              onClick={() => {
                if (confirm('Are you sure you want to delete this shift?')) {
                  deleteShiftMutation.mutate(newShift.shiftId);
                  setIsShiftModalOpen(false);
                }
              }}
            >
              <FiTrash2 /> Delete
            </button>
          )}
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => setIsShiftModalOpen(false)}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handleShiftSubmit}
            disabled={createShiftMutation.isLoading || updateShiftMutation.isLoading}
          >
            {createShiftMutation.isLoading || updateShiftMutation.isLoading ? (
              <>
                <div className="loading-spinner-small"></div>
                Saving...
              </>
            ) : (
              <>
                <FiCheckCircle /> {newShift.shiftId ? 'Update' : 'Save'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="roster-container">
      <div className="page-header">
        <h2 className="page-title">Staff Roster</h2>
        <div className="page-actions">
          <button 
            className="btn btn-icon" 
            onClick={() => refetchStaff()}
            title="Refresh Staff"
          >
            <FiRefreshCw />
          </button>
          <button 
            className="btn btn-icon" 
            onClick={() => refetchRoster()}
            title="Refresh Roster"
          >
            <FiRefreshCw />
          </button>
          <span className="date-display">
            {format(currentDate, 'EEEE, MMMM d, yyyy')}
          </span>
        </div>
      </div>
      
      {/* Filters and Search */}
      <div className="roster-controls glass-card">
        <div className="search-container">
          <div className="search-input">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="filter-container">
            <div className="filter-item">
              <label htmlFor="role-filter">Role:</label>
              <select
                id="role-filter"
                value={filterOptions.role}
                onChange={e => setFilterOptions({...filterOptions, role: e.target.value})}
              >
                <option value="all">All Roles</option>
                <option value="Support Worker">Support Workers</option>
                <option value="Team Leader">Team Leaders</option>
                <option value="Coordinator">Coordinators</option>
                <option value="Driver">Drivers</option>
              </select>
            </div>
            
            <div className="filter-item">
              <label htmlFor="availability-filter">Availability:</label>
              <select
                id="availability-filter"
                value={filterOptions.availability}
                onChange={e => setFilterOptions({...filterOptions, availability: e.target.value})}
              >
                <option value="all">All</option>
                <option value="available">Available Today</option>
                <option value="unavailable">Unavailable Today</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="view-controls">
          <div className="view-buttons">
            <button 
              className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('list')}
            >
              <FiUsers /> List
            </button>
            <button 
              className={`btn ${viewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('calendar')}
            >
              <FiCalendar /> Calendar
            </button>
            <button 
              className={`btn ${viewMode === 'availability' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('availability')}
            >
              <FiClock /> Availability
            </button>
          </div>
          
          {viewMode !== 'list' && renderWeekNavigation()}
        </div>
      </div>
      
      {/* Bulk Actions */}
      {bulkSelected.length > 0 && (
        <div className="bulk-actions glass-card">
          <div className="bulk-info">
            <FiUserCheck /> {bulkSelected.length} staff selected
          </div>
          <div className="bulk-actions-controls">
            <select
              value={bulkAction}
              onChange={e => setBulkAction(e.target.value)}
              className="bulk-select"
            >
              <option value="">-- Select Action --</option>
              <option value="assign-program">Assign to Program</option>
              <option value="set-availability">Set Availability</option>
              <option value="update-rate">Update Hourly Rate</option>
            </select>
            <button 
              className="btn btn-primary"
              onClick={executeBulkAction}
              disabled={!bulkAction || bulkActionMutation.isLoading}
            >
              {bulkActionMutation.isLoading ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Processing...
                </>
              ) : (
                <>Apply</>
              )}
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => setBulkSelected([])}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="roster-content">
        {viewMode === 'list' && renderStaffList()}
        {viewMode === 'calendar' && renderCalendarView()}
        {viewMode === 'availability' && renderAvailabilityView()}
      </div>
      
      {/* Summary Stats */}
      <div className="roster-summary glass-card">
        <div className="summary-item">
          <div className="summary-label">Total Staff</div>
          <div className="summary-value">{staffData?.data?.length || 0}</div>
        </div>
        <div className="summary-item">
          <div className="summary-label">Scheduled Today</div>
          <div className="summary-value">
            {rosterData?.data?.filter(shift => 
              isSameDay(parseISO(shift.date), currentDate)
            ).length || 0}
          </div>
        </div>
        <div className="summary-item">
          <div className="summary-label">Available Today</div>
          <div className="summary-value">
            {availabilityData?.data?.filter(staff => 
              staff.dates.some(date => 
                isSameDay(parseISO(date.date), currentDate) && date.is_available
              )
            ).length || 0}
          </div>
        </div>
        <div className="summary-item">
          <div className="summary-label">Average Ratio</div>
          <div className="summary-value">
            {rosterData?.data?.length > 0 ? '1:4' : 'N/A'}
          </div>
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="roster-actions">
        <button className="glass-card action-card">
          <FiDownload className="action-icon" />
          <span>Export Roster</span>
        </button>
        <button className="glass-card action-card">
          <FiUpload className="action-icon" />
          <span>Import Shifts</span>
        </button>
        <button className="glass-card action-card">
          <FiMessageSquare className="action-icon" />
          <span>Notify Staff</span>
        </button>
        <button className="glass-card action-card">
          <FiSettings className="action-icon" />
          <span>Roster Settings</span>
        </button>
      </div>
      
      {/* Modals */}
      {isProfileModalOpen && renderStaffProfileModal()}
      {isShiftModalOpen && renderShiftModal()}
    </div>
  );
};

export default Roster;
