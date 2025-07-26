import React, { useState, useEffect } from 'react';
import { getVenues, createVenue, updateVenue, deleteVenue } from '../api/api';
import '../styles/CrudPage.css';

const Venues = () => {
    const [venues, setVenues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [formData, setFormData] = useState(null);
    const [editMode, setEditMode] = useState(false);

    const initialFormState = {
        id: null,
        name: '',
        address: '',
        suburb: '',
        postcode: '',
        is_main_centre: false,
        notes: ''
    };

    useEffect(() => {
        fetchVenues();
    }, []);

    const fetchVenues = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getVenues();
            setVenues(data);
        } catch (err) {
            setError('Failed to fetch venues. Please ensure the backend is running.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddClick = () => {
        setFormData(initialFormState);
        setEditMode(false);
        setIsFormVisible(true);
    };

    const handleEditClick = (venue) => {
        setFormData({ ...venue, is_main_centre: !!venue.is_main_centre });
        setEditMode(true);
        setIsFormVisible(true);
    };

    const handleDeleteClick = async (id) => {
        if (window.confirm('Are you sure you want to delete this venue?')) {
            try {
                await deleteVenue(id);
                fetchVenues();
            } catch (err) {
                setError('Failed to delete venue.');
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
            const dataPayload = { ...formData, is_main_centre: formData.is_main_centre ? 1 : 0 };
            if (editMode) {
                await updateVenue(formData.id, dataPayload);
            } else {
                await createVenue(dataPayload);
            }
            fetchVenues();
            setIsFormVisible(false);
            setFormData(null);
        } catch (err) {
            setError('Failed to save venue. Please check the form data.');
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
            <h1>Manage Venues</h1>
            {error && <p className="error-message">{error}</p>}
            {!isFormVisible && (
                <button onClick={handleAddClick} className="add-new-button">Add New Venue</button>
            )}

            {isFormVisible && formData && (
                <div className="form-container">
                    <h2>{editMode ? 'Edit Venue' : 'Add New Venue'}</h2>
                    <form onSubmit={handleFormSubmit}>
                        <div className="form-grid">
                            <div className="form-field">
                                <label>Venue Name</label>
                                <input type="text" name="name" value={formData.name} onChange={handleFormChange} required />
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
                            <div className="form-field full-width">
                                <label>Notes</label>
                                <textarea name="notes" value={formData.notes || ''} onChange={handleFormChange}></textarea>
                            </div>
                            <div className="form-field full-width">
                                <label className="checkbox-label">
                                    <input type="checkbox" name="is_main_centre" checked={formData.is_main_centre} onChange={handleFormChange} />
                                    This is a main centre
                                </label>
                            </div>
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="save-button">Save Venue</button>
                            <button type="button" onClick={handleCancelClick} className="cancel-button">Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {loading && <p>Loading venues...</p>}

            {!loading && !isFormVisible && (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Address</th>
                                <th>Type</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {venues.map(v => (
                                <tr key={v.id}>
                                    <td>{v.name}</td>
                                    <td>{`${v.address}, ${v.suburb} ${v.postcode}`}</td>
                                    <td>{v.is_main_centre ? 'Main Centre' : 'Community Venue'}</td>
                                    <td className="actions-cell">
                                        <button onClick={() => handleEditClick(v)} className="edit-button">Edit</button>
                                        <button onClick={() => handleDeleteClick(v.id)} className="delete-button">Delete</button>
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

export default Venues;
