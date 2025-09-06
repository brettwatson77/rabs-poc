/* eslint max-lines: 0 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { format, startOfWeek, addDays } from 'date-fns';
import {
  FiUsers,
  FiSearch,
  FiPlus,
  FiEdit2,
  FiTarget,
  FiBarChart2,
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiRefreshCw,
  FiDownload,
  FiCoffee,
  FiHeart,
  FiBell,
  FiEye,
  FiMessageCircle
  ,FiClipboard
  ,FiCalendar
  ,FiDollarSign
  ,FiClock
  ,FiSave
  ,FiTag
  ,FiX
} from 'react-icons/fi';

// Additional icons from other packs
import { FaWheelchair, FaBrain } from 'react-icons/fa';
import { BsEar } from 'react-icons/bs';

// External modal components
import CreateParticipantModal from './participants/modals/CreateParticipantModal';
import EditParticipantModal from './participants/modals/EditParticipantModal';
import DeleteParticipantModal from './participants/modals/DeleteParticipantModal';

// Component imports
import DirectoryHeader from './participants/components/Directory/DirectoryHeader';
import ParticipantCard from './participants/components/Directory/ParticipantCard';

// Page-specific styles
import '../styles/Participants.css';

// API base URL from environment
const API_URL = import.meta.env.VITE_API_URL || '';

// Support flag icon mapping
const SUPPORT_FLAG_ICONS = {
  has_wheelchair_access: <FaWheelchair />,
  has_dietary_requirements: <FiCoffee />,
  has_medical_requirements: <FiHeart />,
  has_behavioral_support: <FiBell />,
  has_visual_impairment: <FiEye />,
  has_hearing_impairment: <BsEar />,
  has_cognitive_support: <FaBrain />,
  has_communication_needs: <FiMessageCircle />
};

// Support flag labels
const SUPPORT_FLAG_LABELS = {
  has_wheelchair_access: 'Wheelchair Access',
  has_dietary_requirements: 'Dietary Requirements',
  has_medical_requirements: 'Medical Requirements',
  has_behavioral_support: 'Behavioral Support',
  has_visual_impairment: 'Visual Impairment',
  has_hearing_impairment: 'Hearing Impairment',
  has_cognitive_support: 'Cognitive Support',
  has_communication_needs: 'Communication Needs'
};

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
  const participantsPerPage = 24;
  const [toast, setToast] = useState({ visible: false, message: '' });
  // Tracks which report tile is currently selected in the Reports tab
  const [selectedReport, setSelectedReport] = useState(null);

  // New state for enhanced features
  const [supervisionValue, setSupervisionValue] = useState(1.0);
  const [supportFlags, setSupportFlags] = useState({
    has_wheelchair_access: false,
    has_dietary_requirements: false,
    has_medical_requirements: false,
    has_behavioral_support: false,
    has_visual_impairment: false,
    has_hearing_impairment: false,
    has_cognitive_support: false,
    has_communication_needs: false
  });
  const [enrollments, setEnrollments] = useState([]);
  const [availablePrograms, setAvailablePrograms] = useState([]);
  const [pendingChanges, setPendingChanges] = useState({});
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [changeHistory, setChangeHistory] = useState([]);
  const [isLoading, setIsLoading] = useState({
    enrollments: false,
    changes: false
  });

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
    plan_management_type: 'agency_managed',
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

  // Load participant details when selected
  useEffect(() => {
    if (selectedParticipant) {
      // Fetch participant details to get the latest data
      const fetchParticipantDetails = async () => {
        try {
          const response = await axios.get(`${API_URL}/api/v1/participants/${selectedParticipant.id}`);
          const participant = response.data.data;
          
          // Update supervision value
          setSupervisionValue(parseFloat(participant.supervision_multiplier || 1.0));
          
          // Update support flags
          setSupportFlags({
            has_wheelchair_access: participant.has_wheelchair_access || false,
            has_dietary_requirements: participant.has_dietary_requirements || false,
            has_medical_requirements: participant.has_medical_requirements || false,
            has_behavioral_support: participant.has_behavioral_support || false,
            has_visual_impairment: participant.has_visual_impairment || false,
            has_hearing_impairment: participant.has_hearing_impairment || false,
            has_cognitive_support: participant.has_cognitive_support || false,
            has_communication_needs: participant.has_communication_needs || false
          });
          
          // Update selected participant with full details
          setSelectedParticipant(participant);
        } catch (error) {
          console.error('Error fetching participant details:', error);
        }
      };
      
      fetchParticipantDetails();
      
      // Fetch enrollments
      fetchEnrollments(selectedParticipant.id);
      
      // Fetch change history
      fetchChangeHistory(selectedParticipant.id);
    }
  }, [selectedParticipant?.id]);

  // Fetch enrollments for a participant
  const fetchEnrollments = async (participantId) => {
    if (!participantId) return;
    
    setIsLoading(prev => ({ ...prev, enrollments: true }));
    try {
      const response = await axios.get(`${API_URL}/api/v1/participants/${participantId}/enrollments`);
      setEnrollments(response.data.enrollments || []);
      setAvailablePrograms(response.data.availablePrograms || []);
      setPendingChanges({});
    } catch (error) {
      console.error('Error fetching enrollments:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, enrollments: false }));
    }
  };

  // Fetch change history for a participant
  const fetchChangeHistory = async (participantId) => {
    if (!participantId) return;
    
    setIsLoading(prev => ({ ...prev, changes: true }));
    try {
      const response = await axios.get(`${API_URL}/api/v1/changes/participant/${participantId}/changes`);
      setChangeHistory(response.data.changes || []);
    } catch (error) {
      console.error('Error fetching change history:', error);
      // Set empty array if error
      setChangeHistory([]);
    } finally {
      setIsLoading(prev => ({ ...prev, changes: false }));
    }
  };

  // Update supervision multiplier
  const updateSupervisionMultiplier = async () => {
    if (!selectedParticipant) return;
    
    try {
      await axios.patch(`${API_URL}/api/v1/participants/${selectedParticipant.id}`, {
        supervision_multiplier: supervisionValue
      });
      
      // Refetch participant data to update UI
      queryClient.invalidateQueries(['participants']);
      
      // Show success message (could be implemented with a toast notification)
      console.log('Supervision multiplier updated successfully');
    } catch (error) {
      console.error('Error updating supervision multiplier:', error);
    }
  };

  // Update support flags
  const updateSupportFlags = async () => {
    if (!selectedParticipant) return;
    
    try {
      await axios.patch(`${API_URL}/api/v1/participants/${selectedParticipant.id}`, supportFlags);
      
      // Refetch participant data to update UI
      queryClient.invalidateQueries(['participants']);
      
      // Show success message (could be implemented with a toast notification)
      console.log('Support flags updated successfully');
    } catch (error) {
      console.error('Error updating support flags:', error);
    }
  };

  // Toggle program enrollment in pending changes
  const toggleProgramEnrollment = (programId) => {
    const isEnrolled = enrollments.some(e => e.program_id === programId);
    
    setPendingChanges(prev => {
      const newChanges = { ...prev };
      
      // If already in pending changes, remove it
      if (newChanges[programId]) {
        delete newChanges[programId];
      } else {
        // Otherwise add it with the appropriate action
        newChanges[programId] = {
          action: isEnrolled ? 'remove' : 'add',
          effectiveDate: effectiveDate
        };
      }
      
      return newChanges;
    });
  };

  // Save pending enrollment changes
  const saveEnrollmentChanges = async () => {
    if (!selectedParticipant || Object.keys(pendingChanges).length === 0) return;
    
    try {
      // Convert pendingChanges object to array format expected by API
      const changes = Object.entries(pendingChanges).map(([programId, change]) => ({
        program_id: parseInt(programId),
        action: change.action,
        effectiveDate: change.effectiveDate
      }));
      
      await axios.post(`${API_URL}/api/v1/participants/${selectedParticipant.id}/enrollments`, {
        changes
      });
      
      // Clear pending changes and refetch enrollments
      setPendingChanges({});
      fetchEnrollments(selectedParticipant.id);
      
      // Show success message (could be implemented with a toast notification)
      console.log('Enrollment changes saved successfully');
    } catch (error) {
      console.error('Error saving enrollment changes:', error);
    }
  };

  /* ------------------------------------------------------------------
   * CRUD / helper mutations – inserted per instructions
   * ------------------------------------------------------------------ */

  const createParticipantMutation = useMutation(
    async (body) => {
      const res = await axios.post(`${API_URL}/api/v1/participants`, body);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['participants']);
        setIsCreateModalOpen(false);
        resetParticipantForm();
      }
    }
  );

  const updateParticipantMutation = useMutation(
    async ({ id, participantData }) => {
      const res = await axios.put(`${API_URL}/api/v1/participants/${id}`, participantData);
      return res.data;
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['participants']);
        setIsEditModalOpen(false);
        setSelectedParticipant(data?.data || null);
      }
    }
  );

  const deleteParticipantMutation = useMutation(
    async (id) => {
      const res = await axios.delete(`${API_URL}/api/v1/participants/${id}`);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['participants']);
        setIsDeleteModalOpen(false);
        setSelectedParticipant(null);
      }
    }
  );

  const addGoalMutation = useMutation(
    async ({ participantId, goalData }) => {
      const res = await axios.post(`${API_URL}/api/v1/participants/${participantId}/goals`, goalData);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['participants']);
        setNewGoal({ title: '', description: '', target_date: '', category: 'independence', status: 'not_started' });
      }
    }
  );

  const addBillingCodeMutation = useMutation(
    async ({ participantId, billingCodeData }) => {
      const res = await axios.post(`${API_URL}/api/v1/participants/${participantId}/billing-codes`, billingCodeData);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['participants']);
        setNewBillingCode({ code: '', description: '', rate: '', total_amount: '', remaining_amount: '', start_date: '', end_date: '' });
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
      plan_management_type: 'agency_managed',
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
      plan_management_type: participant.plan_management_type || 'agency_managed',
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

  // Handle tab switching with gating
  const handleTabSwitch = (tab) => {
    if ((tab === 'planning' || tab === 'reports') && !selectedParticipant) {
      setToast({ visible: true, message: 'Select a participant first to access this tab.' });
      setTimeout(() => setToast({ visible: false, message: '' }), 2500);
      return;
    }
    setActiveTab(tab);
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

  // Get supervision multiplier color
  const getSupervisionColor = (multiplier) => {
    if (multiplier <= 1.0) return '#9e9e9e';
    if (multiplier <= 1.5) return '#4caf50';
    if (multiplier <= 2.0) return '#ff9800';
    return '#e53935';
  };

  // Get change type badge class
  const getChangeTypeBadge = (type) => {
    switch (type) {
      case 'PROGRAM_JOIN':
        return 'badge-green';
      case 'PROGRAM_LEAVE':
        return 'badge-red';
      case 'PROGRAM_CANCEL':
        return 'badge-yellow';
      case 'BILLING_CODE_CHANGE':
        return 'badge-blue';
      default:
        return 'badge-gray';
    }
  };

  /* ------------------------------------------------------------------
   * CSV Export Utilities + Handlers
   * ------------------------------------------------------------------ */

  // Generic CSV download helper
  const downloadCSV = (filename, rows) => {
    const process = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replaceAll('"', '""');
      if (str.search(/[",\n]/) >= 0) return `"${str}"`;
      return str;
    };
    const csv = rows.map((r) => r.map(process).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Participant Summary
  const handleExportParticipantSummary = () => {
    if (!selectedParticipant) return;
    const p = selectedParticipant;
    const rows = [
      [
        'First Name',
        'Last Name',
        'NDIS Number',
        'DOB',
        'Age',
        'Gender',
        'Phone',
        'Email',
        'Support Level',
        'Status'
      ],
      [
        p.first_name,
        p.last_name,
        p.ndis_number,
        formatDate(p.date_of_birth),
        calculateAge(p.date_of_birth),
        p.gender,
        p.phone,
        p.email,
        p.support_level,
        p.status
      ]
    ];
    downloadCSV(`participant-summary-${p.id}.csv`, rows);
  };

  // Goals Progress
  const handleExportGoalsProgress = () => {
    if (!selectedParticipant) return;
    const p = selectedParticipant;
    const header = ['Title', 'Description', 'Category', 'Status', 'Target Date'];
    const body =
      (p.goals || []).map((g) => [
        g.title,
        g.description,
        g.category,
        g.status,
        formatDate(g.target_date)
      ]) || [];
    downloadCSV(`goals-progress-${p.id}.csv`, [header, ...body]);
  };

  // Billing & Funding
  const handleExportBillingFunding = () => {
    if (!selectedParticipant) return;
    const p = selectedParticipant;
    const header = [
      'NDIS Code',
      'Description',
      'Rate',
      'Total Amount',
      'Remaining Amount',
      'Start Date',
      'End Date'
    ];
    const body =
      (p.billing_codes || []).map((b) => [
        b.code,
        b.description,
        Number(b.rate || 0).toFixed(2),
        Number(b.total_amount || 0).toFixed(2),
        Number(b.remaining_amount || 0).toFixed(2),
        formatDate(b.start_date),
        formatDate(b.end_date)
      ]) || [];
    downloadCSV(`billing-funding-${p.id}.csv`, [header, ...body]);
  };

  // Participation (simple enrolled programs list)
  const handleExportParticipation = () => {
    if (!selectedParticipant) return;
    const programNameById = Object.fromEntries(
      (availablePrograms || []).map((pr) => [pr.id, pr.name])
    );
    const header = ['Program', 'Status'];
    const body =
      (enrollments || []).map((e) => [
        programNameById[e.program_id] || `Program ${e.program_id}`,
        'Enrolled'
      ]) || [];
    downloadCSV(`participation-${selectedParticipant.id}.csv`, [header, ...body]);
  };

  /* ------------------------------------------------------------------
   * Reports helpers
   * ------------------------------------------------------------------ */
  // ----- Reports helpers -----
  const getReportPreview = (key) => {
    if (!selectedParticipant) return { columns: [], rows: [] };
    switch (key) {
      case 'summary': {
        const p = selectedParticipant;
        return {
          columns: [
            'First Name',
            'Last Name',
            'NDIS Number',
            'DOB',
            'Age',
            'Gender',
            'Phone',
            'Email',
            'Support Level',
            'Status'
          ],
          rows: [
            [
              p.first_name,
              p.last_name,
              p.ndis_number || 'N/A',
              formatDate(p.date_of_birth),
              calculateAge(p.date_of_birth),
              p.gender || 'N/A',
              p.phone || 'N/A',
              p.email || 'N/A',
              p.support_level || 'N/A',
              p.status || 'N/A'
            ]
          ]
        };
      }
      case 'goals':
        return {
          columns: ['Title', 'Description', 'Category', 'Status', 'Target Date'],
          rows:
            (selectedParticipant.goals || []).map((g) => [
              g.title,
              g.description,
              g.category,
              g.status,
              formatDate(g.target_date)
            ]) || []
        };
      case 'billing':
        return {
          columns: [
            'NDIS Code',
            'Description',
            'Rate',
            'Total Amount',
            'Remaining Amount',
            'Start Date',
            'End Date'
          ],
          rows:
            (selectedParticipant.billing_codes || []).map((b) => [
              b.code,
              b.description,
              Number(b.rate || 0).toFixed(2),
              Number(b.total_amount || 0).toFixed(2),
              Number(b.remaining_amount || 0).toFixed(2),
              formatDate(b.start_date),
              formatDate(b.end_date)
            ]) || []
        };
      case 'participation': {
        const programNameById = Object.fromEntries(
          (availablePrograms || []).map((pr) => [pr.id, pr.name])
        );
        return {
          columns: ['Program', 'Status'],
          rows:
            (enrollments || []).map((e) => [
              programNameById[e.program_id] || `Program ${e.program_id}`,
              'Enrolled'
            ]) || []
        };
      }
      default:
        return { columns: [], rows: [] };
    }
  };

  const onExportSelected = () => {
    if (!selectedReport || !selectedParticipant) return;
    switch (selectedReport) {
      case 'summary':
        return handleExportParticipantSummary();
      case 'goals':
        return handleExportGoalsProgress();
      case 'billing':
        return handleExportBillingFunding();
      case 'participation':
        return handleExportParticipation();
      default:
        return;
    }
  };

  // Render directory tab content
  const renderDirectoryTab = () => (
    <div className="directory-tab">
      {/* Search and Filter Bar */}
      <DirectoryHeader
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        filters={filters}
        setFilters={setFilters}
        onCreate={() => { resetParticipantForm(); setIsCreateModalOpen(true); }}
      />
      
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
            onClick={() => { resetParticipantForm(); setIsCreateModalOpen(true);} }
          >
            <FiPlus /> Add Participant
          </button>
        </div>
      ) : (
        <>
          <div className="participants-grid">
            {currentParticipants.map(participant => (
              <ParticipantCard
                key={participant.id}
                participant={participant}
                selected={selectedParticipant?.id === participant.id}
                onClick={(p) => setSelectedParticipant(p)}
                onEdit={handleEditParticipant}
                onDelete={(p) => { setSelectedParticipant(p); setIsDeleteModalOpen(true); }}
              />
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
          {filteredParticipants.slice(0, 8).map(participant => {
            // Calculate supervision multiplier color and width
            const supervisionMultiplier = parseFloat(participant.supervision_multiplier || 1.0);
            const supervisionColor = getSupervisionColor(supervisionMultiplier);
            
            return (
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
                  <div className="mini-supervision">
                    <span style={{ color: supervisionColor }}>{supervisionMultiplier.toFixed(2)}×</span>
                  </div>
                </div>
                <div className="participant-selection-badge">
                  <span className={`badge ${getSupportLevelBadge(participant.support_level)}`}>
                    {participant.support_level}
                  </span>
                </div>
                <div className="mini-support-flags">
                  {Object.entries(SUPPORT_FLAG_ICONS).map(([key, icon]) => (
                    participant[key] && (
                      <span 
                        key={key} 
                        className="mini-flag-icon" 
                        title={SUPPORT_FLAG_LABELS[key]}
                      >
                        {icon}
                      </span>
                    )
                  ))}
                </div>
              </div>
            );
          })}
          
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
              <button 
                className={`planning-tab-btn ${selectedPlanTab === 'history' ? 'active' : ''}`}
                onClick={() => setSelectedPlanTab('history')}
              >
                <FiClock />
                <span>History</span>
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
                
                {/* Supervision Multiplier Section */}
                <div className="planning-section glass-card">
                  <h4>Supervision Multiplier</h4>
                  <div className="supervision-settings">
                    <div className="supervision-slider-container">
                      <div className="supervision-value">
                        <span className="value-label">Current Value:</span>
                        <span 
                          className="value-number"
                          style={{ color: getSupervisionColor(supervisionValue) }}
                        >
                          {supervisionValue.toFixed(2)}×
                        </span>
                      </div>
                      
                      <input
                        type="range"
                        min="1"
                        max="2.5"
                        step="0.25"
                        value={supervisionValue}
                        onChange={(e) => setSupervisionValue(parseFloat(e.target.value))}
                        className="supervision-slider"
                      />
                      
                      <div className="slider-labels">
                        <span>1.0×</span>
                        <span>1.5×</span>
                        <span>2.0×</span>
                        <span>2.5×</span>
                      </div>
                      
                      <div className="supervision-bar-container">
                        <div className="supervision-bar-bg">
                          <div 
                            className="supervision-bar-fg"
                            style={{ 
                              width: `${Math.min((supervisionValue / 2.5) * 100, 100)}%`,
                              backgroundColor: getSupervisionColor(supervisionValue)
                            }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="supervision-impact">
                        {supervisionValue > 1.0 ? (
                          <span>Requires {((supervisionValue - 1.0) * 100).toFixed(0)}% additional support</span>
                        ) : (
                          <span>Standard supervision level</span>
                        )}
                      </div>
                      
                      <button 
                        className="btn btn-primary"
                        onClick={updateSupervisionMultiplier}
                      >
                        <FiSave /> Save Supervision Multiplier
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Support Needs Section */}
                <div className="planning-section glass-card">
                  <h4>Support Needs</h4>
                  <div className="support-needs-form">
                    <div className="support-flags-grid">
                      {Object.entries(SUPPORT_FLAG_LABELS).map(([key, label]) => (
                        <div key={key} className="support-flag-item">
                          <input
                            type="checkbox"
                            id={`flag-${key}`}
                            checked={supportFlags[key] || false}
                            onChange={(e) => setSupportFlags({...supportFlags, [key]: e.target.checked})}
                          />
                          <label htmlFor={`flag-${key}`} className="support-flag-label">
                            <span className="support-flag-icon">{SUPPORT_FLAG_ICONS[key]}</span>
                            <span>{label}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                    
                    <button 
                      className="btn btn-primary"
                      onClick={updateSupportFlags}
                    >
                      <FiSave /> Save Support Flags
                    </button>
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
                
                {/* Enrollment Management Panel */}
                <div className="planning-section glass-card">
                  <h4>Enrollment Management</h4>
                  
                  <div className="enrollment-header">
                    <div className="enrollment-title">
                      <span>Manage program enrollments for {selectedParticipant.first_name}</span>
                    </div>
                    <div className="effective-date-container">
                      <label htmlFor="effective-date">Effective Date:</label>
                      <input
                        id="effective-date"
                        type="date"
                        value={effectiveDate}
                        onChange={(e) => setEffectiveDate(e.target.value)}
                        min={format(new Date(), 'yyyy-MM-dd')}
                      />
                    </div>
                  </div>
                  
                  {isLoading.enrollments ? (
                    <div className="loading-container">
                      <div className="loading-spinner-small"></div>
                      <p>Loading enrollments...</p>
                    </div>
                  ) : (
                    <div className="enrollment-list">
                      {availablePrograms.length > 0 ? (
                        availablePrograms.map(program => {
                          const isEnrolled = enrollments.some(e => e.program_id === program.id);
                          const pendingChange = pendingChanges[program.id];
                          const isChecked = 
                            (isEnrolled && !pendingChange) || 
                            (isEnrolled && pendingChange?.action === 'add') || 
                            (!isEnrolled && pendingChange?.action === 'add');
                          
                          return (
                            <div key={program.id} className="enrollment-item">
                              <div className="enrollment-checkbox">
                                <input
                                  type="checkbox"
                                  id={`program-${program.id}`}
                                  checked={isChecked}
                                  onChange={() => toggleProgramEnrollment(program.id)}
                                />
                                <label htmlFor={`program-${program.id}`}>
                                  {program.name}
                                  {program.day_of_week !== undefined && (
                                    <span className="program-day">
                                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][program.day_of_week]}
                                    </span>
                                  )}
                                </label>
                              </div>
                              
                              {pendingChange && (
                                <div className={`pending-change ${pendingChange.action}`}>
                                  <span>
                                    Pending {pendingChange.action} on {pendingChange.effectiveDate}
                                  </span>
                                  <button 
                                    className="cancel-btn"
                                    onClick={() => {
                                      setPendingChanges(prev => {
                                        const newChanges = { ...prev };
                                        delete newChanges[program.id];
                                        return newChanges;
                                      });
                                    }}
                                  >
                                    <FiX />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-muted">No available programs found.</p>
                      )}
                    </div>
                  )}
                  
                  {Object.keys(pendingChanges).length > 0 && (
                    <div className="enrollment-actions">
                      <button 
                        className="btn btn-primary"
                        onClick={saveEnrollmentChanges}
                      >
                        <FiSave /> Save Enrollment Changes
                      </button>
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
                
                {/* Billing History Table */}
                <div className="planning-section glass-card">
                  <h4>Billing History</h4>
                  <div className="billing-history-table-container">
                    <table className="billing-history-table">
                      <thead>
                        <tr>
                          <th>NDIS Number</th>
                          <th>Support From</th>
                          <th>Support To</th>
                          <th>NDIS Code</th>
                          <th>Rate</th>
                          <th>Quantity</th>
                          <th>Program</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedParticipant.billing_history || []).map((item, index) => (
                          <tr key={index}>
                            <td>{item.ndis_number || selectedParticipant.ndis_number || 'N/A'}</td>
                            <td>{formatDate(item.support_from)}</td>
                            <td>{formatDate(item.support_to)}</td>
                            <td>{item.ndis_code || 'N/A'}</td>
                            <td>${parseFloat(item.rate || 0).toFixed(2)}</td>
                            <td>{parseFloat(item.quantity || 0).toFixed(2)}</td>
                            <td>{item.program || 'N/A'}</td>
                            <td>${parseFloat(item.total || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                        {(!selectedParticipant.billing_history || selectedParticipant.billing_history.length === 0) && (
                          <tr>
                            <td colSpan="8" className="empty-table-message">No billing history available</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
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
            
            {/* History Tab */}
            {selectedPlanTab === 'history' && (
              <div className="planning-history">
                <div className="planning-section glass-card">
                  <h4>Change History</h4>
                  
                  {isLoading.changes ? (
                    <div className="loading-container">
                      <div className="loading-spinner-small"></div>
                      <p>Loading change history...</p>
                    </div>
                  ) : changeHistory.length > 0 ? (
                    <div className="change-history-list">
                      {changeHistory.map(change => (
                        <div key={change.id} className="change-item">
                          <div className="change-date">
                            {formatDate(change.date)}
                          </div>
                          <div className="change-content">
                            <div className="change-header">
                              <span className={`change-type-badge ${getChangeTypeBadge(change.type)}`}>
                                {change.type?.replace('_', ' ') || 'CHANGE'}
                              </span>
                              {change.billingImpact && (
                                <span className={`billing-badge ${change.billingStatus?.toLowerCase()}`}>
                                  {change.billingStatus || 'BILLING'}
                                </span>
                              )}
                            </div>
                            <div className="change-message">{change.message}</div>
                            {change.details && (
                              <div className="change-details">{change.details}</div>
                            )}
                            <div className="change-meta">
                              {change.reason && (
                                <div className="change-reason">
                                  <span className="meta-label">Reason:</span>
                                  <span>{change.reason}</span>
                                </div>
                              )}
                              {change.changedBy && (
                                <div className="change-by">
                                  <span className="meta-label">By:</span>
                                  <span>{change.changedBy}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted">No change history available for this participant.</p>
                  )}
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
        <p>Select a report type to preview and export.</p>
      </div>

      {/* Tiles */}
      <div className="reports-grid">
        <div
          className={`report-card glass-card ${
            selectedReport === 'summary' ? 'selected' : ''
          }`}
          onClick={() => setSelectedReport('summary')}
        >
          <div className="report-icon">
            <FiBarChart2 />
          </div>
          <div className="report-content">
            <h4>Participant Summary Report</h4>
            <p>Summary of key participant data.</p>
          </div>
        </div>

        <div
          className={`report-card glass-card ${
            selectedReport === 'goals' ? 'selected' : ''
          }`}
          onClick={() => setSelectedReport('goals')}
        >
          <div className="report-icon">
            <FiTarget />
          </div>
          <div className="report-content">
            <h4>Goals Progress Report</h4>
            <p>Track progress on participant goals.</p>
          </div>
        </div>

        <div
          className={`report-card glass-card ${
            selectedReport === 'billing' ? 'selected' : ''
          }`}
          onClick={() => setSelectedReport('billing')}
        >
          <div className="report-icon">
            <FiDollarSign />
          </div>
          <div className="report-content">
            <h4>Billing & Funding Report</h4>
            <p>NDIS codes and funding utilization.</p>
          </div>
        </div>

        <div
          className={`report-card glass-card ${
            selectedReport === 'participation' ? 'selected' : ''
          }`}
          onClick={() => setSelectedReport('participation')}
        >
          <div className="report-icon">
            <FiCalendar />
          </div>
          <div className="report-content">
            <h4>Participation Report</h4>
            <p>Attendance across programs.</p>
          </div>
        </div>
      </div>

      {/* Preview */}
      {selectedReport && (
        <div className="glass-panel" style={{ marginTop: 20 }}>
          {(() => {
            const preview = getReportPreview(selectedReport);
            const titleMap = {
              summary: 'Participant Summary',
              goals: 'Goals Progress',
              billing: 'Billing & Funding',
              participation: 'Participation'
            };
            return (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 12
                  }}
                >
                  <h4 style={{ margin: 0 }}>{titleMap[selectedReport]} Preview</h4>
                  <button
                    className="btn btn-primary"
                    onClick={onExportSelected}
                    disabled={!selectedParticipant}
                  >
                    <FiDownload /> Export CSV
                  </button>
                </div>
                <div className="report-preview-table-container">
                  <table className="report-preview-table">
                    <thead>
                      <tr>
                        {preview.columns.map((c) => (
                          <th key={c}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.length === 0 ? (
                        <tr>
                          <td colSpan={preview.columns.length} style={{ opacity: 0.75 }}>
                            No data to display.
                          </td>
                        </tr>
                      ) : (
                        preview.rows.map((r, idx) => (
                          <tr key={idx}>
                            {r.map((cell, i) => (
                              <td key={i}>{cell}</td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}
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
            onClick={() => handleTabSwitch('planning')}
          >
            <FiTarget />
            <span>Planning</span>
          </button>
          <button 
            className={`tab-button ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('reports')}
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
      
      {/* Toast Notification */}
      {toast.visible && (<div className="toast-notice">{toast.message}</div>)}
    </div>
  );
};

export default Participants;
