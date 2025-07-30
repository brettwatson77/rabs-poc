import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { format, parseISO, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { useAppContext } from '../context/AppContext';
import '../styles/ParticipantPlanner.css';

// Map numeric day_of_week (0–6) to human-readable strings
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// Support needs tags with colors
const SUPPORT_TAGS = {
  'Wheelchair': { color: '#e74c3c', icon: '♿' },
  'Visual': { color: '#3498db', icon: '👁️' },
  'Hearing': { color: '#9b59b6', icon: '👂' },
  'Cognitive': { color: '#f1c40f', icon: '🧠' },
  'Behavioral': { color: '#e67e22', icon: '🔔' },
  'Medical': { color: '#2ecc71', icon: '💊' },
  'Dietary': { color: '#1abc9c', icon: '🍽️' },
  'Communication': { color: '#34495e', icon: '💬' }
};

const ParticipantPlanner = () => {
  const { simulatedDate } = useAppContext();
  
  // Main state
  const [participants, setParticipants] = useState([]);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [participantDetails, setParticipantDetails] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [availablePrograms, setAvailablePrograms] = useState([]);
  const [programRecommendations, setProgramRecommendations] = useState([]);
  const [supervisionHistory, setSupervisionHistory] = useState([]);
  
  // UI state
  const [activeTab, setActiveTab] = useState('profile');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTags, setFilterTags] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Form state
  const [supervisionValue, setSupervisionValue] = useState(1.0);
  const [supportNeeds, setSupportNeeds] = useState({
    mobility: '',
    dietary: '',
    medical: '',
    behavior: false,
    notes: ''
  });
  const [pendingEnrollments, setPendingEnrollments] = useState({});
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Loading states
  const [loading, setLoading] = useState({
    participants: true,
    details: false,
    enrollments: false,
    recommendations: false,
    financials: false
  });
  const [error, setError] = useState({
    participants: null,
    details: null,
    enrollments: null,
    recommendations: null,
    financials: null
  });

  // Financial impact data
  const [financialImpact, setFinancialImpact] = useState({
    baseStaffCost: 0,
    adjustedStaffCost: 0,
    differencePerHour: 0,
    weeklyImpact: 0,
    fortnightlyImpact: 0
  });

  // Constants for calculations
  const SCHADS_RATES = {
    1: 28.41,
    2: 32.54,
    3: 34.85,
    4: 36.88,
    5: 39.03,
    6: 43.26,
    7: 46.71,
    8: 50.15
  };
  const DEFAULT_SCHADS_LEVEL = 3;

  // Fetch all participants on component mount
  useEffect(() => {
    fetchParticipants();
  }, []);

  // Fetch participant details when selection changes
  useEffect(() => {
    if (selectedParticipant) {
      fetchParticipantDetails();
      fetchEnrollments();
      fetchSupervisionHistory();
      fetchProgramRecommendations();
    }
  }, [selectedParticipant]);

  // Calculate financial impact when supervision value changes
  useEffect(() => {
    if (selectedParticipant && enrollments.length > 0) {
      calculateFinancialImpact();
    }
  }, [supervisionValue, enrollments]);

  // Fetch all participants
  const fetchParticipants = async () => {
    setLoading(prev => ({ ...prev, participants: true }));
    setError(prev => ({ ...prev, participants: null }));
    
    try {
      const response = await axios.get('/api/v1/participants');
      // API returns an object with a `data` key that contains the array
      const data = response?.data || {};
      setParticipants(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error('Error fetching participants:', err);
      setError(prev => ({ 
        ...prev, 
        participants: 'Failed to load participants. Please try again.' 
      }));
    } finally {
      setLoading(prev => ({ ...prev, participants: false }));
    }
  };

  // Fetch detailed participant information
  const fetchParticipantDetails = async () => {
    if (!selectedParticipant) return;
    
    setLoading(prev => ({ ...prev, details: true }));
    setError(prev => ({ ...prev, details: null }));
    
    try {
      const response = await axios.get(`/api/v1/participants/${selectedParticipant.id}`);
      setParticipantDetails(response.data);
      
      // Set supervision value from participant data
      if (response.data.supervision_multiplier) {
        setSupervisionValue(parseFloat(response.data.supervision_multiplier));
      } else {
        setSupervisionValue(1.0);
      }
      
      // Set support needs from participant data
      setSupportNeeds({
        mobility: response.data.mobility_requirements || '',
        dietary: response.data.dietary_requirements || '',
        medical: response.data.medical_requirements || '',
        behavior: response.data.behavior_support_plan || false,
        notes: response.data.notes || ''
      });
    } catch (err) {
      console.error('Error fetching participant details:', err);
      setError(prev => ({ 
        ...prev, 
        details: 'Failed to load participant details. Please try again.' 
      }));
    } finally {
      setLoading(prev => ({ ...prev, details: false }));
    }
  };

  // Fetch participant enrollments
  const fetchEnrollments = async () => {
    if (!selectedParticipant) return;
    
    setLoading(prev => ({ ...prev, enrollments: true }));
    setError(prev => ({ ...prev, enrollments: null }));
    
    try {
      const response = await axios.get(
        `/api/v1/participants/${selectedParticipant.id}/enrollments`
      );

      // Ensure we always work with an object before accessing its properties
      const data = response?.data || {};

      setEnrollments(Array.isArray(data.enrollments) ? data.enrollments : []);
      setAvailablePrograms(
        Array.isArray(data.availablePrograms) ? data.availablePrograms : []
      );
      setPendingEnrollments({});
    } catch (err) {
      console.error('Error fetching enrollments:', err);
      setError(prev => ({ 
        ...prev, 
        enrollments: 'Failed to load enrollment data. Please try again.' 
      }));
    } finally {
      setLoading(prev => ({ ...prev, enrollments: false }));
    }
  };

  // Fetch supervision multiplier history
  const fetchSupervisionHistory = async () => {
    if (!selectedParticipant) return;
    
    try {
      // This would be a real API call in production
      // For now, generate sample data
      const mockHistory = [
        { date: '2025-07-01', value: 1.0, reason: 'Initial assessment' },
        { date: '2025-07-15', value: 1.25, reason: 'Increased support needs' },
        { date: '2025-08-01', value: 1.5, reason: 'Behavioral support plan implemented' }
      ];
      setSupervisionHistory(mockHistory);
    } catch (err) {
      console.error('Error fetching supervision history:', err);
    }
  };

  // Fetch program recommendations
  const fetchProgramRecommendations = async () => {
    if (!selectedParticipant) return;
    
    setLoading(prev => ({ ...prev, recommendations: true }));
    
    try {
      // This would be a real API call in production
      // For now, generate sample recommendations
      setTimeout(() => {
        const mockRecommendations = [
          { id: 101, name: 'Swimming Group', match: 95, reason: 'Based on mobility needs' },
          { id: 102, name: 'Art Therapy', match: 87, reason: 'Based on interests and goals' },
          { id: 103, name: 'Social Skills Group', match: 82, reason: 'Based on support plan goals' }
        ];
        setProgramRecommendations(mockRecommendations);
        setLoading(prev => ({ ...prev, recommendations: false }));
      }, 800);
    } catch (err) {
      console.error('Error fetching program recommendations:', err);
      setLoading(prev => ({ ...prev, recommendations: false }));
    }
  };

  // Calculate financial impact of supervision multiplier
  const calculateFinancialImpact = () => {
    setLoading(prev => ({ ...prev, financials: true }));
    
    try {
      // Get base SCHADS rate (default to level 3 if not specified)
      const baseRate = SCHADS_RATES[DEFAULT_SCHADS_LEVEL];
      
      // Calculate hourly cost difference
      const baseStaffCost = baseRate;
      const adjustedStaffCost = baseRate * supervisionValue;
      const differencePerHour = adjustedStaffCost - baseStaffCost;
      
      // Calculate weekly impact (sum of all enrolled program hours)
      let weeklyHours = 0;
      enrollments.forEach(enrollment => {
        const program = availablePrograms.find(p => p.id === enrollment.program_id);
        if (program) {
          // Assuming each program is 2 hours for this example
          weeklyHours += 2;
        }
      });
      
      const weeklyImpact = differencePerHour * weeklyHours;
      const fortnightlyImpact = weeklyImpact * 2;
      
      setFinancialImpact({
        baseStaffCost,
        adjustedStaffCost,
        differencePerHour,
        weeklyImpact,
        fortnightlyImpact
      });
    } catch (err) {
      console.error('Error calculating financial impact:', err);
    } finally {
      setLoading(prev => ({ ...prev, financials: false }));
    }
  };

  // Update supervision multiplier
  const updateSupervisionMultiplier = async () => {
    if (!selectedParticipant) return;
    
    try {
      await axios.patch(`/api/v1/participants/${selectedParticipant.id}`, {
        supervision_multiplier: supervisionValue
      });
      
      // Update history with new entry
      const newHistoryEntry = {
        date: format(new Date(), 'yyyy-MM-dd'),
        value: supervisionValue,
        reason: 'Manual adjustment'
      };
      
      setSupervisionHistory([newHistoryEntry, ...supervisionHistory]);
      setSuccessMessage('Supervision multiplier updated successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      
      // Recalculate financial impact
      calculateFinancialImpact();
    } catch (err) {
      console.error('Error updating supervision multiplier:', err);
      setError(prev => ({ 
        ...prev, 
        details: 'Failed to update supervision multiplier. Please try again.' 
      }));
    }
  };

  // Update support needs
  const updateSupportNeeds = async () => {
    if (!selectedParticipant) return;
    
    try {
      await axios.patch(`/api/v1/participants/${selectedParticipant.id}`, {
        mobility_requirements: supportNeeds.mobility,
        dietary_requirements: supportNeeds.dietary,
        medical_requirements: supportNeeds.medical,
        behavior_support_plan: supportNeeds.behavior,
        notes: supportNeeds.notes
      });
      
      setSuccessMessage('Support needs updated successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('Error updating support needs:', err);
      setError(prev => ({ 
        ...prev, 
        details: 'Failed to update support needs. Please try again.' 
      }));
    }
  };

  // Toggle program enrollment
  const toggleProgramEnrollment = (programId) => {
    // Safely handle cases where `enrollments` is undefined or not yet an array
    const isEnrolled = (enrollments || []).some(e => e.program_id === programId);
    
    setPendingEnrollments(prev => ({
      ...prev,
      [programId]: {
        action: isEnrolled ? 'remove' : 'add',
        effectiveDate: effectiveDate
      }
    }));
  };

  // Cancel pending enrollment change
  const cancelPendingEnrollment = (programId) => {
    setPendingEnrollments(prev => {
      const newChanges = {...prev};
      delete newChanges[programId];
      return newChanges;
    });
  };

  // Save pending enrollment changes
  const saveEnrollmentChanges = async () => {
    if (!selectedParticipant || Object.keys(pendingEnrollments).length === 0) return;
    
    try {
      // Convert pendingEnrollments object to array
      const changesArray = Object.entries(pendingEnrollments).map(([programId, change]) => ({
        program_id: Number(programId),
        ...change
      }));
      
      await axios.post(`/api/v1/participants/${selectedParticipant.id}/enrollments`, {
        changes: changesArray
      });
      
      setSuccessMessage('Enrollment changes saved successfully');
      setPendingEnrollments({});
      
      // Refresh enrollments
      fetchEnrollments();
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('Error saving enrollment changes:', err);
      setError(prev => ({ 
        ...prev, 
        enrollments: 'Failed to save enrollment changes. Please try again.' 
      }));
    }
  };

  // Filter participants based on search query and tags
  // Ensure we always operate on an array even if `participants` is undefined or not yet loaded
  const filteredParticipants = (participants || []).filter(participant => {
    const fullName = `${participant.first_name} ${participant.last_name}`.toLowerCase();
    const matchesSearch = searchQuery === '' || fullName.includes(searchQuery.toLowerCase());
    
    // If no tags selected, show all that match search
    if (filterTags.length === 0) return matchesSearch;
    
    // Check if participant has any of the selected tags
    // Ensure safety if `filterTags` is ever undefined or not an array
    const hasTag = (filterTags || []).some(tag => {
      switch(tag) {
        case 'Wheelchair':
          return participant.mobility_requirements?.toLowerCase().includes('wheelchair');
        case 'Behavioral':
          return participant.behavior_support_plan;
        case 'Dietary':
          return participant.dietary_requirements && participant.dietary_requirements.length > 0;
        case 'Medical':
          return participant.medical_requirements && participant.medical_requirements.length > 0;
        default:
          return false;
      }
    });
    
    return matchesSearch && hasTag;
  });

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(value);
  };

  /* -----------------------------------------------------------
   *  Helper – is a participant currently enrolled in program?
   * --------------------------------------------------------- */
  const isParticipantEnrolled = (programId) =>
    (enrollments || []).some((e) => e.program_id === programId);

  /* Tiny alias so the new button label matches guidelines */
  const saveChanges = () => saveEnrollmentChanges();

  // Render participant selection section
  const renderParticipantSelection = () => {
    return (
      <div className="participant-selection">
        <div className="filter-tags">
          {Object.keys(SUPPORT_TAGS).map(tag => (
            <div 
              key={tag}
              className={`filter-tag ${filterTags.includes(tag) ? 'active' : ''}`}
              style={{ backgroundColor: filterTags.includes(tag) ? SUPPORT_TAGS[tag].color : 'transparent' }}
              onClick={() => {
                if (filterTags.includes(tag)) {
                  setFilterTags(filterTags.filter(t => t !== tag));
                } else {
                  setFilterTags([...filterTags, tag]);
                }
              }}
            >
              <span className="tag-icon">{SUPPORT_TAGS[tag].icon}</span>
              <span className="tag-name">{tag}</span>
            </div>
          ))}
        </div>
        
        {/* ==== Compact Tiles Grid for up to 200 participants ==== */}
        <div className="participants-grid-compact">
          {loading.participants ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading participants...</p>
            </div>
          ) : (
            filteredParticipants.map(participant => (
              <div
                key={participant.id}
                className={`participant-tile ${
                  selectedParticipant?.id === participant.id ? 'selected' : ''
                }`}
                onClick={() => setSelectedParticipant(participant)}
                title={`${participant.first_name} ${participant.last_name} - NDIS: ${
                  participant.ndis_number || 'N/A'
                }`}
              >
                <div className="tile-photo">
                  {participant.first_name.charAt(0)}
                  {participant.last_name.charAt(0)}
                </div>

                <div className="tile-name">
                  {participant.first_name}
                  <br />
                  <span className="last-initial">
                    {participant.last_name.charAt(0)}.
                  </span>
                </div>

                {/* Compact indicators */}
                <div className="tile-indicators">
                  {participant.mobility_requirements
                    ?.toLowerCase()
                    .includes('wheelchair') && (
                      <span
                        className="indicator wheelchair"
                        title="Wheelchair"
                      >
                        ♿
                      </span>
                    )}
                  {participant.behavior_support_plan && (
                    <span
                      className="indicator behavioral"
                      title="Behavioral Support"
                    >
                      🔔
                    </span>
                  )}
                  {participant.dietary_requirements && (
                    <span
                      className="indicator dietary"
                      title="Dietary Requirements"
                    >
                      🍽️
                    </span>
                  )}
                  {participant.medical_requirements && (
                    <span className="indicator medical" title="Medical">
                      💊
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
          
          {!loading.participants && filteredParticipants.length === 0 && (
            <div className="no-results-compact">
              <p>No participants found matching your search criteria.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render participant profile tab
  const renderProfileTab = () => {
    if (!selectedParticipant || loading.details) {
      return (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading participant details...</p>
        </div>
      );
    }
    
    if (error.details) {
      return (
        <div className="error-container">
          <p>{error.details}</p>
          <button onClick={fetchParticipantDetails}>Retry</button>
        </div>
      );
    }
    
    return (
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-photo">
            {selectedParticipant.first_name.charAt(0)}{selectedParticipant.last_name.charAt(0)}
          </div>
          <div className="profile-title">
            <h2>{selectedParticipant.first_name} {selectedParticipant.last_name}</h2>
            <p className="ndis-info">
              NDIS: {selectedParticipant.ndis_number || 'N/A'} 
              <span className="plan-status">
                {selectedParticipant.is_plan_managed ? 'Plan Managed' : 'Agency Managed'}
              </span>
            </p>
          </div>
        </div>
        
        <div className="profile-cards">
          <div className="profile-card contact-card">
            <h3>Contact Information</h3>
            <div className="contact-info">
              <p><strong>Phone:</strong> {selectedParticipant.contact_phone || 'Not provided'}</p>
              <p><strong>Email:</strong> {selectedParticipant.contact_email || 'Not provided'}</p>
              <p><strong>Address:</strong> {selectedParticipant.address ? `${selectedParticipant.address}, ${selectedParticipant.suburb}, ${selectedParticipant.state} ${selectedParticipant.postcode}` : 'Not provided'}</p>
            </div>
            <button className="edit-button" onClick={() => setShowContactModal(true)}>
              Edit Contact Info
            </button>
          </div>
          
          <div className="profile-card emergency-card">
            <h3>Emergency Contact</h3>
            <div className="emergency-info">
              <p><strong>Name:</strong> {selectedParticipant.emergency_contact_name || 'Not provided'}</p>
              <p><strong>Phone:</strong> {selectedParticipant.emergency_contact_phone || 'Not provided'}</p>
            </div>
            <button className="edit-button" onClick={() => setShowContactModal(true)}>
              Edit Emergency Contact
            </button>
          </div>
        </div>
        
        <div className="profile-card support-needs-card">
          <h3>Support Needs</h3>
          <div className="support-needs-form">
            <div className="form-group">
              <label>Mobility Requirements:</label>
              <input 
                type="text" 
                value={supportNeeds.mobility} 
                onChange={(e) => setSupportNeeds({...supportNeeds, mobility: e.target.value})}
                placeholder="E.g., Wheelchair, Walker, etc."
              />
            </div>
            
            <div className="form-group">
              <label>Dietary Requirements:</label>
              <input 
                type="text" 
                value={supportNeeds.dietary} 
                onChange={(e) => setSupportNeeds({...supportNeeds, dietary: e.target.value})}
                placeholder="E.g., Gluten-free, Allergies, etc."
              />
            </div>
            
            <div className="form-group">
              <label>Medical Requirements:</label>
              <input 
                type="text" 
                value={supportNeeds.medical} 
                onChange={(e) => setSupportNeeds({...supportNeeds, medical: e.target.value})}
                placeholder="E.g., Medication, Equipment, etc."
              />
            </div>
            
            <div className="form-group checkbox-group">
              <input 
                type="checkbox" 
                id="behavior-support" 
                checked={supportNeeds.behavior} 
                onChange={(e) => setSupportNeeds({...supportNeeds, behavior: e.target.checked})}
              />
              <label htmlFor="behavior-support">Behavior Support Plan</label>
            </div>
            
            <div className="form-group">
              <label>Additional Notes:</label>
              <textarea 
                value={supportNeeds.notes} 
                onChange={(e) => setSupportNeeds({...supportNeeds, notes: e.target.value})}
                placeholder="Any additional information about support needs..."
                rows={3}
              />
            </div>
            
            <button className="save-button" onClick={updateSupportNeeds}>
              Save Support Needs
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render supervision multiplier tab
  const renderSupervisionTab = () => {
    if (!selectedParticipant) {
      return (
        <div className="no-selection">
          <p>Please select a participant to view supervision settings.</p>
        </div>
      );
    }
    
    return (
      <div className="supervision-container">
        <div className="supervision-card">
          <h3>Supervision Multiplier</h3>
          <p className="supervision-description">
            Adjust the supervision multiplier to reflect the participant's support needs. 
            This affects staffing ratios but not bus seating allocation.
          </p>
          
          <div className="supervision-slider-container">
            <div className="supervision-slider">
              <input
                type="range"
                min="1"
                max="2.25"
                step="0.25"
                value={supervisionValue}
                onChange={(e) => setSupervisionValue(parseFloat(e.target.value))}
                className="slider"
              />
              <div className="slider-labels">
                <span>1.0x</span>
                <span>1.5x</span>
                <span>2.0x</span>
                <span>2.25x</span>
              </div>
            </div>
            
            <div className="supervision-value">
              <span className="value-label">Current Value:</span>
              <span className="value-number">{supervisionValue.toFixed(2)}x</span>
            </div>
            
            <button className="save-button" onClick={updateSupervisionMultiplier}>
              Save Multiplier
            </button>
          </div>
        </div>
        
        <div className="financial-impact-card">
          <h3>Financial Impact</h3>
          <div className="financial-metrics">
            <div className="metric">
              <span className="metric-label">Base Staff Cost:</span>
              <span className="metric-value">{formatCurrency(financialImpact.baseStaffCost)}/hr</span>
            </div>
            
            <div className="metric">
              <span className="metric-label">Adjusted Staff Cost:</span>
              <span className="metric-value">{formatCurrency(financialImpact.adjustedStaffCost)}/hr</span>
            </div>
            
            <div className="metric highlight">
              <span className="metric-label">Difference Per Hour:</span>
              <span className="metric-value">{formatCurrency(financialImpact.differencePerHour)}/hr</span>
            </div>
            
            <div className="metric">
              <span className="metric-label">Weekly Impact:</span>
              <span className="metric-value">{formatCurrency(financialImpact.weeklyImpact)}</span>
            </div>
            
            <div className="metric">
              <span className="metric-label">Fortnightly Impact:</span>
              <span className="metric-value">{formatCurrency(financialImpact.fortnightlyImpact)}</span>
            </div>
          </div>
          
          <div className="impact-chart">
            <h4>Cost Comparison</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={[
                  { name: 'Base', value: financialImpact.baseStaffCost },
                  { name: 'Adjusted', value: financialImpact.adjustedStaffCost }
                ]}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="value" fill="#4287f5">
                  <Cell fill="#82ca9d" />
                  <Cell fill="#8884d8" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="supervision-history-card">
          <h3>Supervision History</h3>
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Value</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {supervisionHistory.map((entry, index) => (
                <tr key={index}>
                  <td>{entry.date}</td>
                  <td>{entry.value.toFixed(2)}x</td>
                  <td>{entry.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render programs tab
  const renderProgramsTab = () => {
    if (!selectedParticipant) {
      return (
        <div className="no-selection">
          <p>Please select a participant to view program enrollments.</p>
        </div>
      );
    }
    
    if (loading.enrollments) {
      return (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading program enrollments...</p>
        </div>
      );
    }
    
    if (error.enrollments) {
      return (
        <div className="error-container">
          <p>{error.enrollments}</p>
          <button onClick={fetchEnrollments}>Retry</button>
        </div>
      );
    }
    
    return (
      <div className="programs-container">
        <div className="enrollment-timeline">
          <h3>Weekly Schedule</h3>
          <div className="timeline-days">
            {DAY_NAMES.map((day, index) => (
              <div key={index} className="timeline-day">
                <div className="day-header">{day}</div>
                <div className="day-programs">
                  {enrollments
                    .filter(enrollment => {
                      const program = availablePrograms.find(p => p.id === enrollment.program_id);
                      return program && program.day_of_week === index;
                    })
                    .map(enrollment => {
                      const program = availablePrograms.find(p => p.id === enrollment.program_id);
                      return (
                        <div key={enrollment.id} className="program-block">
                          <span className="program-name">{program.name}</span>
                          <span className="program-time">{program.start_time} - {program.end_time}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="enrollment-management">
          <div className="enrollment-header">
            <h3>Program Enrollments</h3>
            <div className="effective-date">
              <label>Effective Date:</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
          </div>
          
          <div className="programs-list">
            {availablePrograms.map(program => {
              // Safely handle cases where `enrollments` may be undefined or not an array
              const isEnrolled = (enrollments || []).some(
                (e) => e.program_id === program.id
              );
              const pendingChange = pendingEnrollments[program.id];
              const isChecked = (isEnrolled && !pendingChange) || 
                               (isEnrolled && pendingChange?.action === 'add') || 
                               (!isEnrolled && pendingChange?.action === 'add');
              
              return (
                <div key={program.id} className="program-item">
                  <div className="program-checkbox">
                    <input
                      type="checkbox"
                      id={`program-${program.id}`}
                      checked={isChecked}
                      onChange={() => toggleProgramEnrollment(program.id)}
                      disabled={!!pendingChange}
                    />
                    <label htmlFor={`program-${program.id}`}>
                      {program.name} ({DAY_NAMES[program.day_of_week]})
                    </label>
                  </div>
                  
                  {pendingChange && (
                    <div className="pending-change">
                      <span className={pendingChange.action === 'add' ? 'add' : 'remove'}>
                        Pending {pendingChange.action} on {pendingChange.effectiveDate}
                      </span>
                      <button onClick={() => cancelPendingEnrollment(program.id)}>Cancel</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {Object.keys(pendingEnrollments).length > 0 && (
            <button className="save-button" onClick={saveEnrollmentChanges}>
              Save Enrollment Changes
            </button>
          )}
        </div>
        
        <div className="program-recommendations">
          <h3>Recommended Programs</h3>
          {loading.recommendations ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading recommendations...</p>
            </div>
          ) : (
            <div className="recommendations-list">
              {programRecommendations.map(recommendation => (
                <div key={recommendation.id} className="recommendation-card">
                  <div className="recommendation-header">
                    <h4>{recommendation.name}</h4>
                    <span className="match-score">{recommendation.match}% Match</span>
                  </div>
                  <p className="recommendation-reason">{recommendation.reason}</p>
                  <button className="add-button">Add to Enrollments</button>
                </div>
              ))}
              
              {programRecommendations.length === 0 && (
                <p className="no-recommendations">No program recommendations available.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render reports tab
  const renderReportsTab = () => {
    if (!selectedParticipant) {
      return (
        <div className="no-selection">
          <p>Please select a participant to view reports.</p>
        </div>
      );
    }
    
    // Sample data for charts
    const attendanceData = [
      { name: 'Week 1', attended: 5, total: 5 },
      { name: 'Week 2', attended: 4, total: 5 },
      { name: 'Week 3', attended: 5, total: 5 },
      { name: 'Week 4', attended: 3, total: 5 },
      { name: 'Week 5', attended: 5, total: 5 },
      { name: 'Week 6', attended: 4, total: 5 }
    ];
    
    const goalProgressData = [
      { name: 'Goal 1', progress: 75 },
      { name: 'Goal 2', progress: 90 },
      { name: 'Goal 3', progress: 60 },
      { name: 'Goal 4', progress: 40 }
    ];
    
    return (
      <div className="reports-container">
        <div className="report-card">
          <h3>Attendance History</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={attendanceData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="attended" name="Sessions Attended" fill="#4287f5" />
              <Bar dataKey="total" name="Total Sessions" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="report-card">
          <h3>Goal Progress</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={goalProgressData}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis dataKey="name" type="category" />
              <Tooltip formatter={(value) => `${value}%`} />
              <Bar dataKey="progress" name="Progress" fill="#8884d8">
                {goalProgressData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="report-card">
          <h3>Recent Notes</h3>
          <div className="notes-list">
            <div className="note-item">
              <div className="note-header">
                <span className="note-date">2025-08-01</span>
                <span className="note-author">Staff: John Smith</span>
              </div>
              <p className="note-content">
                Participant showed great progress in social skills group today. Engaged well with peers and completed all activities.
              </p>
            </div>
            
            <div className="note-item">
              <div className="note-header">
                <span className="note-date">2025-07-25</span>
                <span className="note-author">Staff: Sarah Johnson</span>
              </div>
              <p className="note-content">
                Needed additional support with mobility today. Recommend reviewing supervision multiplier.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render contact modal
  const renderContactModal = () => {
    if (!showContactModal) return null;
    
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="modal-header">
            <h3>Edit Contact Information</h3>
            <button className="close-button" onClick={() => setShowContactModal(false)}>×</button>
          </div>
          
          <div className="modal-body">
            <div className="form-group">
              <label>Phone:</label>
              <input type="text" defaultValue={selectedParticipant?.contact_phone || ''} />
            </div>
            
            <div className="form-group">
              <label>Email:</label>
              <input type="email" defaultValue={selectedParticipant?.contact_email || ''} />
            </div>
            
            <div className="form-group">
              <label>Address:</label>
              <input type="text" defaultValue={selectedParticipant?.address || ''} />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Suburb:</label>
                <input type="text" defaultValue={selectedParticipant?.suburb || ''} />
              </div>
              
              <div className="form-group">
                <label>State:</label>
                <input type="text" defaultValue={selectedParticipant?.state || ''} />
              </div>
              
              <div className="form-group">
                <label>Postcode:</label>
                <input type="text" defaultValue={selectedParticipant?.postcode || ''} />
              </div>
            </div>
            
            <h4>Emergency Contact</h4>
            
            <div className="form-group">
              <label>Name:</label>
              <input type="text" defaultValue={selectedParticipant?.emergency_contact_name || ''} />
            </div>
            
            <div className="form-group">
              <label>Phone:</label>
              <input type="text" defaultValue={selectedParticipant?.emergency_contact_phone || ''} />
            </div>
          </div>
          
          <div className="modal-footer">
            <button className="cancel-button" onClick={() => setShowContactModal(false)}>Cancel</button>
            <button className="save-button" onClick={() => setShowContactModal(false)}>Save Changes</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="participant-planner">
      {/* ===== Universal Header ===== */}
      <div className="planner-header universal-header">
        <div className="header-left">
          <h1>Participant Planner</h1>
          <p className="header-subtitle">
            Manage participant program schedules and recurring attendance
          </p>
        </div>

        <div className="header-right">
          <div className="participant-search-container">
            <input
              type="text"
              placeholder="Search participants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="participant-search-input"
            />
            <span className="search-icon">🔍</span>
          </div>

          <button className="add-button" onClick={() => setShowAddModal(true)}>
            Add New Participant
          </button>
        </div>
      </div>

      {/* ===== Main Content ===== */}
      {!selectedParticipant ? (
        /* ---- Participant Grid ---- */
        renderParticipantSelection()
      ) : (
        /* ---- Full Participant Profile with Tabs ---- */
        <div className="participant-profile">
          {/* Header */}
          <div className="profile-header">
            <div className="profile-photo">
              {selectedParticipant.first_name.charAt(0)}
              {selectedParticipant.last_name.charAt(0)}
            </div>

            <div className="profile-name-section">
              <h1 className="profile-name">
                {selectedParticipant.first_name} {selectedParticipant.last_name}
              </h1>
              <p className="profile-ndis">
                NDIS: {selectedParticipant.ndis_number || 'N/A'}
              </p>
              <span
                className={`management-type management-${
                  selectedParticipant.is_plan_managed ? 'plan' : 'agency'
                }`}
              >
                {selectedParticipant.is_plan_managed
                  ? 'Plan Managed'
                  : 'Agency Managed'}
              </span>
            </div>

            <button
              className="back-button"
              onClick={() => setSelectedParticipant(null)}
            >
              ← Back to List
            </button>
          </div>

          {/* Tabs */}
          <div className="profile-tabs">
            <button
              className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              Profile
            </button>
            <button
              className={`tab-button ${
                activeTab === 'supervision' ? 'active' : ''
              }`}
              onClick={() => setActiveTab('supervision')}
            >
              Supervision
            </button>
            <button
              className={`tab-button ${
                activeTab === 'programs' ? 'active' : ''
              }`}
              onClick={() => setActiveTab('programs')}
            >
              Programs
            </button>
            <button
              className={`tab-button ${
                activeTab === 'reports' ? 'active' : ''
              }`}
              onClick={() => setActiveTab('reports')}
            >
              Reports
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === 'profile' && renderProfileTab()}
            {activeTab === 'supervision' && renderSupervisionTab()}
            {activeTab === 'programs' && renderProgramsTab()}
            {activeTab === 'reports' && renderReportsTab()}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="success-message">
          <p>{successMessage}</p>
        </div>
      )}

      {renderContactModal()}
    </div>
  );
};

export default ParticipantPlanner;
