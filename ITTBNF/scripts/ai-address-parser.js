/**
 * AI-powered Address Parser for Australian Addresses
 * 
 * This module uses OpenAI API to parse Australian addresses into structured components.
 * It provides both single address parsing and batch processing capabilities with caching
 * to improve performance and reduce API calls.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CACHE_FILE = path.resolve(__dirname, '../data/address-cache.json');
const POSTCODE_CACHE_FILE = path.resolve(__dirname, '../data/postcode-cache.json');
const MODEL = 'gpt-3.5-turbo'; // Using 3.5 for cost efficiency, can upgrade to 4 if needed
const MAX_BATCH_SIZE = 20; // Maximum addresses to send in a single API call
const DEFAULT_STATE = 'NSW';

// Console colors for better logging
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Logger utility for consistent output formatting
 */
const logger = {
  info: (message) => console.log(`${colors.blue}[AI-PARSER INFO]${colors.reset} ${message}`),
  success: (message) => console.log(`${colors.green}[AI-PARSER SUCCESS]${colors.reset} ${message}`),
  warning: (message) => console.log(`${colors.yellow}[AI-PARSER WARNING]${colors.reset} ${message}`),
  error: (message) => console.error(`${colors.red}[AI-PARSER ERROR]${colors.reset} ${message}`),
  debug: (message, verbose = false) => {
    if (verbose) {
      console.log(`${colors.cyan}[AI-PARSER DEBUG]${colors.reset} ${message}`);
    }
  }
};

// Address cache to avoid redundant API calls
let addressCache = {};

// Postcode cache for suburb -> postcode mapping
let postcodeCache = {};

// Statistics tracking
const stats = {
  addressesParsed: 0,
  cacheHits: 0,
  cacheMisses: 0,
  apiCalls: 0,
  parseErrors: 0,
  postcodesCompleted: 0,
  postcodeCompletionErrors: 0
};

/**
 * Load address cache from file if it exists
 */
function loadAddressCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cacheData = fs.readFileSync(CACHE_FILE, 'utf8');
      addressCache = JSON.parse(cacheData);
      logger.info(`Loaded ${Object.keys(addressCache).length} cached addresses`);
    } else {
      logger.info('No address cache found, starting with empty cache');
      addressCache = {};
    }
  } catch (error) {
    logger.warning(`Failed to load address cache: ${error.message}`);
    addressCache = {};
  }
}

/**
 * Load postcode cache from file if it exists
 */
function loadPostcodeCache() {
  try {
    if (fs.existsSync(POSTCODE_CACHE_FILE)) {
      const cacheData = fs.readFileSync(POSTCODE_CACHE_FILE, 'utf8');
      postcodeCache = JSON.parse(cacheData);
      logger.info(`Loaded ${Object.keys(postcodeCache).length} cached suburb postcodes`);
    } else {
      logger.info('No postcode cache found, starting with empty cache');
      postcodeCache = {};
    }
  } catch (error) {
    logger.warning(`Failed to load postcode cache: ${error.message}`);
    postcodeCache = {};
  }
}

/**
 * Save address cache to file
 */
function saveAddressCache() {
  try {
    // Ensure the directory exists
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(CACHE_FILE, JSON.stringify(addressCache, null, 2));
    logger.success(`Saved ${Object.keys(addressCache).length} addresses to cache`);
  } catch (error) {
    logger.error(`Failed to save address cache: ${error.message}`);
  }
}

/**
 * Save postcode cache to file
 */
function savePostcodeCache() {
  try {
    // Ensure the directory exists
    const dir = path.dirname(POSTCODE_CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(POSTCODE_CACHE_FILE, JSON.stringify(postcodeCache, null, 2));
    logger.success(`Saved ${Object.keys(postcodeCache).length} suburb postcodes to cache`);
  } catch (error) {
    logger.error(`Failed to save postcode cache: ${error.message}`);
  }
}

/**
 * Get cached address or null if not in cache
 * @param {string} rawAddress - Original address string
 * @returns {Object|null} Parsed address or null if not in cache
 */
function getCachedAddress(rawAddress) {
  if (!rawAddress) return null;
  
  const normalizedAddress = normalizeAddressForCache(rawAddress);
  return addressCache[normalizedAddress] || null;
}

/**
 * Add parsed address to cache
 * @param {string} rawAddress - Original address string
 * @param {Object} parsedAddress - Parsed address components
 */
function cacheAddress(rawAddress, parsedAddress) {
  if (!rawAddress || !parsedAddress) return;
  
  const normalizedAddress = normalizeAddressForCache(rawAddress);
  addressCache[normalizedAddress] = parsedAddress;
}

/**
 * Get cached postcode for suburb or null if not in cache
 * @param {string} suburb - Suburb name
 * @returns {string|null} Postcode or null if not in cache
 */
function getCachedPostcode(suburb) {
  if (!suburb) return null;
  
  const normalizedSuburb = normalizeSuburbForCache(suburb);
  return postcodeCache[normalizedSuburb] || null;
}

/**
 * Add suburb postcode to cache
 * @param {string} suburb - Suburb name
 * @param {string} postcode - Postcode
 */
function cachePostcode(suburb, postcode) {
  if (!suburb || !postcode) return;
  
  const normalizedSuburb = normalizeSuburbForCache(suburb);
  postcodeCache[normalizedSuburb] = postcode;
}

/**
 * Normalize address for consistent cache keys
 * @param {string} address - Address to normalize
 * @returns {string} Normalized address
 */
function normalizeAddressForCache(address) {
  if (!address) return '';
  
  // Remove extra spaces, commas, and convert to lowercase
  return address.trim()
    .replace(/\s+/g, ' ')
    .replace(/,\s*/g, ',')
    .toLowerCase();
}

/**
 * Normalize suburb name for consistent cache keys
 * @param {string} suburb - Suburb to normalize
 * @returns {string} Normalized suburb
 */
function normalizeSuburbForCache(suburb) {
  if (!suburb) return '';
  
  // Remove extra spaces and convert to lowercase
  return suburb.trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Complete missing postcodes for addresses with known suburbs
 * @param {Array<Object>} addresses - Array of parsed addresses with missing postcodes
 * @param {Object} options - Options for postcode completion
 * @returns {Promise<Array<Object>>} Array of addresses with completed postcodes
 */
async function completePostcodes(addresses, options = {}) {
  const { verbose = false } = options;
  
  // Filter addresses that have suburbs but missing postcodes
  const addressesNeedingPostcodes = addresses.filter(addr => 
    addr.suburb && !addr.postcode
  );
  
  if (addressesNeedingPostcodes.length === 0) {
    logger.debug('No addresses need postcode completion', verbose);
    return addresses;
  }
  
  logger.info(`Completing postcodes for ${addressesNeedingPostcodes.length} addresses`);
  
  // Extract unique suburbs for postcode lookup
  const uniqueSuburbs = [...new Set(
    addressesNeedingPostcodes.map(addr => addr.suburb)
  )];
  
  // Filter out suburbs already in cache
  const suburbsToLookup = uniqueSuburbs.filter(suburb => !getCachedPostcode(suburb));
  
  // If all suburbs are in cache, use cached postcodes
  if (suburbsToLookup.length === 0) {
    logger.success('All suburbs found in postcode cache');
    
    // Apply cached postcodes to addresses
    return addresses.map(addr => {
      if (addr.suburb && !addr.postcode) {
        const cachedPostcode = getCachedPostcode(addr.suburb);
        if (cachedPostcode) {
          stats.postcodesCompleted++;
          return { ...addr, postcode: cachedPostcode };
        }
      }
      return addr;
    });
  }
  
  // Lookup postcodes for suburbs not in cache
  const completedPostcodes = await completePostcodesForSuburbs(suburbsToLookup, options);
  
  // Update addresses with completed postcodes
  return addresses.map(addr => {
    if (addr.suburb && !addr.postcode) {
      const postcode = getCachedPostcode(addr.suburb);
      if (postcode) {
        stats.postcodesCompleted++;
        return { ...addr, postcode };
      }
    }
    return addr;
  });
}

/**
 * Complete postcodes for a list of suburbs
 * @param {Array<string>} suburbs - Array of suburb names
 * @param {Object} options - Options for postcode completion
 * @returns {Promise<Object>} Map of suburb to postcode
 */
async function completePostcodesForSuburbs(suburbs, options = {}) {
  const { verbose = false } = options;
  
  if (!suburbs || suburbs.length === 0) {
    return {};
  }
  
  logger.info(`Looking up postcodes for ${suburbs.length} suburbs`);
  
  // Process in batches for efficiency
  const results = {};
  for (let i = 0; i < suburbs.length; i += MAX_BATCH_SIZE) {
    const batch = suburbs.slice(i, i + MAX_BATCH_SIZE);
    logger.debug(`Processing suburb batch ${Math.floor(i/MAX_BATCH_SIZE) + 1}: ${batch.length} suburbs`, verbose);
    
    try {
      const batchPrompt = batch.join(', ');
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: MODEL,
          messages: [
            {
              role: 'system',
              content: `You are an Australian postal code expert specializing in NSW suburbs and postcodes.
For each suburb in the list, provide the correct NSW postcode.

Rules:
- Return ONLY a valid JSON object with suburb names as keys and postcodes as values
- If you're unsure of a postcode, set the value to null (don't guess)
- Return postcodes as strings (e.g., "2000" not 2000)
- Be accurate - it's better to return null than provide an incorrect postcode
- Normalize suburb names to proper case (e.g., "fairfield east" -> "Fairfield East")
- Return the JSON object with no additional text`
            },
            {
              role: 'user',
              content: `Please provide postcodes for these NSW suburbs: ${batchPrompt}`
            }
          ],
          temperature: 0.1 // Low temperature for consistent results
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          }
        }
      );
      
      stats.apiCalls++;
      
      // Extract and validate the response
      const content = response.data.choices[0].message.content;
      let parsedResults;
      
      try {
        // Extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResults = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON found in response');
        }
      } catch (jsonError) {
        logger.warning(`Failed to parse JSON from OpenAI response: ${jsonError.message}`);
        logger.debug(`Raw response: ${content}`, verbose);
        stats.postcodeCompletionErrors++;
        continue;
      }
      
      // Process results and add to cache
      Object.entries(parsedResults).forEach(([suburb, postcode]) => {
        if (postcode && typeof postcode === 'string' && /^\d{4}$/.test(postcode)) {
          results[suburb] = postcode;
          cachePostcode(suburb, postcode);
        }
      });
      
    } catch (error) {
      logger.error(`Postcode lookup error: ${error.message}`);
      stats.postcodeCompletionErrors++;
    }
    
    // Add a small delay between batches
    if (i + MAX_BATCH_SIZE < suburbs.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  logger.success(`Completed postcode lookup for ${Object.keys(results).length} suburbs`);
  return results;
}

/**
 * Parse a single Australian address using OpenAI API
 * @param {string} address - Address to parse
 * @param {Object} options - Options for parsing
 * @returns {Promise<Object>} Parsed address components
 */
async function parseAddress(address, options = {}) {
  const { 
    verbose = false, 
    skipCache = false,
    completePostcode = true 
  } = options;
  
  if (!address) {
    return {
      address: null,
      suburb: null,
      state: DEFAULT_STATE,
      postcode: null
    };
  }
  
  // Check cache first unless skipCache is true
  if (!skipCache) {
    const cachedResult = getCachedAddress(address);
    if (cachedResult) {
      stats.cacheHits++;
      logger.debug(`Using cached result for: ${address}`, verbose);
      
      // If postcode is missing but we have the suburb, try to complete it
      if (completePostcode && cachedResult.suburb && !cachedResult.postcode) {
        const cachedPostcode = getCachedPostcode(cachedResult.suburb);
        if (cachedPostcode) {
          stats.postcodesCompleted++;
          return { ...cachedResult, postcode: cachedPostcode };
        }
      }
      
      return cachedResult;
    }
  }
  
  stats.cacheMisses++;
  
  try {
    logger.debug(`Parsing address with OpenAI: ${address}`, verbose);
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `You are an Australian address parsing expert. Extract the following components from the given address:
1. Street address (number and street name)
2. Suburb name
3. State abbreviation (NSW, VIC, QLD, etc.)
4. Postcode (4 digits)

Rules:
- Return ONLY a valid JSON object with keys: address, suburb, state, postcode
- If a component is missing, set its value to null
- For state, use standard Australian state/territory abbreviations
- Normalize suburb names to proper case (e.g., "fairfield east" -> "Fairfield East")
- Remove any trailing "Australia" from the address
- Do not include unit/apartment numbers in the suburb field
- Default state to "${DEFAULT_STATE}" if not specified
- If postcode is missing but you know it for the suburb, include it
- If postcode is missing and you're unsure, set it to null (do not guess)
- Handle various address formats including those with or without commas`
          },
          {
            role: 'user',
            content: address
          }
        ],
        temperature: 0.1 // Low temperature for consistent results
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );
    
    stats.apiCalls++;
    stats.addressesParsed++;
    
    // Extract and validate the response
    const content = response.data.choices[0].message.content;
    let parsedResult;
    
    try {
      // Extract JSON from the response (in case there's any extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON found in response');
      }
    } catch (jsonError) {
      logger.warning(`Failed to parse JSON from OpenAI response: ${jsonError.message}`);
      logger.debug(`Raw response: ${content}`, verbose);
      stats.parseErrors++;
      throw new Error('Invalid response format from OpenAI');
    }
    
    // Validate the parsed result
    if (!parsedResult || typeof parsedResult !== 'object') {
      stats.parseErrors++;
      throw new Error('Invalid response format from OpenAI');
    }
    
    // Ensure all required fields are present
    const result = {
      address: parsedResult.address || null,
      suburb: parsedResult.suburb || null,
      state: parsedResult.state || DEFAULT_STATE,
      postcode: parsedResult.postcode || null
    };
    
    // If we have a suburb and postcode, add to postcode cache
    if (result.suburb && result.postcode) {
      cachePostcode(result.suburb, result.postcode);
    }
    
    // Cache the result
    cacheAddress(address, result);
    
    // If postcode is missing but we have the suburb, try to complete it
    if (completePostcode && result.suburb && !result.postcode) {
      const cachedPostcode = getCachedPostcode(result.suburb);
      if (cachedPostcode) {
        stats.postcodesCompleted++;
        return { ...result, postcode: cachedPostcode };
      }
    }
    
    return result;
  } catch (error) {
    logger.error(`OpenAI API error: ${error.message}`);
    stats.parseErrors++;
    
    // Return a fallback result with the original address
    return {
      address: address,
      suburb: null,
      state: DEFAULT_STATE,
      postcode: null
    };
  }
}

/**
 * Parse multiple addresses in batch for efficiency
 * @param {Array<string>} addresses - Array of addresses to parse
 * @param {Object} options - Options for parsing
 * @returns {Promise<Array<Object>>} Array of parsed address objects
 */
async function parseAddressBatch(addresses, options = {}) {
  const { 
    verbose = false, 
    skipCache = false,
    completePostcode = true 
  } = options;
  
  if (!addresses || !addresses.length) {
    return [];
  }
  
  logger.info(`Batch parsing ${addresses.length} addresses`);
  
  // Filter out addresses that are already in cache (unless skipCache is true)
  let addressesToProcess = addresses;
  if (!skipCache) {
    addressesToProcess = addresses.filter(addr => !getCachedAddress(addr));
    logger.debug(`After cache check: ${addressesToProcess.length} addresses to process`, verbose);
  }
  
  // If all addresses were in cache, return cached results
  if (addressesToProcess.length === 0) {
    logger.success('All addresses found in cache');
    const cachedResults = addresses.map(addr => getCachedAddress(addr) || {
      address: addr,
      suburb: null,
      state: DEFAULT_STATE,
      postcode: null
    });
    
    stats.cacheHits += addresses.length;
    
    // If postcode completion is enabled, try to complete missing postcodes
    if (completePostcode) {
      return await completePostcodes(cachedResults, options);
    }
    
    return cachedResults;
  }
  
  stats.cacheMisses += addressesToProcess.length;
  
  // Process in batches of MAX_BATCH_SIZE
  const results = [];
  for (let i = 0; i < addressesToProcess.length; i += MAX_BATCH_SIZE) {
    const batch = addressesToProcess.slice(i, i + MAX_BATCH_SIZE);
    logger.debug(`Processing batch ${Math.floor(i/MAX_BATCH_SIZE) + 1}: ${batch.length} addresses`, verbose);
    
    try {
      const batchPrompt = batch.map((addr, index) => `Address ${index + 1}: ${addr}`).join('\n');
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: MODEL,
          messages: [
            {
              role: 'system',
              content: `You are an Australian address parsing expert. Parse each of the following addresses and extract these components:
1. Street address (number and street name)
2. Suburb name
3. State abbreviation (NSW, VIC, QLD, etc.)
4. Postcode (4 digits)

Rules:
- Return ONLY a valid JSON array with one object per address
- Each object should have keys: address, suburb, state, postcode
- If a component is missing, set its value to null
- For state, use standard Australian state/territory abbreviations
- Normalize suburb names to proper case (e.g., "fairfield east" -> "Fairfield East")
- Remove any trailing "Australia" from the address
- Do not include unit/apartment numbers in the suburb field
- Default state to "${DEFAULT_STATE}" if not specified
- If postcode is missing but you know it for the suburb, include it
- If postcode is missing and you're unsure, set it to null (do not guess)
- Maintain the same order as the input addresses
- Return the array in valid JSON format with no additional text`
            },
            {
              role: 'user',
              content: batchPrompt
            }
          ],
          temperature: 0.1 // Low temperature for consistent results
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          }
        }
      );
      
      stats.apiCalls++;
      stats.addressesParsed += batch.length;
      
      // Extract and validate the response
      const content = response.data.choices[0].message.content;
      let parsedResults;
      
      try {
        // Extract JSON array from the response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsedResults = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON array found in response');
        }
      } catch (jsonError) {
        logger.warning(`Failed to parse JSON from OpenAI response: ${jsonError.message}`);
        logger.debug(`Raw response: ${content}`, verbose);
        stats.parseErrors += batch.length;
        
        // Fall back to individual parsing
        logger.warning('Falling back to individual address parsing');
        const individualResults = await Promise.all(
          batch.map(addr => parseAddress(addr, options))
        );
        results.push(...individualResults);
        continue;
      }
      
      // Validate the parsed results
      if (!Array.isArray(parsedResults)) {
        stats.parseErrors += batch.length;
        throw new Error('Invalid response format from OpenAI (not an array)');
      }
      
      // Process each result and add to cache
      const processedResults = parsedResults.map((result, index) => {
        const normalizedResult = {
          address: result.address || null,
          suburb: result.suburb || null,
          state: result.state || DEFAULT_STATE,
          postcode: result.postcode || null
        };
        
        // If we have a suburb and postcode, add to postcode cache
        if (normalizedResult.suburb && normalizedResult.postcode) {
          cachePostcode(normalizedResult.suburb, normalizedResult.postcode);
        }
        
        // Cache the result
        cacheAddress(batch[index], normalizedResult);
        
        return normalizedResult;
      });
      
      results.push(...processedResults);
      
    } catch (error) {
      logger.error(`Batch processing error: ${error.message}`);
      stats.parseErrors += batch.length;
      
      // Fall back to individual parsing
      logger.warning('Falling back to individual address parsing');
      const individualResults = await Promise.all(
        batch.map(addr => parseAddress(addr, options))
      );
      results.push(...individualResults);
    }
    
    // Add a small delay between batches to avoid rate limiting
    if (i + MAX_BATCH_SIZE < addressesToProcess.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Map back to original order using cache
  const orderedResults = addresses.map(addr => {
    const cachedResult = getCachedAddress(addr);
    if (cachedResult) return cachedResult;
    
    // This should not happen, but just in case
    return {
      address: addr,
      suburb: null,
      state: DEFAULT_STATE,
      postcode: null
    };
  });
  
  // If postcode completion is enabled, try to complete missing postcodes
  if (completePostcode) {
    return await completePostcodes(orderedResults, options);
  }
  
  return orderedResults;
}

/**
 * Validate parsed address components
 * @param {Object} parsedAddress - Parsed address object
 * @returns {Object} Validation result {isValid, errors}
 */
function validateParsedAddress(parsedAddress) {
  const errors = [];
  
  if (!parsedAddress.address) {
    errors.push('Missing street address');
  }
  
  if (!parsedAddress.suburb) {
    errors.push('Missing suburb');
  }
  
  if (!parsedAddress.state) {
    errors.push('Missing state');
  } else {
    // Validate state abbreviation
    const validStates = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
    if (!validStates.includes(parsedAddress.state.toUpperCase())) {
      errors.push('Invalid state abbreviation');
    }
  }
  
  if (parsedAddress.postcode && !/^\d{4}$/.test(parsedAddress.postcode.toString())) {
    errors.push('Invalid postcode format (must be 4 digits)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get statistics about address parsing and postcode completion
 * @returns {Object} Statistics object
 */
function getStats() {
  return {
    ...stats,
    addressCacheSize: Object.keys(addressCache).length,
    postcodeCacheSize: Object.keys(postcodeCache).length
  };
}

/**
 * Reset statistics counters
 */
function resetStats() {
  Object.keys(stats).forEach(key => {
    stats[key] = 0;
  });
}

// Initialize by loading the caches
loadAddressCache();
loadPostcodeCache();

// Export functions
module.exports = {
  parseAddress,
  parseAddressBatch,
  completePostcodes,
  completePostcodesForSuburbs,
  validateParsedAddress,
  saveAddressCache,
  savePostcodeCache,
  loadAddressCache,
  loadPostcodeCache,
  getStats,
  resetStats
};
