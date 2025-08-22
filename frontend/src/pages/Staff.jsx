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
  FiHome,
  FiXCircle,
  FiRefreshCw,
  FiDollarSign,
  FiBriefcase,
  FiCalendar,
  FiArrowLeft,
  FiArrowRight,
  FiBarChart2
} from 'react-icons/fi';

// Page-specific styles
import '../styles/Staff.css';

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
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const staffPerPage = 12;
  const [activeTab, setActiveTab] = useState('directory');
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);
  const emptyLeave = { id:null, staff_id:'', type:'AL', start_date:'', end_date:'', hours:0, status:'pending', reason:'' };
  const [leaveForm, setLeaveForm] = useState(emptyLeave);

  const openNewLeave = () => { setEditingLeave(null); setLeaveForm(emptyLeave); setIsLeaveModalOpen(true); };
  const openEditLeave = (req) => { setEditingLeave(req); setLeaveForm(req); setIsLeaveModalOpen(true); };
  const saveLeave = (e) => {
    e.preventDefault();
    if (editingLeave) {
      setLeaveRequests(prev => prev.map(r => r.id===editingLeave.id ? {...leaveForm} : r));
    } else {
      const newId = Date.now();
      setLeaveRequests(prev => [{...leaveForm, id:newId}, ...prev]);
    }
    setIsLeaveModalOpen(false);
  };
  const deleteLeave = (id) => setLeaveRequests(prev => prev.filter(r => r.id!==id));
  const approveLeave = (id) => setLeaveRequests(prev => prev.map(r => r.id===id ? {...r, status:'approved'} : r));
  const denyLeave = (id) => setLeaveRequests(prev => prev.map(r => r.id===id ? {...r, status:'denied'} : r));

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

  // Handle tab switching with gating
  const handleTabSwitch = (tab) => {
    if (tab === 'reports' && !selectedStaffId) {
      setToast({ visible: true, message: 'Select a staff member first to access Reports.' });
      setTimeout(() => setToast({ visible: false, message: '' }), 2500);
      return;
    }
    setActiveTab(tab);
  };

  // Utilisation helpers
  const isCasual = (s) => s?.employment_type === 'casual';
  const contractHours = (s) => isCasual(s) ? 0 : (s?.contracted_hours ?? 0);
  const currentFortnightHours = (s) => s?.current_fortnight_hours ?? 0; // placeholder until Xero integration
  const utilisationPct = (s) => {
    const ch = contractHours(s);
    const cur = currentFortnightHours(s);
    if (!ch) return 0;
    return Math.min(100, Math.max(0, Math.round((cur/ch)*100)));
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
                className={`staff-card glass-card ${selectedStaffId === staff.id ? 'selected' : ''}`}
                onClick={() => setSelectedStaffId(staff.id)}
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
                  <h3 className="staff-name">{staff.first_name} {staff.last_name}</h3>
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
                      <div className="contact-item phone">
                        <FiPhone className="contact-icon" />
                        <span>{staff.phone}</span>
                      </div>
                    )}
                    {staff.address && (
                      <div className="contact-item address">
                        <FiHome className="contact-icon" />
                        <span>
                          {staff.address}
                          {staff.suburb && `, ${staff.suburb}`}
                          {staff.state && `, ${staff.state}`}
                          {staff.postcode && ` ${staff.postcode}`}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="staff-util-mini">
                    {isCasual(staff) ? (
                      <span className="util-casual-label">Casual</span>
                    ) : (
                      <div className="util-mini-bg">
                        <div className={`util-mini-fg ${currentFortnightHours(staff)>contractHours(staff)?'over':'under'}`} style={{width: `${utilisationPct(staff)}%`}}></div>
                      </div>
                    )}
                  </div>
                  
                  <div className="staff-actions">
                    <button
                      className="action-btn edit"
                      title="Edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditStaff(staff);
                        setIsEditModalOpen(true);
                      }}
                    >
                      <FiEdit />
                    </button>
                    <button
                      className="action-btn delete"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStaff(staff);
                        setIsDeleteConfirmOpen(true);
                      }}
                    >
                      <FiTrash />
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

      {/* ---------------- New-Staff Modal ---------------- */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div
            className="modal-content glass-panel create-staff-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Create Staff</h3>
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
    </div>
  );

  // Render leave tab content
  const renderLeaveTab = () => (
    <div className="leave-tab">
      <div className="glass-panel leave-header">
        <h3>Leave Management</h3>
        <div className="actions">
          <button className="btn btn-primary" onClick={openNewLeave}><FiPlus/> New Leave Request</button>
        </div>
      </div>

      <div className="two-col">
        <div className="col">
          <div className="glass-card">
            <h4>Requests</h4>
            <div className="table-responsive">
              <table className="leave-table">
                <thead>
                  <tr>
                    <th>Staff</th><th>Type</th><th>Start</th><th>End</th><th>Hours</th><th>Status</th><th>Reason</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.length === 0 ? (
                    <tr><td colSpan="8" className="empty-table-message">No leave requests</td></tr>
                  ) : leaveRequests.map(req => {
                    const s = (staffData?.data || []).find(x=>x.id===req.staff_id) || {};
                    return (
                      <tr key={req.id} className={`status-${req.status}`}>
                        <td>{s.first_name} {s.last_name}</td>
                        <td>{req.type}</td>
                        <td>{formatDate(req.start_date)}</td>
                        <td>{formatDate(req.end_date)}</td>
                        <td>{req.hours}</td>
                        <td><span className={`badge ${req.status==='approved'?'badge-green':req.status==='denied'?'badge-red':'badge-yellow'}`}>{req.status}</span></td>
                        <td className="reason-cell">{req.reason}</td>
                        <td className="actions-cell">
                          <button className="btn btn-secondary btn-sm" onClick={()=>openEditLeave(req)}>Modify</button>
                          <button className="btn btn-success btn-sm" onClick={()=>approveLeave(req.id)} disabled={req.status==='approved'}>Approve</button>
                          <button className="btn btn-warning btn-sm" onClick={()=>denyLeave(req.id)} disabled={req.status==='denied'}>Deny</button>
                          <button className="btn btn-danger btn-sm" onClick={()=>deleteLeave(req.id)}>Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col">
          <div className="glass-card">
            <h4>Fortnight Utilisation</h4>
            <div className="util-list">
              {(staffData?.data || []).map(s => (
                <div key={s.id} className="util-row">
                  <div className="util-meta">
                    <div className="name">{s.first_name} {s.last_name}</div>
                    <div className="hours">
                      {isCasual(s) ? 'Casual' : `${currentFortnightHours(s)} / ${contractHours(s)} hrs`}
                    </div>
                  </div>
                  <div className={`util-bar ${isCasual(s)?'casual':''}`}>
                    <div className="bg">
                      <div className={`fg ${currentFortnightHours(s)>contractHours(s)?'over':'under'}`} style={{width: `${utilisationPct(s)}%`}}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isLeaveModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsLeaveModalOpen(false)}>
          <div className="modal-content glass-panel" onClick={(e)=>e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingLeave? 'Modify Leave' : 'New Leave Request'}</h3>
              <button className="modal-close" onClick={()=>setIsLeaveModalOpen(false)}><FiXCircle/></button>
            </div>
            <form className="modal-body" onSubmit={saveLeave}>
              <div className="form-grid">
                <label>Staff
                  <select required value={leaveForm.staff_id} onChange={(e)=>setLeaveForm({...leaveForm, staff_id: parseInt(e.target.value) })}>
                    <option value="">Select staff</option>
                    {(staffData?.data||[]).map(s=>(<option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>))}
                  </select>
                </label>
                <label>Type
                  <select value={leaveForm.type} onChange={(e)=>setLeaveForm({...leaveForm, type:e.target.value})}>
                    <option value="AL">Annual Leave</option>
                    <option value="SL">Sick Leave</option>
                    <option value="LSL">Long Service Leave</option>
                    <option value="LWOP">Leave Without Pay</option>
                  </select>
                </label>
                <label>Start Date
                  <input type="date" required value={leaveForm.start_date} onChange={(e)=>setLeaveForm({...leaveForm, start_date:e.target.value})}/>
                </label>
                <label>End Date
                  <input type="date" required value={leaveForm.end_date} onChange={(e)=>setLeaveForm({...leaveForm, end_date:e.target.value})}/>
                </label>
                <label>Hours
                  <input type="number" min="0" step="0.25" value={leaveForm.hours} onChange={(e)=>setLeaveForm({...leaveForm, hours: parseFloat(e.target.value)})}/>
                </label>
                <label>Reason
                  <input value={leaveForm.reason} onChange={(e)=>setLeaveForm({...leaveForm, reason:e.target.value})}/>
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setIsLeaveModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingLeave? 'Save' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // Render HR tab content
  const renderHRTab = () => (
    <div className="hr-tab">
      <div className="glass-panel"><h3>HR Tools & Procedures</h3><p>Run HR workflows and view HR reports.</p></div>
      <div className="glass-card"><p>Coming soon: onboarding, compliance, training, and HR reports.</p></div>
    </div>
  );

  // Render reports tab content
  const renderReportsTab = () => (
    <div className="reports-tab">
      <div className="glass-panel"><h3>Staff Reports</h3><p>Generate staff-specific reports.</p></div>
      {!selectedStaffId ? (
        <div className="glass-card"><p>Select a staff member from the Directory to view reports.</p></div>
      ) : (
        <div className="glass-card">
          {(() => {
            const staff = staffData?.data?.find(s => s.id === selectedStaffId);
            return (
              <p>Coming soon: staff report tiles and preview for {staff?.first_name} {staff?.last_name}.</p>
            );
          })()}
        </div>
      )}
    </div>
  );

  return (
    <div className="staff-page">
      <div className="page-header">
        <h2 className="page-title">Staff</h2>
        <div className="page-tabs">
          <button className={`tab-button ${activeTab==='directory'?'active':''}`} onClick={() => setActiveTab('directory')}><FiUsers /><span>Directory</span></button>
          <button className={`tab-button ${activeTab==='leave'?'active':''}`} onClick={() => handleTabSwitch('leave')}><FiCalendar /><span>Leave</span></button>
          <button className={`tab-button ${activeTab==='hr'?'active':''}`} onClick={() => handleTabSwitch('hr')}><FiBriefcase /><span>HR</span></button>
          <button className={`tab-button ${activeTab==='reports'?'active':''}`} onClick={() => handleTabSwitch('reports')}><FiBarChart2 /><span>Reports</span></button>
        </div>
      </div>

      <div className="tab-content">
        {activeTab==='directory' && renderDirectoryTab()}
        {activeTab==='leave' && renderLeaveTab()}
        {activeTab==='hr' && renderHRTab()}
        {activeTab==='reports' && renderReportsTab()}
      </div>

      {toast.visible && (<div className="toast-notice">{toast.message}</div>)}
    </div>
  );
};

export default Staff;
