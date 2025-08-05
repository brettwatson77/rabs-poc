/**
 * Add Staff Calculation to Program Creation
 * 
 * This script enhances the program creation modal in MasterSchedule.jsx to show
 * real-time staff calculation based on:
 * 1. Number of participants selected
 * 2. Their supervision multipliers (1x, 1.5x, 2x, etc.)
 * 3. The 1:4 staff-to-participant ratio rule
 * 4. Number of time slots
 * 
 * Usage: node scripts/add-staff-calculation-to-creation.js
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for prettier output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Path to MasterSchedule.jsx
const masterSchedulePath = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'MasterSchedule.jsx');

// Create backup of original file
console.log(`${colors.yellow}Creating backup of original MasterSchedule.jsx...${colors.reset}`);
const backupPath = `${masterSchedulePath}.bak.${Date.now()}`;
fs.copyFileSync(masterSchedulePath, backupPath);
console.log(`${colors.green}Backup created at: ${backupPath}${colors.reset}`);

// Read the current file
console.log(`${colors.yellow}Reading MasterSchedule.jsx...${colors.reset}`);
let content = fs.readFileSync(masterSchedulePath, 'utf8');

// Add staff calculation function
console.log(`${colors.yellow}Adding staff calculation function...${colors.reset}`);

// Check if the function already exists to avoid duplication
if (!content.includes('calculateStaffNeeds')) {
  // Find a good spot to add the function - after other utility functions
  const insertPosition = content.indexOf('// Format loom window range');
  
  if (insertPosition === -1) {
    console.error(`${colors.red}Could not find insertion point for staff calculation function${colors.reset}`);
    process.exit(1);
  }
  
  const staffCalculationFunction = `
  // Calculate staff needs based on participant count and supervision multipliers
  const calculateStaffNeeds = (participants, timeSlots) => {
    if (!Array.isArray(participants) || participants.length === 0) {
      return {
        baseStaffCount: 0,
        adjustedStaffCount: 0,
        totalSupervisionLoad: 0,
        rosterCards: 0,
        timeSlotCards: timeSlots.length || 0,
        totalCards: timeSlots.length || 0,
        supervisionMultiplierExplanation: '',
        staffingExplanation: ''
      };
    }
    
    // Calculate total supervision load based on multipliers
    let totalSupervisionLoad = 0;
    let multiplierBreakdown = {};
    
    participants.forEach(participant => {
      const multiplier = participant.supervision_multiplier || 1.0;
      totalSupervisionLoad += multiplier;
      
      // Track multiplier counts for explanation
      const multiplierKey = multiplier.toFixed(1);
      if (!multiplierBreakdown[multiplierKey]) {
        multiplierBreakdown[multiplierKey] = 0;
      }
      multiplierBreakdown[multiplierKey]++;
    });
    
    // Base staff count using 1:4 ratio (without considering multipliers)
    const baseStaffCount = Math.ceil(participants.length / 4);
    
    // Adjusted staff count considering supervision multipliers
    const adjustedStaffCount = Math.ceil(totalSupervisionLoad / 4);
    
    // Calculate roster cards (one per staff member per time slot)
    const rosterCards = adjustedStaffCount * (timeSlots.length || 0);
    
    // Calculate total cards (dashboard + roster)
    const timeSlotCards = timeSlots.length || 0;
    const totalCards = rosterCards + timeSlotCards;
    
    // Generate explanation for supervision multipliers
    let supervisionMultiplierExplanation = '';
    if (Object.keys(multiplierBreakdown).length > 0) {
      const parts = [];
      for (const [multiplier, count] of Object.entries(multiplierBreakdown)) {
        if (multiplier !== '1.0') {
          parts.push(\`\${count} participant\${count > 1 ? 's' : ''} at \${multiplier}x\`);
        }
      }
      
      if (parts.length > 0) {
        supervisionMultiplierExplanation = \`Including \${parts.join(', ')}\`;
      }
    }
    
    // Generate explanation for staffing calculation
    let staffingExplanation = '';
    if (adjustedStaffCount > baseStaffCount) {
      staffingExplanation = \`Base: \${baseStaffCount} staff (1:4 ratio), Adjusted: \${adjustedStaffCount} staff due to supervision multipliers\`;
    } else {
      staffingExplanation = \`\${baseStaffCount} staff (standard 1:4 ratio)\`;
    }
    
    return {
      baseStaffCount,
      adjustedStaffCount,
      totalSupervisionLoad,
      rosterCards,
      timeSlotCards,
      totalCards,
      supervisionMultiplierExplanation,
      staffingExplanation
    };
  };
  
`;

  // Insert the function
  content = content.slice(0, insertPosition) + staffCalculationFunction + content.slice(insertPosition);
  console.log(`${colors.green}Staff calculation function added${colors.reset}`);
} else {
  console.log(`${colors.yellow}Staff calculation function already exists, skipping...${colors.reset}`);
}

// Add staff calculation state and effect
console.log(`${colors.yellow}Adding staff calculation state and effect...${colors.reset}`);

if (!content.includes('staffCalculation')) {
  // Find a good spot to add the state - after other state declarations
  const stateInsertPosition = content.indexOf('const [nextSlotId, setNextSlotId] = useState(2);');
  
  if (stateInsertPosition === -1) {
    console.error(`${colors.red}Could not find insertion point for staff calculation state${colors.reset}`);
    process.exit(1);
  }
  
  const staffCalculationState = `
  const [nextSlotId, setNextSlotId] = useState(2);
  
  // Staff calculation state
  const [staffCalculation, setStaffCalculation] = useState({
    baseStaffCount: 0,
    adjustedStaffCount: 0,
    totalSupervisionLoad: 0,
    rosterCards: 0,
    timeSlotCards: 0,
    totalCards: 0,
    supervisionMultiplierExplanation: '',
    staffingExplanation: ''
  });
`;

  // Replace the original state declaration with our enhanced version
  content = content.replace(
    'const [nextSlotId, setNextSlotId] = useState(2);',
    staffCalculationState
  );
  console.log(`${colors.green}Staff calculation state added${colors.reset}`);
} else {
  console.log(`${colors.yellow}Staff calculation state already exists, skipping...${colors.reset}`);
}

// Add effect to recalculate staff needs when participants or time slots change
console.log(`${colors.yellow}Adding effect for staff calculation...${colors.reset}`);

if (!content.includes('useEffect(() => { // Calculate staff needs')) {
  // Find a good spot to add the effect - after other useEffect blocks
  const effectInsertPosition = content.indexOf('// Initial data load and when simulated date changes');
  
  if (effectInsertPosition === -1) {
    console.error(`${colors.red}Could not find insertion point for staff calculation effect${colors.reset}`);
    process.exit(1);
  }
  
  const staffCalculationEffect = `
  // Recalculate staff needs when participants or time slots change
  useEffect(() => { // Calculate staff needs
    const calculation = calculateStaffNeeds(selectedParticipants, programForm.timeSlots);
    setStaffCalculation(calculation);
  }, [selectedParticipants, programForm.timeSlots]);
  
`;

  // Insert the effect
  content = content.slice(0, effectInsertPosition) + staffCalculationEffect + content.slice(effectInsertPosition);
  console.log(`${colors.green}Staff calculation effect added${colors.reset}`);
} else {
  console.log(`${colors.yellow}Staff calculation effect already exists, skipping...${colors.reset}`);
}

// Add UI elements to display staff calculation in the footer
console.log(`${colors.yellow}Adding UI elements for staff calculation...${colors.reset}`);

// Find the footer info section in the create modal
const footerInfoPosition = content.indexOf('<div className="footer-info">');

if (footerInfoPosition === -1) {
  console.error(`${colors.red}Could not find footer info section${colors.reset}`);
  process.exit(1);
}

// Find the end of the footer info section
const footerInfoEndPosition = content.indexOf('</div>', footerInfoPosition) + 6;

// Replace the footer info section with our enhanced version
const originalFooterInfo = content.substring(footerInfoPosition, footerInfoEndPosition);

const enhancedFooterInfo = `<div className="footer-info">
              <div className="time-slots-preview">
                Will create {programForm.timeSlots.length} dashboard cards
              </div>
              <div className="staff-calculation">
                <div className="staff-count">
                  <strong>Staff Required:</strong> {staffCalculation.adjustedStaffCount} 
                  {staffCalculation.supervisionMultiplierExplanation && (
                    <span className="multiplier-note">({staffCalculation.supervisionMultiplierExplanation})</span>
                  )}
                </div>
                <div className="roster-cards">
                  <strong>Roster Cards:</strong> {staffCalculation.rosterCards} 
                  <span className="card-explanation">
                    ({staffCalculation.adjustedStaffCount} staff × {programForm.timeSlots.length} time slots)
                  </span>
                </div>
                <div className="total-cards">
                  <strong>Total Cards:</strong> {staffCalculation.totalCards} 
                  <span className="card-breakdown">
                    ({staffCalculation.timeSlotCards} dashboard + {staffCalculation.rosterCards} roster)
                  </span>
                </div>
              </div>
              {programForm.isRepeating && (
                <div className="repeat-info">
                  Repeating {programForm.repeatPattern}
                  {programForm.repeatEnd
                    ? \` until \${programForm.repeatEnd}\`
                    : ' indefinitely'}
                </div>
              )}`;

content = content.replace(originalFooterInfo, enhancedFooterInfo);
console.log(`${colors.green}UI elements for staff calculation added${colors.reset}`);

// Add CSS styles for staff calculation
console.log(`${colors.yellow}Adding CSS styles for staff calculation...${colors.reset}`);

// Find the end of the file
const fileEndPosition = content.lastIndexOf('export default MasterSchedule;');

if (fileEndPosition === -1) {
  console.error(`${colors.red}Could not find end of file${colors.reset}`);
  process.exit(1);
}

// Add CSS styles before the end of the file
const cssStyles = `
/* Add these styles to your CSS file or component */
.staff-calculation {
  margin-top: 10px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-size: 0.9em;
}

.staff-count {
  margin-bottom: 5px;
}

.multiplier-note {
  font-size: 0.85em;
  color: #666;
  margin-left: 5px;
}

.roster-cards, .total-cards {
  margin-top: 3px;
}

.card-explanation, .card-breakdown {
  font-size: 0.85em;
  color: #666;
  margin-left: 5px;
}

`;

// Check if styles already exist
if (!content.includes('.staff-calculation {')) {
  // Add styles before export statement
  content = content.slice(0, fileEndPosition) + cssStyles + content.slice(fileEndPosition);
  console.log(`${colors.green}CSS styles for staff calculation added${colors.reset}`);
} else {
  console.log(`${colors.yellow}CSS styles already exist, skipping...${colors.reset}`);
}

// Write the modified file
console.log(`${colors.yellow}Writing modified MasterSchedule.jsx...${colors.reset}`);
fs.writeFileSync(masterSchedulePath, content);
console.log(`${colors.green}Successfully updated MasterSchedule.jsx${colors.reset}`);

console.log(`\n${colors.bright}${colors.green}STAFF CALCULATION ENHANCEMENT COMPLETE!${colors.reset}`);
console.log(`\n${colors.bright}NEXT STEPS:${colors.reset}`);
console.log(`1. ${colors.yellow}Restart your frontend development server${colors.reset} to apply the changes`);
console.log(`2. ${colors.yellow}Open the Master Schedule page${colors.reset} and click "Create Master Card"`);
console.log(`3. ${colors.yellow}Add participants${colors.reset} and observe the staff calculation update in real-time`);
console.log(`4. ${colors.yellow}Add/remove time slots${colors.reset} to see how it affects the number of cards`);
console.log(`\nIf you encounter any issues, you can restore the backup with:`);
console.log(`cp ${backupPath} ${masterSchedulePath}`);
