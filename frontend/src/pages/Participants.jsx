import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  getParticipants, 
  createParticipant, 
  updateParticipant, 
  deleteParticipant,
  getParticipantEnrollments
} from '../api/api';
import '../styles/CrudPage.css';
import '../styles/Participants.css';

const Participants = () => {
    const [participants, setParticipants] = useState([]);
    const [enrollments, setEnrollments] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [formData, setFormData] = useState(null);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterSupervision, setFilterSupervision] = useState('all');
    const [sortBy, setSortBy] = useState('name');

    const initialFormState = {
        id: null,
        first_name: '',
        last_name: '',
        address: '',
        suburb: '',
        postcode: '',
        ndis_number: '',
        plan_management_type: 'agency', // agency, plan, self
        contact_phone: '',
        contact_email: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        supervision_multiplier: 1.0,
        support_needs: {
            mobility: false,
            communication: false,
            medical: false,
            behavioral: false,
            personal_care: false
        },
        notes: ''
    };

    // Helper function to parse JSON fields safely
    const parseJsonField = (field) => {
        if (!field) return {};
        if (typeof field === 'object') return field;
        try {
            return JSON.parse(field);
        } catch (e) {
            console.error('Error parsing JSON field:', e);
            return {};
        }
    };

    // Fetch all participants on component mount
    useEffect(() => {
        fetchParticipants();
    }, []);

    // Fetch enrollments for participants
    useEffect(() => {
        if (participants.length > 0) {
            fetchEnrollments();
        }
    }, [participants]);

    const fetchParticipants = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getParticipants();
            setParticipants(data);
        } catch (err) {
            setError('Failed to fetch participants. Please ensure the backend is running.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchEnrollments = async () => {
        try {
            // Fetch enrollments for each participant
            const enrollmentPromises = participants.map(p => 
                getParticipantEnrollments(p.id).catch(() => ({ enrollments: [] }))
            );
            
            const results = await Promise.all(enrollmentPromises);
            
            // Create a map of participant ID -> enrollments
            const enrollmentMap = {};
            participants.forEach((p, index) => {
                enrollmentMap[p.id] = results[index]?.enrollments || [];
            });
            
            setEnrollments(enrollmentMap);
        } catch (err) {
            console.error("Error fetching enrollments:", err);
        }
    };

    const handleAddClick = () => {
        setFormData(initialFormState);
        setIsFormVisible(true);
    };

    const handleEditClick = (participant) => {
        // Convert database representation to form representation using safe parsing
        const supportNeeds = parseJsonField(participant.support_needs);
            
        setFormData({ 
            ...participant, 
            plan_management_type: participant.plan_management_type || 'agency',
            supervision_multiplier: participant.supervision_multiplier || 1.0,
            support_needs: supportNeeds
        });
        setIsFormVisible(true);
    };

    const handleDeleteClick = async (id) => {
        if (window.confirm('Are you sure you want to delete this participant? This action cannot be undone.')) {
            try {
                await deleteParticipant(id);
                fetchParticipants(); // Refresh the list
            } catch (err) {
                setError('Failed to delete participant.');
                console.error(err);
            }
        }
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        if (name.startsWith('support_needs.')) {
            const needKey = name.split('.')[1];
            setFormData(prev => ({
                ...prev,
                support_needs: {
                    ...prev.support_needs,
                    [needKey]: checked
                }
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
        }
    };

    const handleSupervisionChange = (value) => {
        setFormData(prev => ({
            ...prev,
            supervision_multiplier: parseFloat(value)
        }));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            // Prepare data for API
            const dataPayload = { 
                ...formData,
                support_needs: JSON.stringify(formData.support_needs)
            };

            if (formData.id) {
                // Update existing participant
                await updateParticipant(formData.id, dataPayload);
            } else {
                // Create new participant
                await createParticipant(dataPayload);
            }
            fetchParticipants(); // Refresh the list
            setIsFormVisible(false);
            setFormData(null);
        } catch (err) {
            setError('Failed to save participant. Please check the form data and try again.');
            console.error(err);
        }
    };

    const handleCancelClick = () => {
        setIsFormVisible(false);
        setFormData(null);
        setError(null);
    };

    // Get management type display
    const getManagementTypeDisplay = (type) => {
        switch(type) {
            case 'plan': return 'Plan-Managed';
            case 'self': return 'Self-Managed';
            case 'ndia': return 'NDIA-Managed';
            default: return 'Agency-Managed';
        }
    };

    // Get management type color
    const getManagementTypeColor = (type) => {
        switch(type) {
            case 'plan': return '#2196f3'; // Blue
            case 'self': return '#4caf50'; // Green
            case 'ndia': return '#ff9800'; // Orange
            default: return '#9e9e9e'; // Grey
        }
    };

    // Get supervision multiplier color
    const getSupervisionColor = (multiplier) => {
        if (!multiplier || multiplier === 1.0) return '#9e9e9e';
        if (multiplier < 1.5) return '#4caf50';
        if (multiplier < 2.0) return '#ff9800';
        return '#e53935';
    };

    // Filter and sort participants
    const filteredParticipants = participants.filter(p => {
        // Search filter
        if (search.trim() !== '') {
            const term = search.toLowerCase();
            const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
            
            if (!fullName.includes(term) && 
                !(p.ndis_number && p.ndis_number.toLowerCase().includes(term)) &&
                !(p.suburb && p.suburb.toLowerCase().includes(term)) &&
                !(p.contact_phone && p.contact_phone.includes(term))) {
                return false;
            }
        }
        
        // Status filter
        if (filterStatus !== 'all' && p.plan_management_type !== filterStatus) {
            return false;
        }
        
        // Supervision filter
        if (filterSupervision !== 'all') {
            const multiplier = parseFloat(p.supervision_multiplier || 1.0);
            if (filterSupervision === 'standard' && multiplier !== 1.0) {
                return false;
            } else if (filterSupervision === 'elevated' && multiplier < 1.25) {
                return false;
            } else if (filterSupervision === 'high' && multiplier < 2.0) {
                return false;
            }
        }
        
        return true;
    }).sort((a, b) => {
        switch(sortBy) {
            case 'name':
                return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
            case 'supervision':
                return (parseFloat(b.supervision_multiplier || 1.0) - parseFloat(a.supervision_multiplier || 1.0));
            case 'enrollment':
                return ((enrollments[b.id] || []).length - (enrollments[a.id] || []).length);
            default:
                return 0;
        }
    });

    return (
        <>
        <div className="crud-page-container">
            <h1>Participant Management</h1>

            {error && <p className="error-message">{error}</p>}

            {!isFormVisible && (
                <>
                    {/* --- Control Bar -------------------------------- */}
                    <div className="participant-control-bar">
                        <button onClick={handleAddClick} className="add-new-button">
                            Add New Participant
                        </button>
                        
                        <div className="participant-filters">
                            <div className="search-container">
                                <input
                                    type="text"
                                    placeholder="Search by name, NDIS, suburb..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="participant-search"
                                />
                            </div>
                            
                            <select 
                                value={filterStatus} 
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">All Management Types</option>
                                <option value="agency">Agency-Managed</option>
                                <option value="plan">Plan-Managed</option>
                                <option value="self">Self-Managed</option>
                                <option value="ndia">NDIA-Managed</option>
                            </select>
                            
                            <select 
                                value={filterSupervision} 
                                onChange={(e) => setFilterSupervision(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">All Supervision Levels</option>
                                <option value="standard">Standard (1.0)</option>
                                <option value="elevated">Elevated (1.25+)</option>
                                <option value="high">High Needs (2.0+)</option>
                            </select>
                            
                            <select 
                                value={sortBy} 
                                onChange={(e) => setSortBy(e.target.value)}
                                className="filter-select"
                            >
                                <option value="name">Sort by Name</option>
                                <option value="supervision">Sort by Supervision Level</option>
                                <option value="enrollment">Sort by Enrollment Count</option>
                            </select>
                        </div>
                    </div>
                    
                    {/* --- Card Grid ---------------------------------- */}
                    {loading ? (
                        <p>Loading participants...</p>
                    ) : (
                        <div className="participant-card-grid">
                            {filteredParticipants.length === 0 ? (
                                <p className="no-results">No participants match your filters</p>
                            ) : (
                                filteredParticipants.map(p => {
                                    const managementType = p.plan_management_type || 'agency';
                                    const managementColor = getManagementTypeColor(managementType);
                                    const supervisionMultiplier = parseFloat(p.supervision_multiplier || 1.0);
                                    const supervisionColor = getSupervisionColor(supervisionMultiplier);
                                    const participantEnrollments = enrollments[p.id] || [];
                                    const supportNeeds = parseJsonField(p.support_needs);
                                    
                                    return (
                                        <div className="participant-card" key={p.id}>
                                            <div className="participant-card-header">
                                                <div 
                                                    className="participant-photo"
                                                    /* TODO: replace with real participant photo */
                                                    style={{ backgroundColor: '#e0e0e0' }}
                                                >
                                                    {p.first_name[0]}{p.last_name[0]}
                                                </div>
                                                
                                                <div className="participant-main-info">
                                                    <h3>{p.first_name} {p.last_name}</h3>
                                                    
                                                    <div className="participant-ndis">
                                                        {p.ndis_number ? (
                                                            <>NDIS: {p.ndis_number}</>
                                                        ) : (
                                                            <span className="no-ndis">No NDIS Number</span>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <span 
                                                    className="management-chip"
                                                    style={{ backgroundColor: managementColor }}
                                                >
                                                    {getManagementTypeDisplay(managementType)}
                                                </span>
                                            </div>
                                            
                                            {/* Supervision Multiplier */}
                                            <div className="supervision-section">
                                                <div className="supervision-header">
                                                    <span>Supervision Multiplier</span>
                                                    <span 
                                                        className="supervision-value"
                                                        style={{ color: supervisionColor }}
                                                    >
                                                        {supervisionMultiplier.toFixed(2)}×
                                                    </span>
                                                </div>
                                                <div className="supervision-bar-container">
                                                    <div className="supervision-bar-bg">
                                                        <div 
                                                            className="supervision-bar-fg"
                                                            style={{ 
                                                                width: `${Math.min((supervisionMultiplier/2.5)*100, 100)}%`,
                                                                backgroundColor: supervisionColor
                                                            }}
                                                        ></div>
                                                    </div>
                                                </div>
                                                <div className="supervision-impact">
                                                    {supervisionMultiplier > 1.0 ? (
                                                        <span>Requires {((supervisionMultiplier - 1.0) * 100).toFixed(0)}% additional support</span>
                                                    ) : (
                                                        <span>Standard supervision level</span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Support Needs Tags */}
                                            <div className="support-needs-section">
                                                {Object.entries(supportNeeds).map(([need, required]) => 
                                                    required && (
                                                        <span 
                                                            key={need} 
                                                            className="support-need-tag"
                                                            title={`Requires ${need.replace('_', ' ')} support`}
                                                        >
                                                            {need.replace('_', ' ')}
                                                        </span>
                                                    )
                                                )}
                                                {!Object.values(supportNeeds).some(v => v) && (
                                                    <span className="no-special-needs">No special support needs</span>
                                                )}
                                            </div>
                                            
                                            {/* Contact Information */}
                                            <div className="contact-section">
                                                {p.contact_phone && (
                                                    <div className="contact-item">
                                                        <strong>Phone:</strong> {p.contact_phone}
                                                    </div>
                                                )}
                                                {p.contact_email && (
                                                    <div className="contact-item">
                                                        <strong>Email:</strong> {p.contact_email}
                                                    </div>
                                                )}
                                                {p.emergency_contact_name && (
                                                    <div className="contact-item emergency">
                                                        <strong>Emergency:</strong> {p.emergency_contact_name} ({p.emergency_contact_phone})
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Program Enrollments */}
                                            <div className="enrollments-section">
                                                <h4>Program Enrollments ({participantEnrollments.length})</h4>
                                                {participantEnrollments.length > 0 ? (
                                                    <div className="enrollment-list">
                                                        {participantEnrollments.slice(0, 2).map(e => (
                                                            <div key={e.id} className="enrollment-item">
                                                                {e.program_name || 'Unnamed Program'}
                                                            </div>
                                                        ))}
                                                        {participantEnrollments.length > 2 && (
                                                            <div className="enrollment-more">
                                                                +{participantEnrollments.length - 2} more
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="no-enrollments">
                                                        Not enrolled in any programs
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Actions */}
                                            <div className="participant-card-actions">
                                                <button
                                                    className="edit-button"
                                                    onClick={() => handleEditClick(p)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="delete-button"
                                                    onClick={() => handleDeleteClick(p.id)}
                                                >
                                                    Delete
                                                </button>
                                                <Link 
                                                    to={`/participant-planner?id=${p.id}`} 
                                                    className="planner-button"
                                                >
                                                    Plan
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </>
            )}

            {isFormVisible && formData && (
                <div className="form-container participant-form">
                    <h2>{formData.id ? 'Edit Participant' : 'Add New Participant'}</h2>
                    <form onSubmit={handleFormSubmit}>
                        <div className="form-grid">
                            <div className="form-field">
                                <label>First Name</label>
                                <input type="text" name="first_name" value={formData.first_name} onChange={handleFormChange} required />
                            </div>
                            <div className="form-field">
                                <label>Last Name</label>
                                <input type="text" name="last_name" value={formData.last_name} onChange={handleFormChange} required />
                            </div>
                            <div className="form-field">
                                <label>NDIS Number</label>
                                <input type="text" name="ndis_number" value={formData.ndis_number || ''} onChange={handleFormChange} />
                            </div>
                            <div className="form-field">
                                <label>Plan Management</label>
                                <select 
                                    name="plan_management_type" 
                                    value={formData.plan_management_type} 
                                    onChange={handleFormChange}
                                >
                                    <option value="agency">Agency-Managed</option>
                                    <option value="plan">Plan-Managed</option>
                                    <option value="self">Self-Managed</option>
                                    <option value="ndia">NDIA-Managed</option>
                                </select>
                            </div>
                            <div className="form-field">
                                <label>Address</label>
                                <input type="text" name="address" value={formData.address || ''} onChange={handleFormChange} />
                            </div>
                            <div className="form-field">
                                <label>Suburb</label>
                                <input type="text" name="suburb" value={formData.suburb || ''} onChange={handleFormChange} />
                            </div>
                            <div className="form-field">
                                <label>Postcode</label>
                                <input type="text" name="postcode" value={formData.postcode || ''} onChange={handleFormChange} />
                            </div>
                            <div className="form-field">
                                <label>Contact Phone</label>
                                <input type="tel" name="contact_phone" value={formData.contact_phone || ''} onChange={handleFormChange} />
                            </div>
                            <div className="form-field">
                                <label>Contact Email</label>
                                <input type="email" name="contact_email" value={formData.contact_email || ''} onChange={handleFormChange} />
                            </div>
                            <div className="form-field">
                                <label>Emergency Contact Name</label>
                                <input type="text" name="emergency_contact_name" value={formData.emergency_contact_name || ''} onChange={handleFormChange} />
                            </div>
                            <div className="form-field">
                                <label>Emergency Contact Phone</label>
                                <input type="tel" name="emergency_contact_phone" value={formData.emergency_contact_phone || ''} onChange={handleFormChange} />
                            </div>
                            
                            {/* Supervision Multiplier */}
                            <div className="form-field full-width">
                                <label>
                                    Supervision Multiplier: {parseFloat(formData.supervision_multiplier).toFixed(2)}
                                </label>
                                <div className="slider-container">
                                    <input
                                        type="range"
                                        min="1"
                                        max="2.5"
                                        step="0.25"
                                        value={formData.supervision_multiplier}
                                        onChange={(e) => handleSupervisionChange(e.target.value)}
                                        className="supervision-slider"
                                    />
                                    <div className="slider-labels">
                                        <span>1.0×</span>
                                        <span>1.5×</span>
                                        <span>2.0×</span>
                                        <span>2.5×</span>
                                    </div>
                                </div>
                                <div className="supervision-impact-message">
                                    {formData.supervision_multiplier > 1.0 ? (
                                        <span>This participant will count as {formData.supervision_multiplier} participants for staffing ratio calculations.</span>
                                    ) : (
                                        <span>Standard supervision level (1:4 ratio)</span>
                                    )}
                                </div>
                            </div>
                            
                            {/* Support Needs */}
                            <div className="form-field full-width">
                                <label>Support Needs</label>
                                <div className="support-needs-checkboxes">
                                    <label className="support-need-checkbox">
                                        <input
                                            type="checkbox"
                                            name="support_needs.mobility"
                                            checked={formData.support_needs.mobility}
                                            onChange={handleFormChange}
                                        />
                                        Mobility Support
                                    </label>
                                    <label className="support-need-checkbox">
                                        <input
                                            type="checkbox"
                                            name="support_needs.communication"
                                            checked={formData.support_needs.communication}
                                            onChange={handleFormChange}
                                        />
                                        Communication Support
                                    </label>
                                    <label className="support-need-checkbox">
                                        <input
                                            type="checkbox"
                                            name="support_needs.medical"
                                            checked={formData.support_needs.medical}
                                            onChange={handleFormChange}
                                        />
                                        Medical Support
                                    </label>
                                    <label className="support-need-checkbox">
                                        <input
                                            type="checkbox"
                                            name="support_needs.behavioral"
                                            checked={formData.support_needs.behavioral}
                                            onChange={handleFormChange}
                                        />
                                        Behavioral Support
                                    </label>
                                    <label className="support-need-checkbox">
                                        <input
                                            type="checkbox"
                                            name="support_needs.personal_care"
                                            checked={formData.support_needs.personal_care}
                                            onChange={handleFormChange}
                                        />
                                        Personal Care Support
                                    </label>
                                </div>
                            </div>
                            
                            <div className="form-field full-width">
                                <label>Notes</label>
                                <textarea name="notes" value={formData.notes || ''} onChange={handleFormChange}></textarea>
                            </div>
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="save-button">Save Participant</button>
                            <button type="button" onClick={handleCancelClick} className="cancel-button">Cancel</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
        </>
    );
};

export default Participants;
