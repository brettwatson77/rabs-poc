import React, { useState, useEffect } from 'react';
import {
  generateBillingCsv,
  generateInvoicesCsv,
  getRateLineItems,
  createRateLineItem,
  updateRateLineItem,
  deleteRateLineItem,
  getPrograms
} from '../api/api';
import '../styles/CrudPage.css';

// Helper function to get a date string in YYYY-MM-DD format
const getISODate = (date) => {
  return new Date(date).toISOString().split('T')[0];
};

const Finance = () => {
  // Default to a week we know has data from the seed script
  const [startDate, setStartDate] = useState('2025-05-05');
  const [endDate, setEndDate] = useState('2025-05-11');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* ------------------------------------------------------------------
   * Rate-management state
   * ---------------------------------------------------------------- */
  const [rateItems, setRateItems] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loadingRates, setLoadingRates] = useState(true);
  const [errorRates, setErrorRates] = useState(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [formData, setFormData] = useState(null);
  const [editMode, setEditMode] = useState(false);

  const initialFormState = {
    id: null,
    program_id: '',
    support_number: '',
    description: '',
    unit_price: '',
    gst_code: 'P2',
    claim_type: 'Service',
    in_kind_funding_program: ''
  };

  const handleBillingDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      await generateBillingCsv(startDate, endDate);
    } catch (err) {
      setError('Failed to download agency billing CSV. Please check the console for details.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvoicesDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      await generateInvoicesCsv(startDate, endDate);
    } catch (err) {
      setError('Failed to download plan-managed invoices CSV. Please check the console for details.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------
   * Rate-management helpers
   * ---------------------------------------------------------------- */
  const fetchRatesAndPrograms = async () => {
    setLoadingRates(true);
    setErrorRates(null);
    try {
      const [ratesData, programsData] = await Promise.all([
        getRateLineItems(),
        getPrograms()
      ]);
      setRateItems(ratesData);
      setPrograms(programsData);
    } catch (err) {
      setErrorRates('Failed to fetch rate line items or programs.');
      console.error(err);
    } finally {
      setLoadingRates(false);
    }
  };

  useEffect(() => {
    fetchRatesAndPrograms();
  }, []);

  const handleAddClick = () => {
    setFormData(initialFormState);
    setEditMode(false);
    setIsFormVisible(true);
  };

  const handleEditClick = (item) => {
    setFormData({ ...item });
    setEditMode(true);
    setIsFormVisible(true);
  };

  const handleDeleteClick = async (id) => {
    if (window.confirm('Are you sure you want to delete this rate line item?')) {
      try {
        await deleteRateLineItem(id);
        fetchRatesAndPrograms();
      } catch (err) {
        setErrorRates('Failed to delete rate line item.');
        console.error(err);
      }
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setErrorRates(null);
    try {
      if (editMode) {
        await updateRateLineItem(formData.id, formData);
      } else {
        await createRateLineItem(formData);
      }
      fetchRatesAndPrograms();
      setIsFormVisible(false);
      setFormData(null);
    } catch (err) {
      setErrorRates('Failed to save rate line item.');
      console.error(err);
    }
  };

  const handleCancelClick = () => {
    setIsFormVisible(false);
    setFormData(null);
    setErrorRates(null);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Finance &amp; Billing</h1>
      <p>Generate billing and invoice reports for a selected date range.</p>

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '15px', 
        padding: '20px', 
        border: '1px solid #ccc', 
        borderRadius: '8px',
        backgroundColor: '#f9f9f9'
      }}>
        <div>
          <label htmlFor="start-date" style={{ display: 'block', marginBottom: '5px' }}>Start Date:</label>
          <input
            type="date"
            id="start-date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
        <div>
          <label htmlFor="end-date" style={{ display: 'block', marginBottom: '5px' }}>End Date:</label>
          <input
            type="date"
            id="end-date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button onClick={handleBillingDownload} disabled={loading}>
            {loading ? 'Downloading...' : 'Download Agency Billing (NDIS)'}
          </button>
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button onClick={handleInvoicesDownload} disabled={loading}>
            {loading ? 'Downloading...' : 'Download Plan-Managed Invoices'}
          </button>
        </div>
      </div>

      {error && <p style={{ color: 'red', marginTop: '20px' }}>{error}</p>}

      {/* ---------------------------------------------------------------- */}
      {/* Rate Management Section                                         */}
      {/* ---------------------------------------------------------------- */}

      <h2 style={{ marginTop: '40px' }}>Rate Management</h2>

      {errorRates && <p style={{ color: 'red' }}>{errorRates}</p>}

      {!isFormVisible && (
        <button onClick={handleAddClick} className="add-new-button">Add New Rate</button>
      )}

      {isFormVisible && formData && (
        <div className="form-container" style={{ marginTop: '20px' }}>
          <h3>{editMode ? 'Edit Rate' : 'Add New Rate'}</h3>
          <form onSubmit={handleFormSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <label>Program</label>
                <select name="program_id" value={formData.program_id} onChange={handleFormChange} required>
                  <option value="">-- Select a Program --</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Support Number</label>
                <input type="text" name="support_number" value={formData.support_number} onChange={handleFormChange} required />
              </div>
              <div className="form-field full-width">
                <label>Description</label>
                <input type="text" name="description" value={formData.description || ''} onChange={handleFormChange} />
              </div>
              <div className="form-field">
                <label>Unit Price</label>
                <input type="number" name="unit_price" value={formData.unit_price} onChange={handleFormChange} step="0.01" min="0" required />
              </div>
              <div className="form-field">
                <label>In-Kind Funding Program</label>
                <input type="text" name="in_kind_funding_program" value={formData.in_kind_funding_program || ''} onChange={handleFormChange} />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="save-button">Save Rate</button>
              <button type="button" className="cancel-button" onClick={handleCancelClick}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loadingRates && <p>Loading rates...</p>}

      {!loadingRates && !isFormVisible && (
        <div className="table-container" style={{ marginTop: '20px' }}>
          <table>
            <thead>
              <tr>
                <th>Program</th>
                <th>Support #</th>
                <th>Description</th>
                <th>Unit Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rateItems.map(item => {
                const prog = programs.find(p => p.id === item.program_id);
                return (
                  <tr key={item.id}>
                    <td>{prog ? prog.name : 'N/A'}</td>
                    <td>{item.support_number}</td>
                    <td>{item.description}</td>
                    <td>${Number(item.unit_price).toFixed(2)}</td>
                    <td className="actions-cell">
                      <button onClick={() => handleEditClick(item)} className="edit-button">Edit</button>
                      <button onClick={() => handleDeleteClick(item.id)} className="delete-button">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Finance;
