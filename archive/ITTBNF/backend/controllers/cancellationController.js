const cancellationService = require('../services/cancellationService');

/**
 * Handles the creation of a cancellation record.
 * It expects participantId, programInstanceId, and a cancellation type ('normal' or 'short_notice').
 */
const handleCreateCancellation = async (req, res) => {
  const { participantId, programInstanceId, type } = req.body;

  // Basic validation to ensure all required fields are present
  if (!participantId || !programInstanceId || !type) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required fields: participantId, programInstanceId, and type are required.' 
    });
  }

  // More specific validation for the 'type' field
  if (type !== 'normal' && type !== 'short_notice') {
    return res.status(400).json({
      success: false,
      message: "Invalid cancellation type. Must be 'normal' or 'short_notice'."
    });
  }

  try {
    // Pass arguments as a single object to match the service signature
    const result = await cancellationService.createCancellation({
      participantId,
      programInstanceId,
      type,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error in cancellationController.handleCreateCancellation:', error);
    // Provide a more specific error message if it's a known type
    if (error.message.includes('No matching attendance record')) {
        return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred while processing the cancellation.', 
      error: error.message 
    });
  }
};

module.exports = {
  handleCreateCancellation,
};
