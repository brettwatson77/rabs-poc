import React from 'react';
import { FiSearch, FiFilter } from 'react-icons/fi';

const SearchFilterBar = ({ 
  searchTerm, 
  onSearchChange, 
  showFilters, 
  onToggleFilters, 
  filters, 
  onFiltersChange,
  children 
}) => {
  // Handle filter changes
  const handleFilterChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };
  
  return (
    <div className="search-filter-bar glass-panel">
      <div className="search-container">
        <FiSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search vehicles..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
      </div>
      
      <div className="filter-container">
        <button 
          className="filter-toggle-btn"
          onClick={onToggleFilters}
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
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="out_of_service">Out of Service</option>
                <option value="reserved">Reserved</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label>Fuel Type</label>
              <select
                value={filters.fuelType}
                onChange={(e) => handleFilterChange('fuelType', e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="petrol">Petrol</option>
                <option value="diesel">Diesel</option>
                <option value="electric">Electric</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label>Availability</label>
              <select
                value={filters.availability}
                onChange={(e) => handleFilterChange('availability', e.target.value)}
              >
                <option value="all">All</option>
                <option value="available">Available Today</option>
                <option value="unavailable">Unavailable Today</option>
              </select>
            </div>
          </div>
        )}
      </div>
      
      {children}
    </div>
  );
};

export default SearchFilterBar;
