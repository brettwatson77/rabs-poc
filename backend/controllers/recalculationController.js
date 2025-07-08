const recalculationService = require('../services/recalculationService');

/**
 * Controller to trigger the processing of pending enrollment changes.
 */
const processPendingChanges = async (req, res) => {
  try {
    console.log('✅ Recalculation route hit');
    console.log('📦 Incoming body:', req.body);

    const { simulatedDate } = req.body;

    if (!simulatedDate) {
      console.warn('⚠️ Missing simulatedDate');
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: simulatedDate is required',
      });
    }

    const result = await recalculationService.processPendingChanges(simulatedDate);

    console.log('✅ Recalculation result:', result);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('🔥 Error processing pending changes:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing pending changes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ✅ You still need this:
module.exports = {
  processPendingChanges,
};
