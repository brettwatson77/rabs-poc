import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ProgramFormProvider } from '../context/ProgramFormContext';
import ProgramDetailsPanel from '../components/ProgramDetailsPanel';
import TimeSlotsEditor from '../components/TimeSlotsEditor';
import programApi from '../services/programApi';

const ProgramEditPage = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Minimal state for stub (details fields not yet fetched via dedicated GET)
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [anchorDate, setAnchorDate] = useState('');
  const [recurrencePattern, setRecurrencePattern] = useState('fortnightly');
  const [venueId, setVenueId] = useState('');
  const [venues, setVenues] = useState([]);

  const [slots, setSlots] = useState([]);
  const [newSlot, setNewSlot] = useState({ slot_type: 'activity', start_time: '09:00', end_time: '15:00', label: '' });

  const slotTypeOptions = [
    { value: 'pickup', label: 'Pickup' },
    { value: 'activity', label: 'Activity' },
    { value: 'meal', label: 'Meal' },
    { value: 'other', label: 'Other' },
    { value: 'dropoff', label: 'Dropoff' }
  ];

  const formatTime = (t) => t;
  const shiftLength = null;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const preload = await programApi.preloadById(id);
        if (!mounted) return;
        setSlots(preload.slots || []);
        setVenues(preload.venues || []);
        // best-effort: set default venue if present
        if ((preload.venues || []).length) setVenueId(preload.venues[0].id);
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
    return () => { mounted = false; };
  }, [id]);

  const addSlot = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await programApi.addSlot(id, newSlot);
      const resp = await programApi.getSlots(id);
      setSlots(resp.data.data || []);
    } finally { setSaving(false); }
  };

  const deleteSlot = async (slotId) => {
    if (!id) return;
    setSaving(true);
    try {
      await programApi.deleteSlot(id, slotId);
      const resp = await programApi.getSlots(id);
      setSlots(resp.data.data || []);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="glass-card">Loading…</div>;

  return (
    <ProgramFormProvider value={{}}>
      <ProgramDetailsPanel
        ruleName={ruleName}
        setRuleName={setRuleName}
        ruleDescription={ruleDescription}
        setRuleDescription={setRuleDescription}
        anchorDate={anchorDate}
        setAnchorDate={setAnchorDate}
        recurrencePattern={recurrencePattern}
        setRecurrencePattern={setRecurrencePattern}
        venueId={venueId}
        setVenueId={setVenueId}
        venues={venues}
        patternOptions={[]}
        createVenue={() => {}}
        saving={saving}
      />

      <TimeSlotsEditor
        slots={slots}
        newSlot={newSlot}
        setNewSlot={setNewSlot}
        addSlot={addSlot}
        deleteSlot={deleteSlot}
        formatTime={formatTime}
        shiftLength={shiftLength}
        slotTypeOptions={slotTypeOptions}
        saving={saving}
      />
    </ProgramFormProvider>
  );
};

export default ProgramEditPage;
