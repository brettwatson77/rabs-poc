import React from 'react';
import { FiCalendar, FiArrowLeft, FiArrowRight, FiUser, FiClock, FiFileText, FiPlus } from 'react-icons/fi';

const BookingsTab = ({
  vehicle,
  bookingsData,
  currentWeekStart,
  format,
  addDays,
  getWeekDates,
  getBookingsForVehicleAndDate,
  formatDate,
  getDriverName,
  bookingsLoading,
  onPrevWeek,
  onNextWeek,
  onAddBooking
}) => {
  if (!vehicle) return null;

  return (
    <div className="vehicle-bookings">
      <div className="detail-section glass-card">
        <div className="section-header">
          <h4>Upcoming Bookings</h4>
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => onAddBooking?.(vehicle)}
          >
            <FiPlus /> Add Booking
          </button>
        </div>
        
        <div className="week-navigation">
          <button className="btn btn-sm" onClick={onPrevWeek}>
            <FiArrowLeft /> Previous Week
          </button>
          <span className="week-label">
            {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
          </span>
          <button className="btn btn-sm" onClick={onNextWeek}>
            Next Week <FiArrowRight />
          </button>
        </div>
        
        {bookingsLoading ? (
          <div className="loading-container">
            <div className="loading-spinner-small"></div>
            <p>Loading bookings...</p>
          </div>
        ) : (
          <div className="weekly-calendar">
            {getWeekDates().map((date, index) => {
              const bookings = getBookingsForVehicleAndDate(vehicle.id, date);
              const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
              
              return (
                <div key={index} className={`calendar-day ${isToday ? 'today' : ''}`}>
                  <div className="day-header">
                    <span className="day-name">{format(date, 'EEE')}</span>
                    <span className="day-date">{format(date, 'd MMM')}</span>
                  </div>
                  
                  <div className="day-bookings">
                    {bookings.length > 0 ? (
                      bookings.map((booking, bookingIndex) => (
                        <div key={bookingIndex} className="booking-item">
                          <div className="booking-time">
                            {booking.start_time} - {booking.end_time}
                          </div>
                          <div className="booking-details">
                            <div className="booking-driver">
                              <FiUser className="icon" />
                              <span>{getDriverName(booking.driver_id)}</span>
                            </div>
                            <div className="booking-purpose">
                              <span>{booking.purpose || 'No purpose specified'}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="no-bookings">
                        <span>Available</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <div className="detail-section glass-card">
        <h4>All Bookings</h4>
        <div className="bookings-list">
          {bookingsData?.data?.filter(booking => booking.vehicle_id === vehicle.id)
            .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
            .map((booking, index) => (
              <div key={index} className="booking-list-item">
                <div className="booking-date">
                  <FiCalendar className="icon" />
                  <span>{formatDate(booking.start_date)}</span>
                  {booking.start_date !== booking.end_date && (
                    <span className="date-range">
                      - {formatDate(booking.end_date)}
                    </span>
                  )}
                </div>
                <div className="booking-time">
                  <FiClock className="icon" />
                  <span>{booking.start_time} - {booking.end_time}</span>
                </div>
                <div className="booking-driver">
                  <FiUser className="icon" />
                  <span>{getDriverName(booking.driver_id)}</span>
                </div>
                <div className="booking-purpose">
                  {booking.purpose}
                </div>
                {booking.notes && (
                  <div className="booking-notes">
                    <FiFileText className="icon" />
                    <span>{booking.notes}</span>
                  </div>
                )}
              </div>
            ))}
          
          {!bookingsData?.data?.some(booking => booking.vehicle_id === vehicle.id) && (
            <p className="text-muted">No bookings found for this vehicle.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingsTab;
