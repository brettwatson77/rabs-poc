// database/seed.js
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { OpenAI } = require('openai');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// ---------------------------------------------------------------------------
// A `db` handle will be created inside `runSeed` but is referenced by the
// many helper functions below.  We declare it here so they share the same
// instance when `runSeed` is executed.
// ---------------------------------------------------------------------------
let db; // will be assigned in runSeed()

/**
 * Helper: format a JS Date in local timezone as `YYYY-MM-DD`
 * This avoids `.toISOString()` (which is UTC) and therefore
 * prevents off-by-one-day errors when the local timezone is
 * ahead/behind UTC.
 * @param {Date} d
 * @returns {string}
 */
function formatDateLocal(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Define paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'rabs-poc.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Initialize OpenAI client if API key is available
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log('OpenAI client initialized');
} else {
  console.log('No OpenAI API key found. Weekend activities will use predefined options.');
}

// Initialize Google Gemini client if API key is available
let googleAI = null;
if (process.env.GOOGLE_AI_KEY) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  googleAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
  console.log('Google Gemini client initialized');
}

// ---------------------------------------------------------------------------
// MAIN ENTRY (re-usable): runSeed()
// ---------------------------------------------------------------------------
async function runSeed() {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Created data directory: ${DATA_DIR}`);
  }

  // Always start with a clean slate
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log(`Existing database removed: ${DB_PATH}`);
  }

  // Wrap sqlite3 callback-style API in a promise so we can await it
  await new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) return reject(err);
      console.log(`Connected to database: ${DB_PATH}`);

      db.run('PRAGMA foreign_keys = ON;', (errFk) => {
        if (errFk) return reject(errFk);

        fs.readFile(SCHEMA_PATH, 'utf8', (errRead, schema) => {
          if (errRead) return reject(errRead);

          console.log('Executing schema...');
          db.exec(schema, (errExec) => {
            if (errExec) return reject(errExec);
            console.log('Schema executed successfully');

            // Now seed the database
            seedDatabase()
              .then(resolve)
              .catch(reject);
          });
        });
      });
    });
  }).then(() => {
    console.log('Seed completed ✔');
  }).catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  });
}

// Main seeding function
function seedDatabase() {
  console.log("Seeding database with fake clients, staff, vehicles, and activities...");
  
  // Run all seed functions in sequence
  return seedVenues()
    .then(() => seedPrograms())
    .then(() => seedParticipants())
    .then(() => seedStaff())
    .then(() => seedVehicles())
    .then(() => seedRateLineItems())
    .then(() => seedSettings())
    .then(() => seedProgramInstances())
    .then(() => seedEnrollments())
    .then(() => {
      console.log('Database seeding completed successfully');
      // Close database connection and resolve
      return new Promise((resolve, reject) => {
        db.close((err) => {
          if (err) return reject(err);
          console.log('Database connection closed');
          resolve();
        });
      });
    })
    .catch(err => {
      console.error('Error seeding database:', err);
      db.close();
      throw err;
    });
}

// Seed venues
function seedVenues() {
  return new Promise((resolve, reject) => {
    console.log('Seeding venues...');
    
    const venues = [
      {
        name: 'Green Valley Library',
        address: 'Green Valley Library, Green Valley Road',
        suburb: 'Green Valley',
        state: 'NSW',
        postcode: '2168',
        latitude: -33.9060,
        longitude: 150.8870,
        is_main_centre: 1,
        notes: 'Main centre for most activities'
      },
      {
        name: 'Alt Centre',
        address: '3 Carramarr Close',
        suburb: 'Picton',
        state: 'NSW',
        postcode: '2571',
        latitude: -34.1760,
        longitude: 150.6150,
        is_main_centre: 0,
        notes: 'Alternative centre for overflow activities'
      },
      {
        name: 'Bowlarama',
        address: '561 Polding Street',
        suburb: 'Wetherill Park',
        state: 'NSW',
        postcode: '2164',
        latitude: -33.8500,
        longitude: 150.9190,
        is_main_centre: 0,
        notes: 'Tuesday bowling night venue'
      },
      {
        name: 'Merrylands RSL',
        address: '8/12 Miller St',
        suburb: 'Merrylands',
        state: 'NSW',
        postcode: '2160',
        latitude: -33.8360,
        longitude: 150.9880,
        is_main_centre: 0,
        notes: 'Wednesday Spin & Win venue'
      }
    ];
    
    const placeholders = venues.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = venues.flatMap(venue => [
      venue.name,
      venue.address,
      venue.suburb,
      venue.state,
      venue.postcode,
      venue.latitude,
      venue.longitude,
      venue.is_main_centre,
      venue.notes
    ]);
    
    db.run(
      `INSERT INTO venues (name, address, suburb, state, postcode, latitude, longitude, is_main_centre, notes) VALUES ${placeholders}`,
      values,
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        console.log(`Inserted ${venues.length} venues`);
        resolve();
      }
    );
  });
}

// Seed programs
function seedPrograms() {
  return new Promise((resolve, reject) => {
    console.log('Seeding programs...');
    
    // Get venue IDs
    db.all('SELECT id, name FROM venues', [], (err, venues) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Map venue names to IDs
      const venueMap = venues.reduce((map, venue) => {
        map[venue.name] = venue.id;
        return map;
      }, {});
      
      const programs = [
        {
          name: 'Centre-Based',
          description: 'Daily centre-based activities for participants',
          day_of_week: 1, // Monday
          start_time: '09:00',
          end_time: '15:00',
          is_weekend: 0,
          is_centre_based: 1,
          venue_id: venueMap['Green Valley Library'],
          active: 1
        },
        {
          name: 'Centre-Based',
          description: 'Daily centre-based activities for participants',
          day_of_week: 2, // Tuesday
          start_time: '09:00',
          end_time: '15:00',
          is_weekend: 0,
          is_centre_based: 1,
          venue_id: venueMap['Green Valley Library'],
          active: 1
        },
        {
          name: 'Centre-Based',
          description: 'Daily centre-based activities for participants',
          day_of_week: 3, // Wednesday
          start_time: '09:00',
          end_time: '15:00',
          is_weekend: 0,
          is_centre_based: 1,
          venue_id: venueMap['Green Valley Library'],
          active: 1
        },
        {
          name: 'Centre-Based',
          description: 'Daily centre-based activities for participants',
          day_of_week: 4, // Thursday
          start_time: '09:00',
          end_time: '15:00',
          is_weekend: 0,
          is_centre_based: 1,
          venue_id: venueMap['Green Valley Library'],
          active: 1
        },
        {
          name: 'Centre-Based',
          description: 'Daily centre-based activities for participants',
          day_of_week: 5, // Friday
          start_time: '09:00',
          end_time: '15:00',
          is_weekend: 0,
          is_centre_based: 1,
          venue_id: venueMap['Green Valley Library'],
          active: 1
        },
        {
          name: 'Bowling Night',
          description: 'Evening bowling activity at Wetherill Park',
          day_of_week: 2, // Tuesday
          start_time: '16:30',
          end_time: '20:30',
          is_weekend: 0,
          is_centre_based: 0,
          venue_id: venueMap['Bowlarama'],
          active: 1
        },
        {
          name: 'Spin & Win',
          description: 'Evening entertainment at Merrylands RSL',
          day_of_week: 3, // Wednesday
          start_time: '16:30',
          end_time: '20:30',
          is_weekend: 0,
          is_centre_based: 0,
          venue_id: venueMap['Merrylands RSL'],
          active: 1
        },
        {
          name: 'Sat Adventure',
          description: 'Weekend activity with varying venues',
          day_of_week: 6, // Saturday
          start_time: '08:30',
          end_time: '16:30',
          is_weekend: 1,
          is_centre_based: 0,
          venue_id: null, // Will be determined for each instance
          active: 1
        },
        {
          name: 'Sun Funday',
          description: 'Weekend activity with varying venues',
          day_of_week: 0, // Sunday
          start_time: '08:30',
          end_time: '15:30',
          is_weekend: 1,
          is_centre_based: 0,
          venue_id: null, // Will be determined for each instance
          active: 1
        }
      ];
      
      const placeholders = programs.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values = programs.flatMap(program => [
        program.name,
        program.description,
        program.day_of_week,
        program.start_time,
        program.end_time,
        program.is_weekend,
        program.is_centre_based,
        program.venue_id,
        program.active
      ]);
      
      db.run(
        `INSERT INTO programs (name, description, day_of_week, start_time, end_time, is_weekend, is_centre_based, venue_id, active) VALUES ${placeholders}`,
        values,
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          console.log(`Inserted ${programs.length} programs`);
          resolve();
        }
      );
    });
  });
}

// Seed participants
function seedParticipants() {
  return new Promise((resolve, reject) => {
    console.log('Seeding participants...');
    
    const participants = [
      {
        id: 1,
        first_name: 'John',
        last_name: 'Smith',
        address: '12 Valley Road',
        suburb: 'Green Valley',
        state: 'NSW',
        postcode: '2168',
        latitude: -33.9062,
        longitude: 150.8872,
        ndis_number: '430116724',
        is_plan_managed: 1
      },
      {
        id: 2,
        first_name: 'Sarah',
        last_name: 'Johnson',
        address: '45 Bonnyrigg Avenue',
        suburb: 'Bonnyrigg',
        state: 'NSW',
        postcode: '2177',
        latitude: -33.8865,
        longitude: 150.8765,
        ndis_number: '430116877',
        is_plan_managed: 0
      },
      {
        id: 3,
        first_name: 'Michael',
        last_name: 'Williams',
        address: '78 Fairfield Road',
        suburb: 'Fairfield',
        state: 'NSW',
        postcode: '2165',
        latitude: -33.8725,
        longitude: 150.9502,
        ndis_number: '430011248',
        is_plan_managed: 1
      },
      {
        id: 4,
        first_name: 'Emma',
        last_name: 'Brown',
        address: '23 Green Street',
        suburb: 'Green Valley',
        state: 'NSW',
        postcode: '2168',
        latitude: -33.9068,
        longitude: 150.8881,
        ndis_number: '430140621',
        is_plan_managed: 0
      },
      {
        id: 5,
        first_name: 'David',
        last_name: 'Jones',
        address: '56 Bonnyrigg Road',
        suburb: 'Bonnyrigg',
        state: 'NSW',
        postcode: '2177',
        latitude: -33.8871,
        longitude: 150.8749,
        ndis_number: '430164565',
        is_plan_managed: 1
      },
      {
        id: 6,
        first_name: 'Lisa',
        last_name: 'Taylor',
        address: '89 Fairfield Street',
        suburb: 'Fairfield',
        state: 'NSW',
        postcode: '2165',
        latitude: -33.8719,
        longitude: 150.9492,
        ndis_number: '430158760',
        is_plan_managed: 0
      },
      {
        id: 7,
        first_name: 'Robert',
        last_name: 'Wilson',
        address: '34 Valley Avenue',
        suburb: 'Green Valley',
        state: 'NSW',
        postcode: '2168',
        latitude: -33.9055,
        longitude: 150.8890,
        ndis_number: '430116450',
        is_plan_managed: 1
      },
      {
        id: 8,
        first_name: 'Jessica',
        last_name: 'Martin',
        address: '67 Bonnyrigg Street',
        suburb: 'Bonnyrigg',
        state: 'NSW',
        postcode: '2177',
        latitude: -33.8879,
        longitude: 150.8780,
        ndis_number: '430116446',
        is_plan_managed: 0
      },
      {
        id: 9,
        first_name: 'Thomas',
        last_name: 'Anderson',
        address: '90 Fairfield Avenue',
        suburb: 'Fairfield',
        state: 'NSW',
        postcode: '2165',
        latitude: -33.8738,
        longitude: 150.9511,
        ndis_number: '430135702',
        is_plan_managed: 1
      },
      {
        id: 10,
        first_name: 'Olivia',
        last_name: 'White',
        address: '45 Green Road',
        suburb: 'Green Valley',
        state: 'NSW',
        postcode: '2168',
        latitude: -33.9073,
        longitude: 150.8861,
        ndis_number: '430119951',
        is_plan_managed: 0
      }
    ];
    
    const placeholders = participants.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = participants.flatMap(p => [
      p.id,
      p.first_name,
      p.last_name,
      p.address,
      p.suburb,
      p.state,
      p.postcode,
      p.latitude,
      p.longitude,
      p.ndis_number,
      p.is_plan_managed
    ]);
    
    db.run(
      `INSERT INTO participants (id, first_name, last_name, address, suburb, state, postcode, latitude, longitude, ndis_number, is_plan_managed) VALUES ${placeholders}`,
      values,
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        console.log(`Inserted ${participants.length} participants`);
        resolve();
      }
    );
  });
}

// Seed staff
function seedStaff() {
  return new Promise((resolve, reject) => {
    console.log('Seeding staff...');
    
    const staff = [
      {
        id: 'S1',
        first_name: 'Alex',
        last_name: 'Johnson',
        address: '123 Staff Street',
        suburb: 'Liverpool',
        state: 'NSW',
        postcode: '2170',
        contracted_hours: 76
      },
      {
        id: 'S2',
        first_name: 'Morgan',
        last_name: 'Lee',
        address: '456 Support Road',
        suburb: 'Cabramatta',
        state: 'NSW',
        postcode: '2166',
        contracted_hours: 50
      },
      {
        id: 'S3',
        first_name: 'Jordan',
        last_name: 'Smith',
        address: '789 Helper Avenue',
        suburb: 'Fairfield',
        state: 'NSW',
        postcode: '2165',
        contracted_hours: 30
      },
      {
        id: 'S4',
        first_name: 'Casey',
        last_name: 'Brown',
        address: '101 Carer Lane',
        suburb: 'Liverpool',
        state: 'NSW',
        postcode: '2170',
        contracted_hours: 76
      },
      {
        id: 'S5',
        first_name: 'Taylor',
        last_name: 'Wilson',
        address: '202 Support Street',
        suburb: 'Cabramatta',
        state: 'NSW',
        postcode: '2166',
        contracted_hours: 50
      }
    ];
    
    // id, first_name, last_name, address, suburb, state, postcode, contracted_hours
    const placeholders = staff.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = staff.flatMap(staffMember => [
      staffMember.id,
      staffMember.first_name,
      staffMember.last_name,
      staffMember.address,
      staffMember.suburb,
      staffMember.state,
      staffMember.postcode,
      staffMember.contracted_hours
    ]);
    
    db.run(
      `INSERT INTO staff (id, first_name, last_name, address, suburb, state, postcode, contracted_hours) VALUES ${placeholders}`,
      values,
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        console.log(`Inserted ${staff.length} staff members`);
        
        // Now seed staff availability
        seedStaffAvailability()
          .then(resolve)
          .catch(reject);
      }
    );
  });
}

// Seed staff availability
function seedStaffAvailability() {
  return new Promise((resolve, reject) => {
    console.log('Seeding staff availability...');
    
    const staffIds = ['S1', 'S2', 'S3', 'S4', 'S5'];
    const availabilityEntries = [];
    
    // Create availability entries for each staff member
    staffIds.forEach(staffId => {
      // Weekday availability (Monday to Friday)
      for (let day = 1; day <= 5; day++) {
        availabilityEntries.push({
          staff_id: staffId,
          day_of_week: day,
          start_time: '08:00',
          end_time: '16:00'
        });
      }
      
      // Evening availability (Tuesday and Wednesday)
      availabilityEntries.push({
        staff_id: staffId,
        day_of_week: 2, // Tuesday
        start_time: '16:00',
        end_time: '21:00'
      });
      
      availabilityEntries.push({
        staff_id: staffId,
        day_of_week: 3, // Wednesday
        start_time: '16:00',
        end_time: '21:00'
      });
      
      // Weekend availability (varies by staff)
      if (['S1', 'S3', 'S5'].includes(staffId)) {
        availabilityEntries.push({
          staff_id: staffId,
          day_of_week: 6, // Saturday
          start_time: '08:00',
          end_time: '17:00'
        });
      }
      
      if (['S2', 'S4'].includes(staffId)) {
        availabilityEntries.push({
          staff_id: staffId,
          day_of_week: 0, // Sunday
          start_time: '08:00',
          end_time: '16:00'
        });
      }
    });
    
    const placeholders = availabilityEntries.map(() => '(?, ?, ?, ?)').join(', ');
    const values = availabilityEntries.flatMap(entry => [
      entry.staff_id,
      entry.day_of_week,
      entry.start_time,
      entry.end_time
    ]);
    
    db.run(
      `INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time) VALUES ${placeholders}`,
      values,
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        console.log(`Inserted ${availabilityEntries.length} staff availability entries`);
        resolve();
      }
    );
  });
}

// Seed vehicles
function seedVehicles() {
  return new Promise((resolve, reject) => {
    console.log('Seeding vehicles...');
    
    const vehicles = [
      {
        id: 'V1',
        description: 'Toyota HiAce 10-seater',
        seats: 10,
        registration: 'ABC123'
      },
      {
        id: 'V2',
        description: 'Toyota HiAce 10-seater',
        seats: 10,
        registration: 'DEF456'
      },
      {
        id: 'V3',
        description: 'Toyota Coaster 10-seater',
        seats: 10,
        registration: 'GHI789'
      },
      {
        id: 'V4',
        description: 'Toyota Coaster 10-seater',
        seats: 10,
        registration: 'JKL012'
      }
    ];
    
    const placeholders = vehicles.map(() => '(?, ?, ?, ?)').join(', ');
    const values = vehicles.flatMap(vehicle => [
      vehicle.id,
      vehicle.description,
      vehicle.seats,
      vehicle.registration
    ]);
    
    db.run(
      `INSERT INTO vehicles (id, description, seats, registration) VALUES ${placeholders}`,
      values,
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        console.log(`Inserted ${vehicles.length} vehicles`);
        resolve();
      }
    );
  });
}

// Seed rate line items
function seedRateLineItems() {
  return new Promise((resolve, reject) => {
    console.log('Seeding rate line items...');
    
    db.all('SELECT id, name FROM programs', [], (err, programs) => {
      if (err) {
        reject(err);
        return;
      }
      
      const lineItems = [];
      
      programs.forEach(program => {
        if (program.name === 'Centre-Based' || program.name === 'Sat Adventure' || program.name === 'Sun Funday') {
          lineItems.push({
            program_id: program.id,
            support_number: '04_104_0125_6_1',
            description: 'Community, Social and Recreational Activities',
            unit_price: 67.56
          });
          lineItems.push({
            program_id: program.id,
            support_number: '04_599_0136_6_1',
            description: 'Centre Capital Cost',
            unit_price: 2.53
          });
        }
        
        if (program.name === 'Bowling Night' || program.name === 'Spin & Win') {
          lineItems.push({
            program_id: program.id,
            support_number: '04_102_0136_6_1',
            description: 'Group Activities in the Community',
            unit_price: 33.78
          });
        }
        
        // Add NF2F for all programs
        lineItems.push({
          program_id: program.id,
          support_number: '04_102_0136_6_1_NF2F',
          description: 'Non-Face-to-Face Support Provision',
          unit_price: 10.73,
          in_kind_funding_program: 'NF2F'
        });
      });
      
      const placeholders = lineItems.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values = lineItems.flatMap(item => [
        item.program_id,
        item.support_number,
        item.description,
        item.unit_price,
        'P2',
        'Service',
        item.in_kind_funding_program || null
      ]);
      
      db.run(
        `INSERT INTO rate_line_items (program_id, support_number, description, unit_price, gst_code, claim_type, in_kind_funding_program) VALUES ${placeholders}`,
        values,
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          console.log(`Inserted ${lineItems.length} rate line items`);
          resolve();
        }
      );
    });
  });
}

// Seed settings
function seedSettings() {
  return new Promise((resolve, reject) => {
    console.log('Seeding settings...');
    
    db.serialize(() => {
      const stmt = db.prepare("UPDATE settings SET value = ? WHERE key = ?");
      stmt.run('4050004068', 'ndis_registration_number');
      stmt.run('42483016622', 'abn');
      stmt.finalize((err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('Updated settings');
        resolve();
      });
    });
  });
}

// Generate weekend activity using AI
async function generateWeekendActivity(day) {
  const dayName = day === 6 ? 'Saturday' : 'Sunday';
  
  // If OpenAI is available
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates creative activity ideas for disability support services.'
          },
          {
            role: 'user',
            content: `Generate a fun ${dayName} activity for a disability support service in Sydney, Australia. 
                     Format your response as a JSON object with two fields: 
                     "activity" (a brief title and description, max 100 characters) and 
                     "venue" (a specific location in Sydney where this could take place, include full address).`
          }
        ],
        temperature: 0.7
      });
      
      const content = response.choices[0].message.content;
      try {
        return JSON.parse(content);
      } catch (e) {
        console.error('Error parsing OpenAI response:', e);
        return fallbackWeekendActivity(day);
      }
    } catch (e) {
      console.error('Error calling OpenAI API:', e);
      return fallbackWeekendActivity(day);
    }
  } 
  // If Google Gemini is available
  else if (googleAI) {
    try {
      const model = googleAI.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent(`Generate a fun ${dayName} activity for a disability support service in Sydney, Australia. 
                                                Format your response as a JSON object with two fields: 
                                                "activity" (a brief title and description, max 100 characters) and 
                                                "venue" (a specific location in Sydney where this could take place, include full address).`);
      const content = result.response.text();
      try {
        // Extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        return fallbackWeekendActivity(day);
      } catch (e) {
        console.error('Error parsing Google AI response:', e);
        return fallbackWeekendActivity(day);
      }
    } catch (e) {
      console.error('Error calling Google AI API:', e);
      return fallbackWeekendActivity(day);
    }
  } 
  // Fallback if no AI service is available
  else {
    return fallbackWeekendActivity(day);
  }
}

// Fallback weekend activities if AI is not available
function fallbackWeekendActivity(day) {
  const satActivities = [
    {
      activity: 'Beach Day at Cronulla',
      venue: 'Cronulla Beach, 6 Ocean Grove Ave, Cronulla NSW 2230'
    },
    {
      activity: 'Sydney Aquarium Visit',
      venue: 'SEA LIFE Sydney Aquarium, 1-5 Wheat Rd, Sydney NSW 2000'
    },
    {
      activity: 'Picnic at Centennial Park',
      venue: 'Centennial Park, Oxford St, Centennial Park NSW 2021'
    },
    {
      activity: 'Wildlife Park Adventure',
      venue: 'Featherdale Wildlife Park, 217-229 Kildare Rd, Doonside NSW 2767'
    }
  ];
  
  const sunActivities = [
    {
      activity: 'Botanical Gardens Tour',
      venue: 'Royal Botanic Garden, Mrs Macquaries Rd, Sydney NSW 2000'
    },
    {
      activity: 'Museum Discovery Day',
      venue: 'Powerhouse Museum, 500 Harris St, Ultimo NSW 2007'
    },
    {
      activity: 'Ferry Ride & Picnic',
      venue: 'Circular Quay, 30 Pitt St, Sydney NSW 2000'
    },
    {
      activity: 'Bowling Fun Day',
      venue: 'AMF Bowling Liverpool, 2 Tindall St, Liverpool NSW 2170'
    }
  ];
  
  const activities = day === 6 ? satActivities : sunActivities;
  return activities[Math.floor(Math.random() * activities.length)];
}

// Seed program instances
function seedProgramInstances() {
  return new Promise(async (resolve, reject) => {
    console.log('Seeding program instances...');
    
    // Get all programs
    db.all('SELECT id, name, day_of_week, start_time, end_time, is_weekend, venue_id FROM programs', [], async (err, programs) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Get all venues
      db.all('SELECT id, name FROM venues', [], async (err, venues) => {
        if (err) {
          reject(err);
          return;
        }
        
        const venueMap = venues.reduce((map, venue) => {
          map[venue.name] = venue.id;
          return map;
        }, {});
        
        // Set start date to 8 weeks before current date
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (8 * 7));
        
        // Generate 16 weeks of program instances (8 past, 8 future)
        const programInstances = [];
        
        for (let week = 0; week < 16; week++) {
          for (const program of programs) {
            // Calculate the date for this program in this week
            const programDate = new Date(startDate);
            programDate.setDate(programDate.getDate() + (week * 7) + ((program.day_of_week - programDate.getDay() + 7) % 7));
            // Normalise to local midnight and format as YYYY-MM-DD in local time
            programDate.setHours(0, 0, 0, 0);
            const dateString = formatDateLocal(programDate);
            
            // For weekend programs, generate a unique activity and venue
            let activityDescription = null;
            let venueId = program.venue_id;
            
            if (program.is_weekend) {
              try {
                const weekendActivity = await generateWeekendActivity(program.day_of_week);
                activityDescription = weekendActivity.activity;
                
                // Check if we already have this venue in our database
                let venueExists = false;
                for (const venue of venues) {
                  if (venue.name === weekendActivity.venue.split(',')[0]) {
                    venueId = venue.id;
                    venueExists = true;
                    break;
                  }
                }
                
                // If venue doesn't exist, create a new one
                if (!venueExists) {
                  const venueParts = weekendActivity.venue.split(',');
                  const newVenue = {
                    name: venueParts[0],
                    address: venueParts.slice(1).join(',').trim(),
                    suburb: venueParts.length > 1 ? venueParts[venueParts.length - 2].trim() : 'Sydney',
                    state: 'NSW',
                    postcode: venueParts.length > 1 ? venueParts[venueParts.length - 1].trim().split(' ')[1] : '2000',
                    is_main_centre: 0,
                    notes: `Auto-generated venue for ${program.name}`
                  };
                  
                  // Insert the new venue
                  await new Promise((resolveVenue, rejectVenue) => {
                    db.run(
                      `INSERT INTO venues (name, address, suburb, state, postcode, is_main_centre, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                      [
                        newVenue.name,
                        newVenue.address,
                        newVenue.suburb,
                        newVenue.state,
                        newVenue.postcode,
                        newVenue.is_main_centre,
                        newVenue.notes
                      ],
                      function(err) {
                        if (err) {
                          rejectVenue(err);
                          return;
                        }
                        venueId = this.lastID;
                        resolveVenue();
                      }
                    );
                  });
                }
              } catch (e) {
                console.error(`Error generating weekend activity for ${dateString}:`, e);
                // Use default venue if there's an error
                venueId = venueMap['Green Valley Library'];
                activityDescription = program.day_of_week === 6 ? 'Saturday Adventure Activity' : 'Sunday Funday Activity';
              }
            }
            
            programInstances.push({
              program_id: program.id,
              date: dateString,
              start_time: program.start_time,
              end_time: program.end_time,
              venue_id: venueId,
              activity_description: activityDescription,
              notes: `Auto-generated instance for ${program.name} on ${dateString}`
            });
          }
        }
        
        // Insert program instances in batches to avoid SQLite limits
        const batchSize = 100;
        for (let i = 0; i < programInstances.length; i += batchSize) {
          const batch = programInstances.slice(i, i + batchSize);
          const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
          const values = batch.flatMap(instance => [
            instance.program_id,
            instance.date,
            instance.start_time,
            instance.end_time,
            instance.venue_id,
            instance.activity_description,
            instance.notes
          ]);
          
          await new Promise((resolveBatch, rejectBatch) => {
            db.run(
              `INSERT INTO program_instances (program_id, date, start_time, end_time, venue_id, activity_description, notes) VALUES ${placeholders}`,
              values,
              function(err) {
                if (err) {
                  rejectBatch(err);
                  return;
                }
                resolveBatch();
              }
            );
          });
        }
        
        console.log(`Inserted ${programInstances.length} program instances`);
        resolve();
      });
    });
  });
}

// Seed program enrollments
function seedEnrollments() {
  return new Promise((resolve, reject) => {
    console.log('Seeding program enrollments...');
    
    // Get all participants
    db.all('SELECT id FROM participants', [], (err, participants) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Get all programs
      db.all('SELECT id, name, day_of_week FROM programs', [], (err, programs) => {
        if (err) {
          reject(err);
          return;
        }
        
        const enrollments = [];
        
        // Set start date to 8 weeks before current date
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (8 * 7));
        const startDateString = startDate.toISOString().split('T')[0];
        
        // For each participant, create a stable, ongoing weekly schedule
        participants.forEach(participant => {
          programs.forEach(program => {
            let enrollmentChance = 0;
            if (program.name === 'Centre-Based') enrollmentChance = 0.8;
            else if (program.name === 'Bowling Night' || program.name === 'Spin & Win') enrollmentChance = 0.5;
            else if (program.name === 'Sat Adventure' || program.name === 'Sun Funday') enrollmentChance = 0.4;
            
            if (Math.random() < enrollmentChance) {
              enrollments.push({
                participant_id: participant.id,
                program_id: program.id,
                start_date: startDateString,
                end_date: null // Ongoing enrollment
              });
            }
          });
        });
        
        const placeholders = enrollments.map(() => '(?, ?, ?, ?)').join(', ');
        const values = enrollments.flatMap(enrollment => [
          enrollment.participant_id,
          enrollment.program_id,
          enrollment.start_date,
          enrollment.end_date
        ]);
        
        db.run(
          `INSERT INTO program_enrollments (participant_id, program_id, start_date, end_date) VALUES ${placeholders}`,
          values,
          function(err) {
            if (err) {
              reject(err);
              return;
            }
            console.log(`Inserted ${enrollments.length} program enrollments`);
            
            // Now seed attendance records
            seedAttendance()
              .then(resolve)
              .catch(reject);
          }
        );
      });
    });
  });
}

// Seed attendance records
function seedAttendance() {
  return new Promise((resolve, reject) => {
    console.log('Seeding attendance records...');
    
    // Get all enrollments
    db.all(`
      SELECT 
        pe.participant_id, 
        pi.id AS program_instance_id,
        pi.date,
        p.name AS program_name
      FROM program_enrollments pe
      JOIN program_instances pi ON pe.program_id = pi.program_id
      JOIN programs p ON pe.program_id = p.id
      WHERE pi.date >= pe.start_date
      AND (pe.end_date IS NULL OR pi.date <= pe.end_date)
    `, [], (err, enrollments) => {
      if (err) {
        reject(err);
        return;
      }
      
      const attendanceRecords = [];
      
      enrollments.forEach(enrollment => {
        // Create a 'confirmed' attendance record for every enrolled instance
        // to ensure consistent weekly schedules for the demo.
        attendanceRecords.push({
          participant_id: enrollment.participant_id,
          program_instance_id: enrollment.program_instance_id,
          status: 'confirmed',
          pickup_required: Math.random() < 0.8, // 80% chance of needing pickup
          dropoff_required: Math.random() < 0.8, // 80% chance of needing dropoff
          notes: ''
        });
      });
      
      // Insert attendance records in batches to avoid SQLite limits
      const batchSize = 100;
      let completedBatches = 0;
      const totalBatches = Math.ceil(attendanceRecords.length / batchSize);
      
      if (totalBatches === 0) {
        console.log('No attendance records to insert');
        return generateStaffAndVehicleAssignments().then(resolve).catch(reject);
      }
      
      for (let i = 0; i < attendanceRecords.length; i += batchSize) {
        const batch = attendanceRecords.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const values = batch.flatMap(record => [
          record.participant_id,
          record.program_instance_id,
          record.status,
          record.pickup_required ? 1 : 0,
          record.dropoff_required ? 1 : 0,
          record.notes
        ]);
        
        db.run(
          `INSERT INTO attendance (participant_id, program_instance_id, status, pickup_required, dropoff_required, notes) VALUES ${placeholders}`,
          values,
          function(err) {
            if (err) {
              reject(err);
              return;
            }
            
            completedBatches++;
            if (completedBatches === totalBatches) {
              console.log(`Inserted ${attendanceRecords.length} attendance records`);
              
              // After all attendance records are created, generate staff and vehicle assignments
              generateStaffAndVehicleAssignments()
                .then(resolve)
                .catch(reject);
            }
          }
        );
      }
    });
  });
}

// Generate staff and vehicle assignments based on attendance
function generateStaffAndVehicleAssignments() {
  return new Promise((resolve, reject) => {
    console.log('Generating staff and vehicle assignments...');
    
    // Get all program instances with at least one confirmed attendance
    db.all(`
      SELECT 
        pi.id AS program_instance_id,
        pi.date,
        pi.start_time,
        pi.end_time,
        p.name AS program_name,
        p.day_of_week,
        v.id AS venue_id,
        v.name AS venue_name,
        v.address AS venue_address,
        v.suburb AS venue_suburb,
        v.postcode AS venue_postcode,
        COUNT(CASE WHEN a.status = 'confirmed' THEN 1 ELSE NULL END) AS confirmed_count
      FROM program_instances pi
      JOIN programs p ON pi.program_id = p.id
      JOIN venues v ON pi.venue_id = v.id
      LEFT JOIN attendance a ON pi.id = a.program_instance_id AND a.status = 'confirmed'
      GROUP BY pi.id
      HAVING confirmed_count > 0
      ORDER BY pi.date, pi.start_time
    `, [], async (err, programInstances) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Get all staff with their availability
      db.all(`
        SELECT 
          s.id AS staff_id,
          s.first_name,
          s.last_name,
          sa.day_of_week,
          sa.start_time,
          sa.end_time
        FROM staff s
        JOIN staff_availability sa ON s.id = sa.staff_id
      `, [], async (err, staffAvailability) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Get all vehicles
        db.all('SELECT id, seats FROM vehicles', [], async (err, vehicles) => {
          if (err) {
            reject(err);
            return;
          }
          
          for (const instance of programInstances) {
            try {
              // Get participants for this program instance who need pickup/dropoff
              const participants = await new Promise((resolveQuery, rejectQuery) => {
                db.all(`
                  SELECT 
                    p.id AS participant_id,
                    p.first_name,
                    p.last_name,
                    p.address,
                    p.suburb,
                    p.postcode,
                    a.pickup_required,
                    a.dropoff_required
                  FROM attendance a
                  JOIN participants p ON a.participant_id = p.id
                  WHERE a.program_instance_id = ? AND a.status = 'confirmed'
                  ORDER BY p.suburb, p.address
                `, [instance.program_instance_id], (err, results) => {
                  if (err) {
                    rejectQuery(err);
                    return;
                  }
                  resolveQuery(results);
                });
              });
              
              // Calculate required staff based on participant count
              const requiredStaffCount = Math.ceil(participants.length / 4);
              
              // Find available staff for this day and time
              const availableStaff = staffAvailability.filter(sa => {
                return sa.day_of_week === instance.day_of_week && 
                       sa.start_time <= instance.start_time && 
                       sa.end_time >= instance.end_time;
              });
              
              // Group by staff_id to get unique staff members
              const uniqueStaffIds = [...new Set(availableStaff.map(sa => sa.staff_id))];
              
              // Assign staff to the program instance
              const assignedStaff = uniqueStaffIds.slice(0, requiredStaffCount);
              
              // If we don't have enough staff, log a warning
              if (assignedStaff.length < requiredStaffCount) {
                console.warn(`Warning: Not enough staff available for program instance ${instance.program_instance_id} on ${instance.date}`);
              }
              
              // Insert staff assignments
              for (let i = 0; i < assignedStaff.length; i++) {
                const staffId = assignedStaff[i];
                const role = i === 0 ? 'lead' : 'support';
                
                await new Promise((resolveInsert, rejectInsert) => {
                  db.run(
                    `INSERT INTO staff_assignments (staff_id, program_instance_id, role, notes) VALUES (?, ?, ?, ?)`,
                    [staffId, instance.program_instance_id, role, `Auto-assigned ${role}`],
                    function(err) {
                      if (err) {
                        rejectInsert(err);
                        return;
                      }
                      resolveInsert();
                    }
                  );
                });
              }
              
              // Calculate required vehicles based on participant count
              // Preferred load pattern: 1 staff + 4 participants per bus
              const participantsNeedingTransport = participants.filter(p => p.pickup_required || p.dropoff_required);
              const requiredVehicleCount = Math.ceil(participantsNeedingTransport.length / 4);
              
              // Assign vehicles to the program instance
              const assignedVehicles = vehicles.slice(0, requiredVehicleCount);
              
              // If we don't have enough vehicles, log a warning
              if (assignedVehicles.length < requiredVehicleCount) {
                console.warn(`Warning: Not enough vehicles available for program instance ${instance.program_instance_id} on ${instance.date}`);
              }
              
              // Insert vehicle assignments and create routes
              for (let i = 0; i < assignedVehicles.length; i++) {
                const vehicleId = assignedVehicles[i].id;
                const driverStaffId = i < assignedStaff.length ? assignedStaff[i] : null;
                
                // Insert vehicle assignment
                const vehicleAssignmentId = await new Promise((resolveInsert, rejectInsert) => {
                  db.run(
                    `INSERT INTO vehicle_assignments (vehicle_id, program_instance_id, driver_staff_id, notes) VALUES (?, ?, ?, ?)`,
                    [vehicleId, instance.program_instance_id, driverStaffId, `Auto-assigned vehicle`],
                    function(err) {
                      if (err) {
                        rejectInsert(err);
                        return;
                      }
                      resolveInsert(this.lastID);
                    }
                  );
                });
                
                // Assign participants to this vehicle (simple round-robin)
                const vehicleParticipants = participantsNeedingTransport.filter((_, index) => index % assignedVehicles.length === i);
                
                // Create pickup route
                if (vehicleParticipants.some(p => p.pickup_required)) {
                  const pickupRouteId = await new Promise((resolveInsert, rejectInsert) => {
                    db.run(
                      `INSERT INTO routes (vehicle_assignment_id, route_type, estimated_duration, estimated_distance) VALUES (?, ?, ?, ?)`,
                      [vehicleAssignmentId, 'pickup', 60, 15.0], // Placeholder values
                      function(err) {
                        if (err) {
                          rejectInsert(err);
                          return;
                        }
                        resolveInsert(this.lastID);
                      }
                    );
                  });
                  
                  // Add route stops for pickup
                  const pickupParticipants = vehicleParticipants.filter(p => p.pickup_required);
                  for (let j = 0; j < pickupParticipants.length; j++) {
                    const participant = pickupParticipants[j];
                    await new Promise((resolveInsert, rejectInsert) => {
                      db.run(
                        `INSERT INTO route_stops (route_id, stop_order, participant_id, address, suburb, postcode, estimated_arrival_time) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                          pickupRouteId, 
                          j + 1, 
                          participant.participant_id,
                          participant.address,
                          participant.suburb,
                          participant.postcode,
                          '08:00' // Placeholder time
                        ],
                        function(err) {
                          if (err) {
                            rejectInsert(err);
                            return;
                          }
                          resolveInsert();
                        }
                      );
                    });
                  }
                  
                  // Add final stop (venue)
                  await new Promise((resolveInsert, rejectInsert) => {
                    db.run(
                      `INSERT INTO route_stops (route_id, stop_order, venue_id, address, suburb, postcode, estimated_arrival_time) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                      [
                        pickupRouteId, 
                        pickupParticipants.length + 1, 
                        instance.venue_id,
                        instance.venue_address,
                        instance.venue_suburb,
                        instance.venue_postcode,
                        instance.start_time
                      ],
                      function(err) {
                        if (err) {
                          rejectInsert(err);
                          return;
                        }
                        resolveInsert();
                      }
                    );
                  });
                }
                
                // Create dropoff route
                if (vehicleParticipants.some(p => p.dropoff_required)) {
                  const dropoffRouteId = await new Promise((resolveInsert, rejectInsert) => {
                    db.run(
                      `INSERT INTO routes (vehicle_assignment_id, route_type, estimated_duration, estimated_distance) VALUES (?, ?, ?, ?)`,
                      [vehicleAssignmentId, 'dropoff', 60, 15.0], // Placeholder values
                      function(err) {
                        if (err) {
                          rejectInsert(err);
                          return;
                        }
                        resolveInsert(this.lastID);
                      }
                    );
                  });
                  
                  // Add first stop (venue)
                  await new Promise((resolveInsert, rejectInsert) => {
                    db.run(
                      `INSERT INTO route_stops (route_id, stop_order, venue_id, address, suburb, postcode, estimated_arrival_time) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                      [
                        dropoffRouteId, 
                        1, 
                        instance.venue_id,
                        instance.venue_address,
                        instance.venue_suburb,
                        instance.venue_postcode,
                        instance.end_time
                      ],
                      function(err) {
                        if (err) {
                          rejectInsert(err);
                          return;
                        }
                        resolveInsert();
                      }
                    );
                  });
                  
                  // Add route stops for dropoff
                  const dropoffParticipants = vehicleParticipants.filter(p => p.dropoff_required);
                  for (let j = 0; j < dropoffParticipants.length; j++) {
                    const participant = dropoffParticipants[j];
                    await new Promise((resolveInsert, rejectInsert) => {
                      db.run(
                        `INSERT INTO route_stops (route_id, stop_order, participant_id, address, suburb, postcode, estimated_arrival_time) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                          dropoffRouteId, 
                          j + 2, 
                          participant.participant_id,
                          participant.address,
                          participant.suburb,
                          participant.postcode,
                          '15:30' // Placeholder time
                        ],
                        function(err) {
                          if (err) {
                            rejectInsert(err);
                            return;
                          }
                          resolveInsert();
                        }
                      );
                    });
                  }
                }
              }
              
            } catch (e) {
              console.error(`Error processing program instance ${instance.program_instance_id}:`, e);
            }
          }
          
          console.log(`Generated staff and vehicle assignments for ${programInstances.length} program instances`);
          resolve();
        });
      });
    });
  });
}

// Export the database connection for use in other modules
module.exports.runSeed = runSeed;

// ---------------------------------------------------------------------------
// If this script is run directly (`node database/seed.js`) execute runSeed().
// When imported (e.g., via an admin endpoint) the caller can invoke runSeed()
// manually without side-effects.
// ---------------------------------------------------------------------------
if (require.main === module) {
  runSeed();
}
