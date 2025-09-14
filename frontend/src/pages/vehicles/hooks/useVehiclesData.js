import { useQuery } from 'react-query';
import { format, addDays } from 'date-fns';
import api from '../../../api/api';

/**
 * Custom hook to fetch vehicles data, staff data, and bookings
 * @param {Date} currentWeekStart - Start date of the week to fetch bookings for
 * @returns {Object} Object containing vehicles, staff, and bookings data with loading states
 */
function useVehiclesData(currentWeekStart = new Date()) {
  // Format start and end dates for bookings query
  const startDate = format(currentWeekStart, 'yyyy-MM-dd');
  const endDate = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');

  // Fetch vehicles data
  const {
    data: vehiclesData,
    isLoading: vehiclesLoading,
    error: vehiclesError,
    refetch: refetchVehicles
  } = useQuery(
    ['vehicles'],
    async () => {
      const response = await api.get('/vehicles');
      return response.data;
    }
  );

  // Fetch staff data for driver selection
  const {
    data: staffData,
    isLoading: staffLoading
  } = useQuery(
    ['staff'],
    async () => {
      const response = await api.get('/staff');
      return response.data;
    }
  );

  // Fetch bookings data for the specified week
  const {
    data: bookingsData,
    isLoading: bookingsLoading,
    refetch: refetchBookings
  } = useQuery(
    ['vehicleBookings', startDate, endDate],
    async () => {
      const response = await api.get('/vehicles/bookings', {
        params: {
          start_date: startDate,
          end_date: endDate
        }
      });
      return response.data;
    }
  );

  return {
    vehiclesData,
    vehiclesLoading,
    vehiclesError,
    refetchVehicles,
    staffData,
    staffLoading,
    bookingsData,
    bookingsLoading,
    refetchBookings
  };
}

export default useVehiclesData;
