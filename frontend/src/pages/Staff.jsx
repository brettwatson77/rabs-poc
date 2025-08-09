import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { 
  FiUsers, 
  FiSearch, 
  FiFilter, 
  FiPlus,
  FiEdit,
  FiTrash,
  FiPhone,
  FiMail,
  FiHome,
  FiXCircle,
  FiRefreshCw,
  FiDollarSign,
  FiBriefcase,
  FiCalendar,
  FiClock,
  FiUser,
  FiArrowLeft,
  FiArrowRight
} from 'react-icons/fi';

// API base URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3009';

// Staff Page Component
const Staff = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    role: 'all',
    status: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const staffPerPage = 12;

  // Local draft for edit
  const [editStaff, setEditStaff] = useState(null);

  // ------------------------------------------------------------------ //
  //  Creation Mutation
  // ------------------------------------------------------------------ //
  const [newStaff, setNewStaff] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    position: 'support_worker',
    status: 'active',
    schads_level: 2,
    contracted_hours: 38,
    base_pay_rate: 30
  });

  const createStaffMutation = useMutation(
    async (body) => {
      const res = await axios.post(`${API_URL}/api/v1/staff`, body);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['staff']);
        setIsCreateModalOpen(false);
        setNewStaff({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          position: 'support_worker',
          status: 'active',
          schads_level: 2,
          contracted_hours: 38,
          base_pay_rate: 30
        });
      }
    }
  );

  // ------------------------------------------------------------------ //
  //  Update & Delete Mutations
  // ------------------------------------------------------------------ //
  const updateStaffMutation = useMutation(
    async (body) => {
      const res = await axios.put(`${API_URL}/api/v1/staff/${body.id}`, body);
      return res.data;
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['staff']);
        setIsEditModalOpen(false);
        setSelectedStaff(data.data); // refresh profile view
      }
    }
  );

  const deleteStaffMutation = useMutation(
    async (id) => {
      await axios.delete(`${API_URL}/api/v1/staff/${id}`);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['staff']);
        setIsDeleteConfirmOpen(false);
        setSelectedStaff(null);
      }
    }
  );

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

  // Filter staff based on search term and filters
  const filteredStaff = staffData?.data?.filter(staff => {
    const matchesSearch = 
      staff.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${staff.first_name} ${staff.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filters.role === 'all' || staff.position === filters.role;
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

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
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
      case 'manager': return 'badge-purple';
      case 'team_leader': return 'badge-blue';
      case 'support_worker': return 'badge-green';
      case 'admin': return 'badge-yellow';
      default: return 'badge-gray';
    }
  };
  
  // SCHADS level badge
  const getSchadsBadge = (level) => `badge-purple`;

  // Get status badge class
  const getStatusBadge = (status) => {
    switch (status) {
      case 'active': return 'badge-green';
      case 'inactive': return 'badge-gray';
      case 'on_leave': return 'badge-yellow';
      case 'terminated': return 'badge-red';
      default: return 'badge-gray';
    }
  };

  // Format role for display
  const formatRole = (role) => {
    if (!role) return 'Unknown';
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <>
      <div className="staff-page">
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

          {/* NEW STAFF BUTTON */}
          <button
            className="create-btn glass-button"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <FiPlus /> New Staff
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
            <FiRefreshCw className="error-icon" />
            <p>Error loading staff: {staffError.message}</p>
            <button className="btn btn-primary" onClick={() => refetchStaff()}>
              Try Again
            </button>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="empty-state glass-panel">
            <FiUsers className="empty-icon" />
            <h3>No staff found</h3>
            <p>Try adjusting your search or filters.</p>
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
                      <span className={`badge ${getRoleBadge(staff.position)}`}>
                        {formatRole(staff.position)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="staff-info">
                    <h3 className="staff-name">
                      {staff.first_name} {staff.last_name}
                    </h3>
                    <p className="staff-employment">
                      <span className="badge badge-purple">
                        SCHADS L{staff.schads_level || 2}
                      </span>
                      {staff.contracted_hours && (
                        <span className="contract-hours">
                          {staff.contracted_hours} hrs/week
                        </span>
                      )}
                    </p>
                    <p className="staff-rate">
                      <FiDollarSign className="icon" />
                      {formatCurrency(staff.base_pay_rate)}/hr
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
        
        {/* Staff Profile Modal */}
        {selectedStaff && (
          <div className="modal-overlay" onClick={() => setSelectedStaff(null)}>
            <div className="modal-content staff-profile-modal glass-panel" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Staff Profile</h3>
                <div className="modal-actions">
                  <button
                    className="icon-btn"
                    title="Edit"
                    onClick={() => {
                      setEditStaff(selectedStaff);
                      setIsEditModalOpen(true);
                    }}
                  >
                    <FiEdit />
                  </button>
                  <button
                    className="icon-btn danger"
                    title="Delete"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                  >
                    <FiTrash />
                  </button>
                  <button className="modal-close" onClick={() => setSelectedStaff(null)}>
                    <FiXCircle />
                  </button>
                </div>
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
                      <span className={`badge ${getRoleBadge(selectedStaff.position)}`}>
                        {formatRole(selectedStaff.position)}
                      </span>
                      <span className={`badge ${getSchadsBadge(selectedStaff.schads_level)}`}>
                        SCHADS L{selectedStaff.schads_level || 2}
                      </span>
                      <span className={`badge ${getStatusBadge(selectedStaff.status)}`}>
                        {selectedStaff.status}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="profile-content">
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
                          <span className="detail-label">Position</span>
                          <span className="detail-value">{formatRole(selectedStaff.position)}</span>
                        </div>
                      </div>
                      <div className="detail-item">
                        <FiBriefcase className="detail-icon" />
                        <div className="detail-content">
                          <span className="detail-label">SCHADS Level</span>
                          <span className="detail-value">{selectedStaff.schads_level || 'N/A'}</span>
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
                          <span className="detail-label">Contracted Hours</span>
                          <span className="detail-value">{selectedStaff.contracted_hours || 0} hours/week</span>
                        </div>
                      </div>
                      <div className="detail-item">
                        <FiDollarSign className="detail-icon" />
                        <div className="detail-content">
                          <span className="detail-label">Base Pay Rate</span>
                          <span className="detail-value">{formatCurrency(selectedStaff.base_pay_rate)}/hour</span>
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
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---------------- New-Staff Modal ---------------- */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div
            className="modal-content glass-panel create-staff-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Create Staff</h3>
              <button className="modal-close" onClick={() => setIsCreateModalOpen(false)}>
                <FiXCircle />
              </button>
            </div>

            <form
              className="modal-body"
              onSubmit={(e) => {
                e.preventDefault();
                createStaffMutation.mutate(newStaff);
              }}
            >
              {/* Basic two-column grid */}
              <div className="form-grid">
                <label>
                  First Name
                  <input
                    required
                    value={newStaff.first_name}
                    onChange={(e) => setNewStaff({ ...newStaff, first_name: e.target.value })}
                  />
                </label>
                <label>
                  Last Name
                  <input
                    required
                    value={newStaff.last_name}
                    onChange={(e) => setNewStaff({ ...newStaff, last_name: e.target.value })}
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  />
                </label>
                <label>
                  Phone
                  <input
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  />
                </label>
                <label>
                  Position
                  <select
                    value={newStaff.position}
                    onChange={(e) => setNewStaff({ ...newStaff, position: e.target.value })}
                  >
                    <option value="support_worker">Support Worker</option>
                    <option value="team_leader">Team Leader</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={newStaff.status}
                    onChange={(e) => setNewStaff({ ...newStaff, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on_leave">On Leave</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </label>
                <label>
                  SCHADS Level
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={newStaff.schads_level}
                    onChange={(e) => setNewStaff({ ...newStaff, schads_level: parseInt(e.target.value) })}
                  />
                </label>
                <label>
                  Contracted Hours
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={newStaff.contracted_hours}
                    onChange={(e) => setNewStaff({ ...newStaff, contracted_hours: parseFloat(e.target.value) })}
                  />
                </label>
                <label>
                  Base Pay Rate
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newStaff.base_pay_rate}
                    onChange={(e) => setNewStaff({ ...newStaff, base_pay_rate: parseFloat(e.target.value) })}
                  />
                </label>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={createStaffMutation.isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createStaffMutation.isLoading}
                >
                  {createStaffMutation.isLoading ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- Edit-Staff Modal ---------------- */}
      {isEditModalOpen && editStaff && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div
            className="modal-content glass-panel create-staff-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Edit Staff</h3>
              <button
                className="modal-close"
                onClick={() => setIsEditModalOpen(false)}
              >
                <FiXCircle />
              </button>
            </div>

            <form
              className="modal-body"
              onSubmit={(e) => {
                e.preventDefault();
                updateStaffMutation.mutate(editStaff);
              }}
            >
              <div className="form-grid">
                <label>
                  First Name
                  <input
                    required
                    value={editStaff.first_name || ''}
                    onChange={(e) =>
                      setEditStaff({ ...editStaff, first_name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Last Name
                  <input
                    required
                    value={editStaff.last_name || ''}
                    onChange={(e) =>
                      setEditStaff({ ...editStaff, last_name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={editStaff.email || ''}
                    onChange={(e) =>
                      setEditStaff({ ...editStaff, email: e.target.value })
                    }
                  />
                </label>
                <label>
                  Phone
                  <input
                    value={editStaff.phone || ''}
                    onChange={(e) =>
                      setEditStaff({ ...editStaff, phone: e.target.value })
                    }
                  />
                </label>
                <label>
                  Position
                  <select
                    value={editStaff.position || 'support_worker'}
                    onChange={(e) =>
                      setEditStaff({ ...editStaff, position: e.target.value })
                    }
                  >
                    <option value="support_worker">Support Worker</option>
                    <option value="team_leader">Team Leader</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={editStaff.status || 'active'}
                    onChange={(e) =>
                      setEditStaff({ ...editStaff, status: e.target.value })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on_leave">On Leave</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </label>
                <label>
                  SCHADS Level
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={editStaff.schads_level || 2}
                    onChange={(e) =>
                      setEditStaff({ ...editStaff, schads_level: parseInt(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Contracted Hours
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={editStaff.contracted_hours || 0}
                    onChange={(e) =>
                      setEditStaff({ ...editStaff, contracted_hours: parseFloat(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Base Pay Rate
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editStaff.base_pay_rate || 0}
                    onChange={(e) =>
                      setEditStaff({ ...editStaff, base_pay_rate: parseFloat(e.target.value) })
                    }
                  />
                </label>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={updateStaffMutation.isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updateStaffMutation.isLoading}
                >
                  {updateStaffMutation.isLoading ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- Delete-Confirm Modal ---------------- */}
      {isDeleteConfirmOpen && selectedStaff && (
        <div
          className="modal-overlay"
          onClick={() => setIsDeleteConfirmOpen(false)}
        >
          <div
            className="modal-content glass-panel delete-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Confirm Delete</h3>
            </div>
            <div className="modal-body">
              <p>
                Delete {selectedStaff.first_name} {selectedStaff.last_name}? This
                cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={deleteStaffMutation.isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => deleteStaffMutation.mutate(selectedStaff.id)}
                disabled={deleteStaffMutation.isLoading}
              >
                {deleteStaffMutation.isLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Staff;
