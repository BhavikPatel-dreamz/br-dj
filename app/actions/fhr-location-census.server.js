import 'dotenv/config';
import mssql from "../mssql.server.js";

/**
 * Location Census Management Actions
 * Handles CRUD operations for location census data and budget calculations
 */

/**
 * Get all available locations from the company_location table
 * @returns {Promise<Array>} Array of company locations
 */
export async function getAvailableLocationsForCensus() {
  try {
    const locationQuery = `
      SELECT 
        CAST(id AS NVARCHAR(255)) as location_id,
        name as location_name
      FROM brdjdb.shopify.company_location
      WHERE id IS NOT NULL
      ORDER BY id ASC
    `;

    const locations = await mssql.query(locationQuery);

    return locations.map(location => ({
      location_id: location.location_id,
      location_name: location.location_name || `Location ${location.location_id}`
    }));
  } catch (error) {
    console.error("Error fetching available locations for census:", error);
    throw new Error(`Failed to fetch available locations: ${error.message}`);
  }
}

/**
 * Create or update location census data
 * @param {Object} censusData - Census data object
 * @param {string} censusData.locationId - Location ID
 * @param {string} censusData.censusMonth - Month in MM-YYYY format
 * @param {number} censusData.censusAmount - Census amount
 * @returns {Promise<Object>} Created or updated census record
 */
export async function createOrUpdateLocationCensus(censusData) {
  try {
    const {
      locationId,
      censusMonth,
      censusAmount
    } = censusData;

    // Check if record already exists
    const existingRecord = await getLocationCensusByLocationAndMonth(locationId, censusMonth);

    if (existingRecord) {
      // Update existing record
      const updateQuery = `
        UPDATE shopify.location_census
        SET 
          census_amount = @censusAmount
        WHERE location_id = @locationId AND census_month = @censusMonth
      `;

      await mssql.query(updateQuery, {
        locationId,
        censusMonth,
        censusAmount
      });

      return await getLocationCensusByLocationAndMonth(locationId, censusMonth);
    } else {
      // Create new record
      const insertQuery = `
        INSERT INTO shopify.location_census 
        (location_id, census_month, census_amount)
        VALUES (@locationId, @censusMonth, @censusAmount);
        
        SELECT * FROM shopify.location_census 
        WHERE location_id = @locationId AND census_month = @censusMonth;
      `;

      const result = await mssql.query(insertQuery, {
        locationId,
        censusMonth,
        censusAmount
      });

      return result[0];
    }
  } catch (error) {
    console.error("Error creating/updating location census:", error);
    throw new Error(`Failed to create/update location census: ${error.message}`);
  }
}

/**
 * Get location census by location and month
 * @param {string} locationId - Location ID
 * @param {string} censusMonth - Month in MM-YYYY format
 * @returns {Promise<Object|null>} Census record or null if not found
 */
export async function getLocationCensusByLocationAndMonth(locationId, censusMonth) {
  try {
    const query = `
      SELECT * FROM shopify.v_location_census
      WHERE location_id = @locationId AND census_month = @censusMonth
    `;

    const result = await mssql.query(query, { locationId, censusMonth });
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("Error fetching location census:", error);
    throw new Error(`Failed to fetch location census: ${error.message}`);
  }
}

/**
 * Get all location census records with optional filters
 * @param {Object} filters - Filter options
 * @param {string} filters.locationId - Location ID filter
 * @param {string} filters.month - Month filter (MM)
 * @param {string} filters.year - Year filter (YYYY)
 * @param {string} filters.status - Status filter
 * @returns {Promise<Array>} Array of census records
 */
export async function getAllLocationCensus(filters = {}) {
  try {
    let whereConditions = [];
    const params = {};

    if (filters.locationId) {
      whereConditions.push('location_id = @locationId');
      params.locationId = filters.locationId;
    }

    if (filters.month) {
      whereConditions.push('month_number = @month');
      params.month = filters.month.padStart(2, '0');
    }

    if (filters.year) {
      whereConditions.push('year_number = @year');
      params.year = filters.year;
    }

    if (filters.status) {
      whereConditions.push('status = @status');
      params.status = filters.status;
    }

    const whereClause = whereConditions.length > 0 ? 
      `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT * FROM shopify.v_location_census
      ${whereClause}
      ORDER BY year_number DESC, month_number DESC, location_id
    `;

    const result = await mssql.query(query, params);
    return result;
  } catch (error) {
    console.error("Error fetching all location census:", error);
    throw new Error(`Failed to fetch all location census: ${error.message}`);
  }
}

/**
 * Delete location census record
 * @param {string} locationId - Location ID
 * @param {string} censusMonth - Month in MM-YYYY format
 * @returns {Promise<boolean>} Success status
 */
export async function deleteLocationCensus(locationId, censusMonth) {
  try {
    const query = `
      DELETE FROM shopify.location_census
      WHERE location_id = @locationId AND census_month = @censusMonth
    `;

    await mssql.query(query, { locationId, censusMonth });
    return true;
  } catch (error) {
    console.error("Error deleting location census:", error);
    throw new Error(`Failed to delete location census: ${error.message}`);
  }
}


