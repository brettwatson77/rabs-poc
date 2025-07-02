import React, { useState, useEffect } from 'react';
import { getStaff, createStaff, updateStaff, deleteStaff } from '../api/api';
import '../styles/CrudPage.css';

const Staff = () => {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [formData, setFormData] = useState(null);
    const [editMode, setEditMode] = useState(false); // false = adding, true = editing

    const initialFormState = {
        id: '',
        first_name: '',
        last_name: '',
        address: '',
        suburb: '',
        postcode: '',
        contact_phone: '',
        contact_email: '',
        notes: ''
    };

    // Fetch all staff on component mount
    useEffect(() => {
        fetchStaff();
    }, []);

    const fetchStaff = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getStaff();
            setStaff(data);
        } catch (err) {
            setError('Failed to fetch staff. Please ensure the backend is running.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddClick = () => {
        setFormData(initialFormState);
        setEditMode(false);               // we're adding a new record
        setIsFormVisible(true);
    };

    const handleEditClick = (staffMember) => {
        setFormData({ ...staffMember });
        setEditMode(true);                // we're editing an existing record
        setIsFormVisible(true);
    };

    const handleDeleteClick = async (id) => {
        if (window.confirm('Are you sure you want to delete this staff member? This action cannot be undone.')) {
            try {
                await deleteStaff(id);
                fetchStaff(); // Refresh the list
            } catch (err) {
                setError('Failed to delete staff member.');
                console.error(err);
            }
        }
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        try {
            if (editMode) {
                // Update existing staff
                await updateStaff(formData.id, formData);
            } else {
                // Create new staff
                await createStaff(formData);
            }
            fetchStaff(); // Refresh the list
            setIsFormVisible(false);
            setFormData(null);
        } catch (err) {
            setError('Failed to save staff member. Please check the form data and try again.');
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
            <h1>Manage Staff</h1>

            {error && <p className="error-message">{error}</p>}

            {!isFormVisible && (
                <button onClick={handleAddClick} className="add-new-button">Add New Staff</button>
            )}

            {isFormVisible && formData && (
                <div className="form-container">
                    <h2>{editMode ? 'Edit Staff' : 'Add New Staff'}</h2>
                    <form onSubmit={handleFormSubmit}>
                        <div className="form-grid">
                            <div className="form-field">
                                <label>Staff ID (e.g., S1, S6)</label>
                                <input
                                    type="text"
                                    name="id"
                                    value={formData.id}
                                    onChange={handleFormChange}
                                    required
                                    disabled={editMode /* disable editing the ID when in edit mode */}
                                />
                            </div>
                            <div className="form-field">
                                <label>First Name</label>
                                <input type="text" name="first_name" value={formData.first_name} onChange={handleFormChange} required />
                            </div>
                            <div className="form-field">
                                <label>Last Name</label>
                                <input type="text" name="last_name" value={formData.last_name} onChange={handleFormChange} required />
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
                             <div className="form-field full-width">
                                <label>Notes</label>
                                <textarea name="notes" value={formData.notes || ''} onChange={handleFormChange}></textarea>
                            </div>
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="save-button">Save Staff</button>
                            <button type="button" onClick={handleCancelClick} className="cancel-button">Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {loading && <p>Loading staff...</p>}

            {!loading && !isFormVisible && (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Staff ID</th>
                                <th>Name</th>
                                <th>Contact Phone</th>
                                <th>Contact Email</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staff.map(s => (
                                <tr key={s.id}>
                                    <td>{s.id}</td>
                                    <td>{s.first_name} {s.last_name}</td>
                                    <td>{s.contact_phone || 'N/A'}</td>
                                    <td>{s.contact_email || 'N/A'}</td>
                                    <td className="actions-cell">
                                        <button onClick={() => handleEditClick(s)} className="edit-button">Edit</button>
                                        <button onClick={() => handleDeleteClick(s.id)} className="delete-button">Delete</button>
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

export default Staff;
