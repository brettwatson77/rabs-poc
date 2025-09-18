import React from 'react';
import { FiSave, FiCalendar } from 'react-icons/fi';
import { useProgramForm } from '../context/ProgramFormContext';

/**
 * Program Details Panel Component
 * 
 * Displays and manages program basic information including name, date, recurrence pattern,
 * venue selection, and program description.
 * 
 * @param {Object} props - Component props (can override context values)
 * @returns {JSX.Element} Program details form panel
 */
const ProgramDetailsPanel = (props) => {
  const ctx = useProgramForm();
  const {
    ruleName, setRuleName,
    ruleDescription, setRuleDescription,
    anchorDate, setAnchorDate,
    recurrencePattern, setRecurrencePattern,
    venueId, setVenueId,
    venues = [],
    showNewVenueForm, setShowNewVenueForm,
    newVenue = {}, setNewVenue,
    patternOptions = [],
    createVenue,
    saving = false,
  } = { ...(ctx || {}), ...props };

  return (
    <div className="glass-card mb-4 program-details">
      <div className="card-header">
        <h3><FiCalendar /> Program Details</h3>
      </div>
      <div className="card-body">
        <div className="details-split">
          <div className="details-left">
            <div className="form-group">
              <label htmlFor="ruleName">Program Name</label>
              <input
                type="text"
                id="ruleName"
                value={ruleName || ''}
                onChange={(e) => setRuleName && setRuleName(e.target.value)}
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label htmlFor="anchorDate">Start Date</label>
              <input
                type="date"
                id="anchorDate"
                value={anchorDate || ''}
                onChange={(e) => setAnchorDate && setAnchorDate(e.target.value)}
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label htmlFor="recurrencePattern">Repeat Pattern</label>
              <select
                id="recurrencePattern"
                value={recurrencePattern || ''}
                onChange={(e) => setRecurrencePattern && setRecurrencePattern(e.target.value)}
                className="form-control"
              >
                {(patternOptions || []).map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="venueId">Venue</label>
              {!showNewVenueForm ? (
                <div className="input-group">
                  <select
                    id="venueId"
                    value={venueId || ''}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setShowNewVenueForm && setShowNewVenueForm(true);
                      } else {
                        setVenueId && setVenueId(e.target.value);
                      }
                    }}
                    className="form-control"
                  >
                    <option value="">Select Venue</option>
                    {(venues || []).map(venue => (
                      <option key={venue.id} value={venue.id}>{venue.name}</option>
                    ))}
                    <option value="__new__">+ New venue</option>
                  </select>
                </div>
              ) : (
                <div className="new-venue-form">
                  <div className="form-group">
                    <label>Venue Name *</label>
                    <input
                      type="text"
                      value={newVenue.name || ''}
                      onChange={(e) => setNewVenue && setNewVenue({...newVenue, name: e.target.value})}
                      className="form-control"
                      placeholder="Enter venue name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Address *</label>
                    <input
                      type="text"
                      value={newVenue.address || ''}
                      onChange={(e) => setNewVenue && setNewVenue({...newVenue, address: e.target.value})}
                      className="form-control"
                      placeholder="Enter address"
                    />
                  </div>
                  <div className="form-group">
                    <label>Postcode</label>
                    <input
                      type="text"
                      value={newVenue.postcode || ''}
                      onChange={(e) => setNewVenue && setNewVenue({...newVenue, postcode: e.target.value})}
                      className="form-control"
                      placeholder="Enter postcode"
                    />
                  </div>
                  <div className="form-group">
                    <label>Contact Phone</label>
                    <input
                      type="text"
                      value={newVenue.contact_phone || ''}
                      onChange={(e) => setNewVenue && setNewVenue({...newVenue, contact_phone: e.target.value})}
                      className="form-control"
                      placeholder="Enter contact phone"
                    />
                  </div>
                  <div className="form-group">
                    <label>Contact Email</label>
                    <input
                      type="email"
                      value={newVenue.contact_email || ''}
                      onChange={(e) => setNewVenue && setNewVenue({...newVenue, contact_email: e.target.value})}
                      className="form-control"
                      placeholder="Enter contact email"
                    />
                  </div>
                  <div className="form-group">
                    <label>Capacity</label>
                    <input
                      type="number"
                      value={newVenue.capacity || ''}
                      onChange={(e) => setNewVenue && setNewVenue({...newVenue, capacity: e.target.value})}
                      className="form-control"
                      placeholder="Enter capacity"
                    />
                  </div>
                  <div className="form-group">
                    <label>Accessibility Features</label>
                    <input
                      type="text"
                      value={newVenue.accessibility_features || ''}
                      onChange={(e) => setNewVenue && setNewVenue({...newVenue, accessibility_features: e.target.value})}
                      className="form-control"
                      placeholder="Enter accessibility features"
                    />
                  </div>
                  <div className="form-group">
                    <label>Venue Type</label>
                    <input
                      type="text"
                      value={newVenue.venue_type || ''}
                      onChange={(e) => setNewVenue && setNewVenue({...newVenue, venue_type: e.target.value})}
                      className="form-control"
                      placeholder="Enter venue type"
                    />
                  </div>
                  {/* Include in Transport checkbox */}
                  <div className="form-group checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={!!newVenue.include_in_transport}
                        onChange={(e) =>
                          setNewVenue &&
                          setNewVenue({
                            ...newVenue,
                            include_in_transport: e.target.checked,
                          })
                        }
                      />{' '}
                      Include in Transport
                    </label>
                  </div>
                  <div className="form-actions">
                    <button 
                      className="btn btn-secondary"
                      onClick={() => setShowNewVenueForm && setShowNewVenueForm(false)}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button 
                      className="btn btn-primary"
                      onClick={createVenue}
                      disabled={saving || !(newVenue.name || '').trim() || !(newVenue.address || '').trim()}
                    >
                      <FiSave /> Save Venue
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="details-right">
            <div className="form-group">
              <label htmlFor="ruleDescription">Description & shift notes</label>
              <textarea
                id="ruleDescription"
                value={ruleDescription || ''}
                onChange={(e) => setRuleDescription && setRuleDescription(e.target.value)}
                className="form-control"
                rows="6"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgramDetailsPanel;
