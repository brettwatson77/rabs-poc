import React from 'react';
import { FiSearch, FiFilter, FiPlus } from 'react-icons/fi';

/**
 * Directory header component with search, filters and create button
 */
const DirectoryHeader = ({
  searchTerm,
  setSearchTerm,
  showFilters,
  setShowFilters,
  filters,
  setFilters,
  onCreate
}) => {
  return (
    <div className="search-filter-bar glass-panel">
      <div className="search-container">
        <FiSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search participants..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>
      
      <div className="filter-container">
        <button 
          className="filter-toggle-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          <FiFilter />
          <span>Filters</span>
        </button>
        
        {showFilters && (
          <div className="filter-dropdown glass-panel">
            <div className="filter-group">
              <label>Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label>Support Level</label>
              <select
                value={filters.supportLevel}
                onChange={(e) => setFilters({...filters, supportLevel: e.target.value})}
              >
                <option value="all">All Levels</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="standard">Standard</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Plan Management Type */}
            <div className="filter-group">
              <label>Management</label>
              <select
                value={filters.planManagementType}
                onChange={(e) =>
                  setFilters({ ...filters, planManagementType: e.target.value })
                }
              >
                <option value="all">All Types</option>
                <option value="agency_managed">Agency Managed</option>
                <option value="plan_managed">Plan Managed</option>
                <option value="self_managed">Self Managed</option>
                <option value="self_funded">Self Funded</option>
              </select>
            </div>
          </div>
        )}
      </div>
      
      <button 
        className="create-btn glass-button"
        onClick={onCreate}
      >
        <FiPlus />
        <span>New Participant</span>
      </button>
    </div>
  );
};

export default DirectoryHeader;
