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

            {/* Supervision Multiplier */}
            <div className="filter-group">
              <label>Multiplier</label>
              <div className="multiplier-filter">
                <select
                  value={filters.multiplierOp}
                  onChange={(e) =>
                    setFilters({ ...filters, multiplierOp: e.target.value })
                  }
                >
                  <option value="eq">=</option>
                  <option value="gte">≥</option>
                  <option value="lte">≤</option>
                  <option value="between">between</option>
                </select>

                {/* Single value mode */}
                {filters.multiplierOp !== 'between' && (
                  <input
                    type="number"
                    min="0.5"
                    max="2.5"
                    step="0.25"
                    value={filters.multiplierValue}
                    onChange={(e) =>
                      setFilters({ ...filters, multiplierValue: e.target.value })
                    }
                  />
                )}

                {/* Between mode => min & max */}
                {filters.multiplierOp === 'between' && (
                  <>
                    <input
                      type="number"
                      min="0.5"
                      max="2.5"
                      step="0.25"
                      placeholder="min"
                      value={filters.multiplierMin}
                      onChange={(e) =>
                        setFilters({ ...filters, multiplierMin: e.target.value })
                      }
                    />
                    <span style={{ margin: '0 4px' }}>–</span>
                    <input
                      type="number"
                      min="0.5"
                      max="2.5"
                      step="0.25"
                      placeholder="max"
                      value={filters.multiplierMax}
                      onChange={(e) =>
                        setFilters({ ...filters, multiplierMax: e.target.value })
                      }
                    />
                  </>
                )}
              </div>
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
