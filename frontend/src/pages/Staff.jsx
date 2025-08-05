import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    getStaff,
    createStaff,
    updateStaff,
    deleteStaff,
    getStaffHours,
} from '../api/api';
import '../styles/CrudPage.css';
import '../styles/Staff.css'; // new stylesheet for revolutionary look

const Staff = () => {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Map of staffId -> hours summary { allocated, percent_allocated, over_allocated }
    const [staffHours, setStaffHours] = useState({});
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [formData, setFormData] = useState(null);
    const [editMode, setEditMode] = useState(false); // false = adding, true = editing
    const [search, setSearch] = useState('');        // search / filter term

    /* ---------------------------------------------------------------------
     * Leave / Unavailability state
     * ------------------------------------------------------------------- */
    const [selectedStaff, setSelectedStaff]     = useState(null);
    const [unavailabilities, setUnavailabilities] = useState([]);
    const [showUnavailModal, setShowUnavailModal] = useState(false);
    const [unavailForm, setUnavailForm] = useState({
        start_time: '',
        end_time: '',
        reason: 'Sick Leave',
        notes: ''
    });

    const initialFormState = {
        first_name: '',
        last_name: '',
        position: '',
        address: '',
        suburb: '',
        postcode: '',
        phone: '',
        email: '',
        contracted_hours: 30,
        base_pay_rate: 0
    };

    /* ---------------------------------------------------------------------
     * Unavailability helpers
     * ------------------------------------------------------------------- */
    const fetchStaffUnavailabilities = async (staffId) => {
        try {
            const res = await axios.get(
                `/api/v1/availability/staff/${staffId}/unavailabilities`
            );
            setUnavailabilities(res.data.unavailabilities || []);
        } catch (err) {
            console.error('Failed to fetch unavailabilities', err);
            setUnavailabilities([]);
        }
    };

    const createUnavailability = async () => {
        if (!selectedStaff) return;
        try {
            await axios.post(
                `/api/v1/availability/staff/${selectedStaff.id}/unavailabilities`,
                unavailForm
            );
            await fetchStaffUnavailabilities(selectedStaff.id);
            // reset
            setUnavailForm({
                start_time: '',
                end_time: '',
                reason: 'Sick Leave',
                notes: ''
            });
        } catch (err) {
            console.error('Failed to create unavailability', err);
        }
    };

    const deleteUnavailability = async (id) => {
        if (!window.confirm('Delete this leave entry?')) return;
        try {
            await axios.delete(`/api/v1/availability/unavailabilities/${id}`);
            setUnavailabilities((p) => p.filter((u) => u.id !== id));
        } catch (err) {
            console.error('Failed to delete unavailability', err);
        }
    };

    /* upcoming leave flag (within next 14 days) */
    const hasUpcomingLeave = (staffId) => {
        const list = unavailabilities.filter((u) => u.staff_id === staffId);
        return list.some(
            (u) =>
                u.start_time &&
                new Date(u.start_time) - new Date() < 14 * 24 * 60 * 60 * 1000
        );
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

            /* ------------------------------------------------------
             * Fetch utilisation for each staff member in parallel.
             * ---------------------------------------------------- */
            const hoursArr = await Promise.all(
                data.map((s) =>
                    getStaffHours(s.id).catch(() => null) // swallow errors to avoid breaking UI
                )
            );
            const hoursMap = {};
            hoursArr.forEach((h) => {
                if (h && h.staff) {
                    hoursMap[h.staff.id] = h.hours;
                }
            });
            setStaffHours(hoursMap);
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

    /* ----------------------------------------------------------
     * Utility helpers
     * -------------------------------------------------------- */
    const getSchadsColour = (level) => {
        if (!level) return '#808080';
        const l = parseInt(level, 10);
        switch (l) {
            case 1:
            case 2:
                return '#4caf50';
            case 3:
            case 4:
                return '#2196f3';
            case 5:
            case 6:
                return '#ff9800';
            case 7:
            case 8:
                return '#e53935';
            default:
                return '#757575';
        }
    };

    const filteredStaff = staff.filter((s) => {
        if (!search.trim()) return true;
        const term = search.toLowerCase();
        return (
            s.first_name.toLowerCase().includes(term) ||
            s.last_name.toLowerCase().includes(term) ||
            (s.suburb && s.suburb.toLowerCase().includes(term)) ||
            (s.schads_level && `${s.schads_level}`.includes(term))
        );
    });

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
        <>
        <div className="crud-page-container">
            {/* Universal 3-section header */}
            <div className="staff-header">
                {/* Left – title */}
                <div className="staff-title">
                    <h1>Staff Management</h1>
                    <p className="staff-subtitle">
                        Manage staff profiles, SCHADS levels, and work allocation
                    </p>
                </div>

                {/* Right – actions & search */}
                <div className="staff-actions">
                    <div className="search-container">
                        <input
                            type="text"
                            placeholder="Search staff by name, suburb, SCHADS level..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    {!isFormVisible && (
                        <button onClick={handleAddClick} className="add-button">
                            Add New Staff
                        </button>
                    )}
                </div>
            </div>

            {error && <p className="error-message">{error}</p>}

            {isFormVisible && formData && (
                <div className="form-container">
                    <h2>{editMode ? 'Edit Staff' : 'Add New Staff'}</h2>
                    <form onSubmit={handleFormSubmit}>
                        <div className="form-grid">
                            {/* ID is generated by the database (UUID) – no manual entry */}
                            <div className="form-field">
                                <label>First Name</label>
                                <input type="text" name="first_name" value={formData.first_name} onChange={handleFormChange} required />
                            </div>
                            <div className="form-field">
                                <label>Last Name</label>
                                <input type="text" name="last_name" value={formData.last_name} onChange={handleFormChange} required />
                            </div>
                            {/* ---- NEW: Position ----------------------------------------- */}
                            <div className="form-field">
                                <label>Position</label>
                                <input
                                    type="text"
                                    name="position"
                                    value={formData.position || ''}
                                    onChange={handleFormChange}
                                    placeholder="e.g., Support Worker"
                                />
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
                                <label>Contracted&nbsp;Hours&nbsp;(per fortnight)</label>
                                <input
                                    type="number"
                                    name="contracted_hours"
                                    min="0"
                                    max="80"
                                    value={formData.contracted_hours}
                                    onChange={handleFormChange}
                                />
                            </div>
                            <div className="form-field">
                                <label>Base Pay Rate ($/hr)</label>
                                <input
                                    type="number"
                                    name="base_pay_rate"
                                    min="0"
                                    step="0.01"
                                    placeholder="$28.50/hr"
                                    value={formData.base_pay_rate || 0}
                                    onChange={handleFormChange}
                                />
                            </div>
                             <div className="form-field">
                                <label>Contact Phone</label>
                                <input type="tel" name="phone" value={formData.phone || ''} onChange={handleFormChange} />
                            </div>
                             <div className="form-field">
                                <label>Contact Email</label>
                                <input type="email" name="email" value={formData.email || ''} onChange={handleFormChange} />
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
                <>
                    {/* --- Card-based layout ---------------------------------- */}
                    <div className="staff-card-grid">
                        {filteredStaff.map((s) => {
                            const util = staffHours[s.id];
                            const utilPct = util ? Math.min(util.percent_allocated, 100) : 0;
                            const schadsColour = getSchadsColour(s.schads_level);
                            return (
                                <div className="staff-card" key={s.id}>
                                    <div className="staff-card-header">
                                        <div
                                            className="staff-photo"
                                            /* TODO: replace with real staff photo */
                                            style={{ backgroundColor: '#cfd8dc' }}
                                        ></div>
                                        <div className="staff-main-info">
                                            <h3>
                                                {s.first_name} {s.last_name}
                                            </h3>
                                        </div>
                                        {s.schads_level && (
                                            <span
                                                className="schads-chip"
                                                title={`Base Rate: $${s.base_rate || '?'} / hr`}
                                                style={{ backgroundColor: schadsColour }}
                                            >
                                                SWL&nbsp;{s.schads_level}
                                            </span>
                                        )}
                                    </div>

                                    {/* Utilisation meter */}
                                    <div className="utilisation-meter">
                                        <div className="util-bar-bg">
                                            <div
                                                className="util-bar-fg"
                                                style={{
                                                    width: `${utilPct}%`,
                                                    background:
                                                        util && util.over_allocated
                                                            ? '#e63946'
                                                            : '#4caf50',
                                                }}
                                            ></div>
                                        </div>
                                        <small>
                                            {util
                                                ? `${util.allocated.toFixed(1)} / ${s.contracted_hours} hrs`
                                                : 'Loading…'}
                                        </small>
                                    </div>

                                    {/* Quick Metrics */}
                                    <div className="staff-quick-metrics">
                                        <div>
                                            <strong>Phone:</strong>{' '}
                                            {s.phone || 'N/A'}
                                        </div>
                                        <div>
                                            <strong>Email:</strong>{' '}
                                            {s.email || 'N/A'}
                                        </div>
                                        <div>
                                            <strong>Pay Rate:</strong>{' '}
                                            ${
                                                s.base_pay_rate !== null && s.base_pay_rate !== undefined
                                                    ? Number(s.base_pay_rate).toFixed(2)
                                                    : '0.00'
                                            }/hr
                                        </div>
                                        {/* TODO: add weekend penalty preview, cost analysis */}
                                    </div>

                                    {/* Actions */}
                                    <div className="staff-card-actions">
                                        <button
                                            className="edit-button"
                                            onClick={() => handleEditClick(s)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="delete-button"
                                            onClick={() => handleDeleteClick(s.id)}
                                        >
                                            Delete
                                        </button>
                                                    <button
                                                        className="leave-button"
                                                        onClick={() => {
                                                            setSelectedStaff(s);
                                                            setShowUnavailModal(true);
                                                            fetchStaffUnavailabilities(s.id);
                                                        }}
                                                    >
                                                        Manage Leave
                                                    </button>
                                    </div>

                                    {/* Footer – serial number */}
                                    <div className="staff-card-footer">
                                        <span className="staff-serial">ID: {s.id}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>

        {/* ---------------- Unavailability Modal ---------------- */}
        {showUnavailModal && selectedStaff && (
            <div className="modal-overlay">
                <div className="modal maintenance-modal">
                    <h2>
                        Manage Leave – {selectedStaff.first_name} {selectedStaff.last_name} ({selectedStaff.id})
                    </h2>

                    {/* Existing leave list */}
                    <h4>Existing / Upcoming</h4>
                    {unavailabilities.length === 0 ? (
                        <p>No leave entries.</p>
                    ) : (
                        <ul className="blackout-list">
                            {unavailabilities.map((u) => (
                                <li key={u.id}>
                                    <strong>
                                        {new Date(u.start_time).toLocaleDateString()} →
                                        {new Date(u.end_time).toLocaleDateString()}
                                    </strong>{' '}
                                    ({u.reason})
                                    <button
                                        onClick={() => deleteUnavailability(u.id)}
                                        className="delete-button small"
                                    >
                                        Delete
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* New leave form */}
                    <h4>New Leave Window</h4>
                    <div className="form-inline">
                        <input
                            type="datetime-local"
                            value={unavailForm.start_time}
                            onChange={(e) =>
                                setUnavailForm((p) => ({ ...p, start_time: e.target.value }))
                            }
                        />
                        <span>to</span>
                        <input
                            type="datetime-local"
                            value={unavailForm.end_time}
                            onChange={(e) =>
                                setUnavailForm((p) => ({ ...p, end_time: e.target.value }))
                            }
                        />
                    </div>
                    <div className="form-field">
                        <label>Reason</label>
                        <select
                            value={unavailForm.reason}
                            onChange={(e) =>
                                setUnavailForm((p) => ({ ...p, reason: e.target.value }))
                            }
                        >
                            <option>Sick Leave</option>
                            <option>Annual Leave</option>
                            <option>Training</option>
                            <option>License Expired</option>
                            <option>Personal Leave</option>
                        </select>
                    </div>
                    <div className="form-field">
                        <label>Notes</label>
                        <textarea
                            value={unavailForm.notes}
                            onChange={(e) =>
                                setUnavailForm((p) => ({ ...p, notes: e.target.value }))
                            }
                        ></textarea>
                    </div>

                    <div className="modal-actions">
                        <button className="save-button" onClick={createUnavailability}>
                            Save Leave
                        </button>
                        <button
                            className="cancel-button"
                            onClick={() => {
                                setShowUnavailModal(false);
                                setSelectedStaff(null);
                                setUnavailabilities([]);
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}

        </>
    );
};

export default Staff;
