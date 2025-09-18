import React from 'react';
import { FiSave, FiX, FiToggleLeft, FiToggleRight } from 'react-icons/fi';

/**
 * Reusable Venue Form component for creating or editing venues
 * 
 * @param {Object} props
 * @param {Object} props.value - The venue data object
 * @param {Function} props.onChange - Function called when form values change
 * @param {Function} props.onSubmit - Function called when form is submitted
 * @param {string} props.submitLabel - Label for the submit button
 * @param {boolean} props.saving - Whether the form is currently saving
 * @param {Function} [props.onCancel] - Optional function called when cancel button is clicked
 * @returns {JSX.Element} Venue form component
 */
const VenueForm = ({
  value = {},
  onChange,
  onSubmit,
  submitLabel = 'Save Venue',
  saving = false,
  onCancel
}) => {
  // Safe values with defaults
  const venue = {
    name: '',
    address: '',
    suburb: '',
    state: '',
    postcode: '',
    capacity: '',
    contact_phone: '',
    contact_email: '',
    accessibility_features: '',
    venue_type: '',
    notes: '',
    is_active: true,
    features: {
      // Accessibility
      wheelchair_access: false,
      accessible_restroom: false,
      hearing_loop: false,
      vision_aids: false,
      elevator: false,
      ramps: false,
      // Amenities / ICT
      wifi: false,
      projector: false,
      sound_system: false,
      whiteboard: false,
      stage: false,
      // Kitchen / Catering
      kitchen: false,
      fridge: false,
      microwave: false,
      kettle: false,
      dishwasher: false,
      // Safety
      first_aid_kit: false,
      defibrillator: false,
      fire_extinguisher: false,
      // Parking / Transport
      onsite_parking: false,
      accessible_parking: false,
      street_parking: false,
      // Merge any provided values last
      ...(value.features || {})
    },
    // Transport flag (default false)
    include_in_transport:
      value.include_in_transport !== undefined
        ? value.include_in_transport
        : false,
    ...value
  };

  // Handle field changes
  const handleChange = (field, newValue) => {
    onChange({
      ...venue,
      [field]: newValue
    });
  };

  // Handle capacity as a number
  const handleCapacityChange = (e) => {
    const rawValue = e.target.value;
    // Store as number if valid, otherwise empty string
    const numericValue = rawValue === '' ? '' : parseInt(rawValue, 10);
    
    // Only update if it's a valid number or empty string
    if (rawValue === '' || !isNaN(numericValue)) {
      handleChange('capacity', numericValue);
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  // Check if form is valid
  const isValid = venue.name && venue.name.trim() !== '';

  /* ------------------------------------------------------------------ */
  /* Feature helpers                                                    */
  /* ------------------------------------------------------------------ */

  const featureGroups = {
    Accessibility: [
      'wheelchair_access',
      'accessible_restroom',
      'hearing_loop',
      'vision_aids',
      'elevator',
      'ramps'
    ],
    'Amenities / ICT': [
      'wifi',
      'projector',
      'sound_system',
      'whiteboard',
      'stage'
    ],
    'Kitchen / Catering': [
      'kitchen',
      'fridge',
      'microwave',
      'kettle',
      'dishwasher'
    ],
    Safety: ['first_aid_kit', 'defibrillator', 'fire_extinguisher'],
    'Parking / Transport': [
      'onsite_parking',
      'accessible_parking',
      'street_parking'
    ]
  };

  const formatLabel = (key) =>
    key
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  const toggleFeature = (key, checked) => {
    const updatedFeatures = {
      ...venue.features,
      [key]: checked
    };

    onChange({
      ...venue,
      features: updatedFeatures
    });
  };

  return (
    <div className="venue-form">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="venue-name">Name *</label>
          <input
            id="venue-name"
            type="text"
            className="form-control"
            value={venue.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Enter venue name"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="venue-address">Street Address</label>
          <input
            id="venue-address"
            type="text"
            className="form-control"
            value={venue.address || ''}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="Enter street address"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="venue-suburb">Suburb</label>
            <input
              id="venue-suburb"
              type="text"
              className="form-control"
              value={venue.suburb || ''}
              onChange={(e) => handleChange('suburb', e.target.value)}
              placeholder="Enter suburb"
            />
          </div>

          <div className="form-group">
            <label htmlFor="venue-state">State</label>
            <input
              id="venue-state"
              type="text"
              className="form-control"
              value={venue.state || ''}
              onChange={(e) => handleChange('state', e.target.value)}
              placeholder="Enter state"
            />
          </div>

          <div className="form-group">
            <label htmlFor="venue-postcode">Postcode</label>
            <input
              id="venue-postcode"
              type="text"
              className="form-control"
              value={venue.postcode || ''}
              onChange={(e) => handleChange('postcode', e.target.value)}
              placeholder="Enter postcode"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="venue-capacity">Capacity</label>
          <input
            id="venue-capacity"
            type="number"
            className="form-control"
            value={venue.capacity === 0 ? '0' : venue.capacity || ''}
            onChange={handleCapacityChange}
            placeholder="Enter capacity"
            min="0"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="venue-phone">Contact Phone</label>
            <input
              id="venue-phone"
              type="tel"
              className="form-control"
              value={venue.contact_phone || ''}
              onChange={(e) => handleChange('contact_phone', e.target.value)}
              placeholder="Enter contact phone"
            />
          </div>

          <div className="form-group">
            <label htmlFor="venue-email">Contact Email</label>
            <input
              id="venue-email"
              type="email"
              className="form-control"
              value={venue.contact_email || ''}
              onChange={(e) => handleChange('contact_email', e.target.value)}
              placeholder="Enter contact email"
            />
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Facilities & Features (checkbox groups)                           */}
        {/* ---------------------------------------------------------------- */}

        {Object.entries(featureGroups).map(([groupName, keys]) => (
          <div key={groupName} className="form-group">
            <h4 style={{ marginBottom: '6px' }}>{groupName}</h4>
            <div className="form-row">
              {keys.map((key) => (
                <label
                  key={key}
                  className="checkbox-label"
                  style={{ flex: '1 1 200px', marginBottom: '6px' }}
                >
                  <input
                    type="checkbox"
                    checked={!!venue.features[key]}
                    onChange={(e) => toggleFeature(key, e.target.checked)}
                  />{' '}
                  {formatLabel(key)}
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="form-group">
          <label htmlFor="venue-type">Venue Type</label>
          <input
            id="venue-type"
            type="text"
            className="form-control"
            value={venue.venue_type || ''}
            onChange={(e) => handleChange('venue_type', e.target.value)}
            placeholder="Enter venue type"
          />
        </div>

        <div className="form-group">
          <label htmlFor="venue-notes">Notes</label>
          <textarea
            id="venue-notes"
            className="form-control"
            value={venue.notes || ''}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Enter additional notes"
            rows="3"
          />
        </div>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={venue.is_active === true}
              onChange={(e) => handleChange('is_active', e.target.checked)}
            />
            <span className="checkbox-text">
              {venue.is_active ? <FiToggleRight className="toggle-icon active" /> : <FiToggleLeft className="toggle-icon" />}
              Active
            </span>
          </label>
        </div>

        {/* Include in Transport */}
        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={!!venue.include_in_transport}
              onChange={(e) =>
                handleChange('include_in_transport', e.target.checked)
              }
            />
            <span className="checkbox-text">
              {venue.include_in_transport ? (
                <FiToggleRight className="toggle-icon active" />
              ) : (
                <FiToggleLeft className="toggle-icon" />
              )}
              Include in Transport
            </span>
          </label>
        </div>

        <div className="form-actions">
          {onCancel && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={saving}
            >
              <FiX /> Cancel
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !isValid}
          >
            <FiSave /> {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VenueForm;
