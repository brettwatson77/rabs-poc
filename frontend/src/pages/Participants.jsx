import React, { useState, useEffect } from 'react';
import { getParticipants, createParticipant, updateParticipant, deleteParticipant } from '../api/api';
import '../styles/CrudPage.css'; // We will create this file for shared styles

const Participants = () => {
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [formData, setFormData] = useState(null); // null when hidden, object when visible

    const initialFormState = {
        id: null,
        first_name: '',
        last_name: '',
        address: '',
        suburb: '',
        postcode: '',
        ndis_number: '',
        is_plan_managed: false,
        contact_phone: '',
        contact_email: '',
        notes: ''
    };

    // Fetch all participants on component mount
    useEffect(() => {
        fetchParticipants();
    }, []);

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

    const handleAddClick = () => {
        setFormData(initialFormState);
        setIsFormVisible(true);
    };

    const handleEditClick = (participant) => {
        setFormData({ ...participant, is_plan_managed: !!participant.is_plan_managed });
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

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            // The backend expects is_plan_managed as 0 or 1
            const dataPayload = { ...formData, is_plan_managed: formData.is_plan_managed ? 1 : 0 };

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

    return (
        <div className="crud-page-container">
            <h1>Manage Participants</h1>

            {error && <p className="error-message">{error}</p>}

            {!isFormVisible && (
                <button onClick={handleAddClick} className="add-new-button">Add New Participant</button>
            )}

            {isFormVisible && (
                <div className="form-container">
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
                                <label>Address</label>
                                <input type="text" name="address" value={formData.address} onChange={handleFormChange} required />
                            </div>
                            <div className="form-field">
                                <label>Suburb</label>
                                <input type="text" name="suburb" value={formData.suburb} onChange={handleFormChange} required />
                            </div>
                            <div className="form-field">
                                <label>Postcode</label>
                                <input type="text" name="postcode" value={formData.postcode} onChange={handleFormChange} required />
                            </div>
                             <div className="form-field">
                                <label>Contact Phone</label>
                                <input type="tel" name="contact_phone" value={formData.contact_phone || ''} onChange={handleFormChange} />
                            </div>
                             <div className="form-field">
                                <label>Contact Email</label>
                                <input type="email" name="contact_email" value={formData.contact_email || ''} onChange={handleFormChange} />
                            </div>
                             <div className="form-field full-width">
                                <label>Notes</label>
                                <textarea name="notes" value={formData.notes || ''} onChange={handleFormChange}></textarea>
                            </div>
                             <div className="form-field full-width">
                                <label className="checkbox-label">
                                    <input type="checkbox" name="is_plan_managed" checked={formData.is_plan_managed} onChange={handleFormChange} />
                                    This participant is Plan-Managed
                                </label>
                            </div>
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="save-button">Save Participant</button>
                            <button type="button" onClick={handleCancelClick} className="cancel-button">Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {loading && <p>Loading participants...</p>}

            {!loading && !isFormVisible && (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>NDIS Number</th>
                                <th>Management Type</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {participants.map(p => (
                                <tr key={p.id}>
                                    <td>{p.first_name} {p.last_name}</td>
                                    <td>{p.ndis_number || 'N/A'}</td>
                                    <td>{p.is_plan_managed ? 'Plan-Managed' : 'Agency-Managed'}</td>
                                    <td className="actions-cell">
                                        <button onClick={() => handleEditClick(p)} className="edit-button">Edit</button>
                                        <button onClick={() => handleDeleteClick(p.id)} className="delete-button">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Participants;
