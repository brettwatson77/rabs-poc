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
        plan_management_type: 'agency_managed', // agency_managed, plan_managed, self_managed, self_funded
        phone: '',
        email: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        supervision_multiplier: 1.0,
        mobility_needs: '',
        allergies: '',
        medication_needs: '',
        has_behavior_support_plan: false,
        /* ------------ Support-needs Boolean Flags (default false) ------------ */
        has_wheelchair_access: false,
        has_dietary_requirements: false,
        has_medical_requirements: false,
        has_behavioral_support: false,
        has_visual_impairment: false,
        has_hearing_impairment: false,
        has_cognitive_support: false,
        has_communication_needs: false,
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
        setFormData({
            ...participant,
            plan_management_type: participant.plan_management_type || 'agency',
            supervision_multiplier: participant.supervision_multiplier || 1.0,
            mobility_needs: participant.mobility_needs || participant.mobility_requirements || '',
            allergies: participant.allergies || participant.dietary_requirements || '',
            medication_needs: participant.medication_needs || participant.medical_requirements || '',
            has_behavior_support_plan: participant.has_behavior_support_plan ?? participant.behavior_support_plan ?? false,

            /* ----- Ensure all boolean support-flags are present ----- */
            has_wheelchair_access:
                participant.has_wheelchair_access || false,
            has_dietary_requirements:
                participant.has_dietary_requirements || false,
            has_medical_requirements:
                participant.has_medical_requirements || false,
            has_behavioral_support:
                participant.has_behavioral_support || false,
            has_visual_impairment:
                participant.has_visual_impairment || false,
            has_hearing_impairment:
                participant.has_hearing_impairment || false,
            has_cognitive_support:
                participant.has_cognitive_support || false,
            has_communication_needs:
                participant.has_communication_needs || false
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
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
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
            const sanitised = { ...formData };
            if (formData.id) {
                // Update existing participant
                await updateParticipant(formData.id, sanitised);
            } else {
                // Create new participant
                await createParticipant(sanitised);
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
            case 'plan_managed': return 'Plan-Managed';
            case 'self_managed': return 'Self-Managed';
            case 'self_funded': return 'Self-Funded';
            default: return 'Agency-Managed';
        }
    };

    // Get management type color
    const getManagementTypeColor = (type) => {
        switch(type) {
            case 'plan_managed': return '#2196f3'; // Blue
            case 'self_managed': return '#4caf50'; // Green
            case 'self_funded': return '#ff9800'; // Orange
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
                !(p.phone && p.phone.includes(term))) {
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
            <div className="participants-header">
                <div className="participants-title">
                    <h1>Participant Management</h1>
                    <p className="participants-subtitle">
                        Manage participant profiles, NDIS plans, and support requirements
                    </p>
                </div>
                
                <div className="participants-actions">
                    <div className="search-container">
                        <input
                            type="text"
                            placeholder="Search by name, NDIS, suburb..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    
                    <button onClick={handleAddClick} className="add-button">
                        Add New Participant
                    </button>
                </div>
            </div>

            {error && <p className="error-message">{error}</p>}

            {!isFormVisible && (
                <>
                    {/* --- Control Bar -------------------------------- */}
                    <div className="participant-control-bar">
                        <div className="participant-filters">
                            <select 
                                value={filterStatus} 
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">All Management Types</option>
                                <option value="agency_managed">Agency-Managed</option>
                                <option value="plan_managed">Plan-Managed</option>
                                <option value="self_managed">Self-Managed</option>
                                <option value="self_funded">Self-Funded</option>
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
                                                    {/* --- TOP ROW -------------------------------------------------- */}
                                                    <div className="participant-top-row">
                                                        <h3>{p.first_name} {p.last_name}</h3>
                                                        
                                                        {/* NDIS now shown in card footer */}
                                                    </div>
                                                    
                                                    {/* --- BOTTOM ROW --------------------------------------------- */}
                                                    <div className="participant-bottom-row">
                                                        <span 
                                                            className="management-chip"
                                                            style={{ backgroundColor: managementColor }}
                                                        >
                                                            {getManagementTypeDisplay(managementType)}
                                                        </span>
                                                    </div>
                                                </div>
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
                                            
                                            {/* Support Needs Flags */}
                                            <div className="support-needs-section">
                                                {[
                                                    {
                                                        key: 'has_wheelchair_access',
                                                        icon: '♿',
                                                        label: 'Wheelchair'
                                                    },
                                                    {
                                                        key: 'has_dietary_requirements',
                                                        icon: '🍽️',
                                                        label: 'Dietary'
                                                    },
                                                    {
                                                        key: 'has_medical_requirements',
                                                        icon: '💊',
                                                        label: 'Medical'
                                                    },
                                                    {
                                                        key: 'has_behavioral_support',
                                                        icon: '🔔',
                                                        label: 'Behavioral'
                                                    },
                                                    {
                                                        key: 'has_visual_impairment',
                                                        icon: '👁️',
                                                        label: 'Visual'
                                                    },
                                                    {
                                                        key: 'has_hearing_impairment',
                                                        icon: '👂',
                                                        label: 'Hearing'
                                                    },
                                                    {
                                                        key: 'has_cognitive_support',
                                                        icon: '🧠',
                                                        label: 'Cognitive'
                                                    },
                                                    {
                                                        key: 'has_communication_needs',
                                                        icon: '💬',
                                                        label: 'Communication'
                                                    }
                                                ]
                                                    .filter(
                                                        (flag) =>
                                                            p[flag.key] === true
                                                    )
                                                    .map((flag) => (
                                                        <span
                                                            key={flag.key}
                                                            className="support-need-tag"
                                                            title={flag.label}
                                                        >
                                                            {flag.icon}
                                                        </span>
                                                    ))}
                                                {[
                                                    'has_wheelchair_access',
                                                    'has_dietary_requirements',
                                                    'has_medical_requirements',
                                                    'has_behavioral_support',
                                                    'has_visual_impairment',
                                                    'has_hearing_impairment',
                                                    'has_cognitive_support',
                                                    'has_communication_needs'
                                                ].every((k) => !p[k]) && (
                                                    <span className="no-special-needs">
                                                        No special support needs
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {/* Contact Information */}
                                            <div className="contact-section">
                                                {p.phone && (
                                                    <div className="contact-item">
                                                        <strong>Phone:</strong> {p.phone}
                                                    </div>
                                                )}
                                                {p.email && (
                                                    <div className="contact-item">
                                                        <strong>Email:</strong> {p.email}
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

                                            {/* Footer – NDIS serial number */}
                                            <div className="participant-card-footer">
                                                <span className="participant-serial">
                                                    {p.ndis_number ? `NDIS: ${p.ndis_number}` : 'No NDIS Number'}
                                                </span>
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
                                    <option value="agency_managed">Agency-Managed</option>
                                    <option value="plan_managed">Plan-Managed</option>
                                    <option value="self_managed">Self-Managed</option>
                                    <option value="self_funded">Self-Funded</option>
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
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone || ''}
                                    onChange={handleFormChange}
                                />
                            </div>
                            <div className="form-field">
                                <label>Contact Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email || ''}
                                    onChange={handleFormChange}
                                />
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
                            
                            {/* --- Requirements / Support Plan -------------------------------- */}
                            <div className="form-field full-width">
                                <label>Mobility Requirements</label>
                                <textarea
                                    name="mobility_needs"
                                    value={formData.mobility_needs}
                                    onChange={handleFormChange}
                                ></textarea>
                            </div>

                            <div className="form-field full-width">
                                <label>Dietary Requirements</label>
                                <textarea
                                    name="allergies"
                                    value={formData.allergies}
                                    onChange={handleFormChange}
                                ></textarea>
                            </div>

                            <div className="form-field full-width">
                                <label>Medical Requirements</label>
                                <textarea
                                    name="medication_needs"
                                    value={formData.medication_needs}
                                    onChange={handleFormChange}
                                ></textarea>
                            </div>

                            <div className="form-field">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="has_behavior_support_plan"
                                        checked={formData.has_behavior_support_plan}
                                        onChange={handleFormChange}
                                    />
                                    Behaviour Support Plan in place
                                </label>
                            </div>

                            {/* ----------------------------------------------------
                             * Support-needs Boolean Flags
                             * -------------------------------------------------- */}
                            <div className="form-field full-width">
                                <label>Support Needs Flags</label>
                                <div className="support-flags-grid">
                                    {[
                                        { key: 'has_wheelchair_access',    label: 'Wheelchair Access' },
                                        { key: 'has_dietary_requirements', label: 'Dietary Requirements' },
                                        { key: 'has_medical_requirements', label: 'Medical Requirements' },
                                        { key: 'has_behavioral_support',   label: 'Behavioural Support' },
                                        { key: 'has_visual_impairment',    label: 'Visual Impairment' },
                                        { key: 'has_hearing_impairment',   label: 'Hearing Impairment' },
                                        { key: 'has_cognitive_support',    label: 'Cognitive Support' },
                                        { key: 'has_communication_needs',  label: 'Communication Needs' }
                                    ].map(({ key, label }) => (
                                        <label key={key} className="checkbox-label flag-checkbox">
                                            <input
                                                type="checkbox"
                                                name={key}
                                                checked={formData[key]}
                                                onChange={handleFormChange}
                                            />
                                            {label}
                                        </label>
                                    ))}
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
