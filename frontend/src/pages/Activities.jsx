import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';
import { 
  FiCalendar, 
  FiEdit2, 
  FiTrash2, 
  FiSave, 
  FiX, 
  FiPlusCircle,
  FiActivity
} from 'react-icons/fi';
import '../styles/Activities.css';

const Activities = () => {
  // State for programs and activities
  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // State for the new activity form
  const [newActivity, setNewActivity] = useState({
    activity_date: new Date().toISOString().split('T')[0],
    name: '',
    address: '',
    activity_cost: '',
    food_budget: '',
    notes: ''
  });
  
  // State for editing
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  
  // Fetch eligible programs on component mount
  useEffect(() => {
    fetchPrograms();
  }, []);
  
  // Fetch activities when a program is selected
  useEffect(() => {
    if (selectedProgramId) {
      fetchActivities();
    } else {
      setActivities([]);
    }
  }, [selectedProgramId]);
  
  // Fetch programs from API
  const fetchPrograms = async () => {
    try {
      setLoading(true);
      const response = await api.get('/activities/programs');
      if (response.data.success) {
        setPrograms(response.data.data);
      } else {
        toast.error('Failed to fetch programs');
      }
    } catch (err) {
      console.error('Error fetching programs:', err);
      toast.error('Failed to fetch programs');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch activities for selected program
  const fetchActivities = async () => {
    if (!selectedProgramId) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/activities/${selectedProgramId}`);
      if (response.data.success) {
        setActivities(response.data.data);
      } else {
        toast.error('Failed to fetch activities');
      }
    } catch (err) {
      console.error('Error fetching activities:', err);
      toast.error('Failed to fetch activities');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle input change for new activity form
  const handleNewActivityChange = (e) => {
    const { name, value } = e.target;
    setNewActivity({
      ...newActivity,
      [name]: value
    });
  };
  
  // Handle input change for edit form
  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm({
      ...editForm,
      [name]: value
    });
  };
  
  // Add new activity
  const addActivity = async (e) => {
    e.preventDefault();
    
    if (!selectedProgramId) {
      toast.warning('Please select a program first');
      return;
    }
    
    if (!newActivity.activity_date || !newActivity.name) {
      toast.warning('Date and name are required');
      return;
    }
    
    try {
      setLoading(true);
      const response = await api.post(`/activities/${selectedProgramId}`, newActivity);
      
      if (response.data.success) {
        toast.success('Activity added successfully');
        // Reset form
        setNewActivity({
          activity_date: new Date().toISOString().split('T')[0],
          name: '',
          address: '',
          activity_cost: '',
          food_budget: '',
          notes: ''
        });
        // Refresh activities list
        fetchActivities();
      } else {
        toast.error('Failed to add activity');
      }
    } catch (err) {
      console.error('Error adding activity:', err);
      toast.error('Failed to add activity');
    } finally {
      setLoading(false);
    }
  };
  
  // Start editing an activity
  const startEdit = (activity) => {
    setEditingId(activity.id);
    setEditForm({
      activity_date: activity.activity_date,
      name: activity.name,
      address: activity.address || '',
      activity_cost: activity.activity_cost || '',
      food_budget: activity.food_budget || '',
      notes: activity.notes || ''
    });
  };
  
  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };
  
  // Save edited activity
  const saveActivity = async () => {
    if (!selectedProgramId || !editingId) return;
    
    if (!editForm.activity_date || !editForm.name) {
      toast.warning('Date and name are required');
      return;
    }
    
    try {
      setLoading(true);
      const response = await api.patch(`/activities/${selectedProgramId}/${editingId}`, editForm);
      
      if (response.data.success) {
        toast.success('Activity updated successfully');
        setEditingId(null);
        setEditForm({});
        // Refresh activities list
        fetchActivities();
      } else {
        toast.error('Failed to update activity');
      }
    } catch (err) {
      console.error('Error updating activity:', err);
      toast.error('Failed to update activity');
    } finally {
      setLoading(false);
    }
  };
  
  // Delete an activity
  const deleteActivity = async (id) => {
    if (!selectedProgramId) return;
    
    // Confirm before deleting
    if (!window.confirm('Are you sure you want to delete this activity?')) {
      return;
    }
    
    try {
      setLoading(true);
      const response = await api.delete(`/activities/${selectedProgramId}/${id}`);
      
      if (response.data.success) {
        toast.success('Activity deleted successfully');
        // Refresh activities list
        fetchActivities();
      } else {
        toast.error('Failed to delete activity');
      }
    } catch (err) {
      console.error('Error deleting activity:', err);
      toast.error('Failed to delete activity');
    } finally {
      setLoading(false);
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  // Format currency for display
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || amount === '') return '';
    return `$${parseFloat(amount).toFixed(2)}`;
  };
  
  return (
    <div className="activities-page">
      <div className="page-header">
        <h2 className="page-title"><FiActivity /> Activities</h2>
      </div>
      
      {/* Program Selection */}
      <div className="glass-card mb-4">
        <div className="card-header">
          <h3>Select Program</h3>
        </div>
        <div className="card-body">
          <div className="form-group">
            <select
              className="form-control"
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
              disabled={loading}
            >
              <option value="">Select a program</option>
              {programs.map(program => (
                <option key={program.id} value={program.id}>
                  {program.name} ({program.program_type})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {selectedProgramId && (
        <>
          {/* New Activity Form */}
          <div className="glass-card mb-4">
            <div className="card-header">
              <h3>Add New Activity</h3>
            </div>
            <div className="card-body">
              <form onSubmit={addActivity}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date *</label>
                    <input
                      type="date"
                      name="activity_date"
                      value={newActivity.activity_date}
                      onChange={handleNewActivityChange}
                      className="form-control"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={newActivity.name}
                      onChange={handleNewActivityChange}
                      className="form-control"
                      placeholder="Activity name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Address</label>
                    <input
                      type="text"
                      name="address"
                      value={newActivity.address}
                      onChange={handleNewActivityChange}
                      className="form-control"
                      placeholder="Address"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Activity Cost</label>
                    <input
                      type="number"
                      name="activity_cost"
                      value={newActivity.activity_cost}
                      onChange={handleNewActivityChange}
                      className="form-control"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Food Budget</label>
                    <input
                      type="number"
                      name="food_budget"
                      value={newActivity.food_budget}
                      onChange={handleNewActivityChange}
                      className="form-control"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Notes</label>
                    <textarea
                      name="notes"
                      value={newActivity.notes}
                      onChange={handleNewActivityChange}
                      className="form-control"
                      placeholder="Notes about the activity"
                      rows="2"
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    <FiPlusCircle /> Add Activity
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          {/* Activities List */}
          <div className="glass-card">
            <div className="card-header">
              <h3>Activities</h3>
            </div>
            <div className="card-body">
              {activities.length === 0 ? (
                <p className="text-center">No activities found for this program.</p>
              ) : (
                <div className="activities-table-container">
                  <table className="activities-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Name</th>
                        <th>Address</th>
                        <th>Activity Cost</th>
                        <th>Food Budget</th>
                        <th>Notes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities.map(activity => (
                        <tr key={activity.id}>
                          {editingId === activity.id ? (
                            // Edit mode
                            <>
                              <td>
                                <input
                                  type="date"
                                  name="activity_date"
                                  value={editForm.activity_date}
                                  onChange={handleEditFormChange}
                                  className="form-control"
                                  required
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  name="name"
                                  value={editForm.name}
                                  onChange={handleEditFormChange}
                                  className="form-control"
                                  required
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  name="address"
                                  value={editForm.address}
                                  onChange={handleEditFormChange}
                                  className="form-control"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  name="activity_cost"
                                  value={editForm.activity_cost}
                                  onChange={handleEditFormChange}
                                  className="form-control"
                                  step="0.01"
                                  min="0"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  name="food_budget"
                                  value={editForm.food_budget}
                                  onChange={handleEditFormChange}
                                  className="form-control"
                                  step="0.01"
                                  min="0"
                                />
                              </td>
                              <td>
                                <textarea
                                  name="notes"
                                  value={editForm.notes}
                                  onChange={handleEditFormChange}
                                  className="form-control"
                                  rows="2"
                                />
                              </td>
                              <td>
                                <div className="action-buttons">
                                  <button 
                                    className="btn btn-sm btn-primary"
                                    onClick={saveActivity}
                                    disabled={loading}
                                  >
                                    <FiSave />
                                  </button>
                                  <button 
                                    className="btn btn-sm btn-secondary"
                                    onClick={cancelEdit}
                                  >
                                    <FiX />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            // Display mode
                            <>
                              <td>{formatDate(activity.activity_date)}</td>
                              <td>{activity.name}</td>
                              <td>{activity.address}</td>
                              <td>{formatCurrency(activity.activity_cost)}</td>
                              <td>{formatCurrency(activity.food_budget)}</td>
                              <td>{activity.notes}</td>
                              <td>
                                <div className="action-buttons">
                                  <button 
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => startEdit(activity)}
                                    disabled={loading}
                                  >
                                    <FiEdit2 />
                                  </button>
                                  <button 
                                    className="btn btn-sm btn-danger"
                                    onClick={() => deleteActivity(activity.id)}
                                    disabled={loading}
                                  >
                                    <FiTrash2 />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Activities;
