import { json } from "@remix-run/node";
import fs from 'fs/promises';
import path from 'path';

import {
  validateShopifyProxyRequest,
  createSecureProxyResponse,
} from "../utils/shopify-security.server.js";
import { getMonthlyOrderProductsByCategoryWithRefundsByBudgetMonth } from "../actions/index.server.js";

// JSON Backup Storage Configuration
const BACKUP_BASE_DIR = path.join(process.cwd(), 'data', 'daily-backups');
const DAYS_TO_KEEP = 10;

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
  }
}

/**
 * Get file path for backup JSON
 * @param {string} todayDate - Today's date in YYYY-MM-DD format (when backup is created)
 * @param {string} locationId - Location ID
 * @param {string} searchMonth - Search month (MM)
 * @param {string} searchYear - Search year (YYYY)
 * @returns {object} Directory path and file path
 */
function getBackupFilePath(todayDate, locationId, searchMonth, searchYear) {
  const monthYear = `${searchMonth}-${searchYear}`;
  const dirPath = path.join(BACKUP_BASE_DIR, locationId, monthYear);
  const fileName = `${todayDate}.json`;
  return { dirPath, filePath: path.join(dirPath, fileName) };
}

/**
 * Check if backup file exists for a specific date and location
 * @param {string} todayDate - Today's date in YYYY-MM-DD format
 * @param {string} locationId - Location ID
 * @param {string} searchMonth - Search month (MM)
 * @param {string} searchYear - Search year (YYYY)
 * @returns {Promise<boolean>} True if file exists
 */
async function backupExists(todayDate, locationId, searchMonth, searchYear) {
  try {
    const { filePath } = getBackupFilePath(todayDate, locationId, searchMonth, searchYear);
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save backup JSON file
 * @param {string} todayDate - Today's date in YYYY-MM-DD format
 * @param {string} locationId - Location ID
 * @param {string} searchMonth - Search month (MM)
 * @param {string} searchYear - Search year (YYYY)
 * @param {object} data - Data to store
 * @returns {Promise<boolean>} Success status
 */
async function saveBackup(todayDate, locationId, searchMonth, searchYear, data) {
  try {
    const { dirPath, filePath } = getBackupFilePath(todayDate, locationId, searchMonth, searchYear);
    
    // Ensure directory exists
    await ensureDir(dirPath);
    
    // Prepare backup data with metadata
    const backupData = {
      metadata: {
        backupDate: todayDate,
        searchMonth: searchMonth,
        searchYear: searchYear,
        locationId,
        generatedAt: new Date().toISOString(),
        dataType: 'monthly-orders-by-category'
      },
      ...data
    };
    
    // Write file
    await fs.writeFile(filePath, JSON.stringify(backupData, null, 2), 'utf8');
    console.log(`✓ Backup saved: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`✗ Backup save failed for ${todayDate} - Location ${locationId}:`, error);
    return false;
  }
}

/**
 * Clean up old backup files (older than DAYS_TO_KEEP)
 * Runs asynchronously without blocking the response
 */
async function cleanOldBackups() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_KEEP);
    
    const baseExists = await fs.access(BACKUP_BASE_DIR).then(() => true).catch(() => false);
    if (!baseExists) return;
    
    let deletedCount = 0;
    const locations = await fs.readdir(BACKUP_BASE_DIR);
    
    // Iterate through locations
    for (const location of locations) {
      const locationPath = path.join(BACKUP_BASE_DIR, location);
      const locationStat = await fs.stat(locationPath);
      if (!locationStat.isDirectory()) continue;
      
      // Iterate through month-year folders (e.g., 10-2025, 11-2025)
      const monthYears = await fs.readdir(locationPath);
      
      for (const monthYear of monthYears) {
        const monthYearPath = path.join(locationPath, monthYear);
        const monthYearStat = await fs.stat(monthYearPath);
        if (!monthYearStat.isDirectory()) continue;
        
        // Iterate through backup files
        const files = await fs.readdir(monthYearPath);
        
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          
          const date = file.replace('.json', '');
          const fileDate = new Date(date);
          
          if (fileDate < cutoffDate) {
            const filePath = path.join(monthYearPath, file);
            await fs.unlink(filePath);
            deletedCount++;
          }
        }
        
        // Remove empty directories
        const remainingFiles = await fs.readdir(monthYearPath);
        if (remainingFiles.length === 0) {
          await fs.rmdir(monthYearPath);
        }
      }
    }
    
    if (deletedCount > 0) {
      console.log(`🗑️  Cleaned ${deletedCount} old backup files (keeping last ${DAYS_TO_KEEP} days)`);
    }
  } catch (error) {
    console.error('Error cleaning old backups:', error);
  }
}


/**
 * Secure API Route for Monthly Order Products by Category (with Refunds)
 * Supports both authenticated Shopify users and secure proxy access
 * Returns net quantities and values after subtracting refunds
 * 
 * AUTOMATIC BACKUP FEATURE:
 * - Automatically stores JSON responses in data/daily-backups/{year}/{month}/{locationId}/{date}.json
 * - Skips storage if backup file already exists for that day and location
 * - Maintains backups for the last 10 days (older files are automatically cleaned)
 * - Backup operations run asynchronously and don't block the API response
 * 
 * GET /api/monthly-orders-by-category
 *
 * Query Parameters:
 * - customerId: Customer ID to filter by
 * - locationId: Location ID to filter by
 * - companyLocationId: Company Location ID to filter by
 * - month: Month (01-12, defaults to current month)
 * - year: Year (YYYY, defaults to current year)
 * - signature: HMAC signature for proxy requests (optional for enhanced security)
 * - secure: Set to 'true' to require signature validation
 *
 * Response includes:
 * - categories: Array of product categories with net quantities/values
 * - summary: Total orders, refund metrics, net values
 * 
 * Backup File Structure:
 * data/daily-backups/
 *   ├── 2348220643/               (Location ID)
 *   │   ├── 10-2025/              (Search Month-Year)
 *   │   │   ├── 2025-11-01.json  (Backup created on Nov 1)
 *   │   │   ├── 2025-11-02.json  (Backup created on Nov 2)
 *   │   │   └── ...
 *   │   ├── 11-2025/
 *   │   │   └── ...
 */
export const loader = async ({ request }) => {
  try {
    console.log("Request received for /api/monthly-orders-by-category");
    const url = new URL(request.url);

    // Check if this is a Shopify proxy request (has signature parameter)
    const signature = url.searchParams.get("signature");
    const isShopifyProxyRequest = !!signature;

    // Also check for explicit secure mode
    const requireSecureAuth = isShopifyProxyRequest;

    let isAuthenticated = false;
    let shopifySession = null;
    let customerInfo = null;

    if (!requireSecureAuth && !signature) {
      return json(
        {
          success: false,
          error: "Secure mode is required for this endpoint",
          data: null,
        },
        { status: 400 }
      );
    }

    // Validate Shopify proxy signature if present

    const validation = validateShopifyProxyRequest(
      request,
      process.env.SHOPIFY_API_SECRET,
      true // Require customer login
    );

    if (!validation.isValid) {
      console.log(
        "Shopify proxy signature validation failed:",
        validation.error
      );
      // Return the prepared response if available
      if (validation.response) {
        return validation.response;
      }

      return createSecureProxyResponse(
        {
          success: false,
          error:
            validation.error ||
            "Invalid signature - secure authentication required",
          data: null,
        },
        { status: 403 }
      );
    }

    // Customer is authenticated and logged in
    customerInfo = validation.customerInfo;
    isAuthenticated = true;

    console.log("Authenticated Shopify proxy request with logged-in customer", {
      customerId: customerInfo?.customerId,
      shop: customerInfo?.shop || url.searchParams.get("shop"),
      isLoggedIn: customerInfo?.isLoggedIn,
    });

    // Parse query parameters
    const customerId = url.searchParams.get("customerId")?.trim() || "";
    const locationId = url.searchParams.get("locationId")?.trim() || "";
    const companyLocationId =
      url.searchParams.get("companyLocationId")?.trim() || "";
    const month = url.searchParams.get("month")?.trim() || "";
    const year = url.searchParams.get("year")?.trim() || "";

    // Validate that at least one filter is provided
    if (!customerId && !locationId && !companyLocationId) {
      return json(
        {
          success: false,
          error:
            "At least one filter parameter is required (customerId, locationId, or companyLocationId)",
          data: null,
        },
        { status: 400 }
      );
    }

    // Set default month/year to current if not provided
    const currentDate = new Date();
    const searchMonth =
      month || (currentDate.getMonth() + 1).toString().padStart(2, "0");
    const searchYear = year || currentDate.getFullYear().toString();

    // Validate month and year
    const monthNum = parseInt(searchMonth);
    const yearNum = parseInt(searchYear);

    if (monthNum < 1 || monthNum > 12) {
      return json(
        {
          success: false,
          error: "Invalid month. Must be between 01 and 12",
          data: null,
        },
        { status: 400 }
      );
    }

    if (yearNum < 2020 || yearNum > currentDate.getFullYear() + 1) {
      return json(
        {
          success: false,
          error: `Invalid year. Must be between 2020 and ${currentDate.getFullYear() + 1}`,
          data: null,
        },
        { status: 400 }
      );
    }

    // Build filters object
    const filters = {};
    if (customerId) filters.customerId = customerId;
    if (locationId) filters.locationId = locationId;
    if (companyLocationId) filters.companyLocationId = companyLocationId;

    // Add date filters
    filters.month = searchMonth;
    filters.year = searchYear;

    const result = await getMonthlyOrderProductsByCategoryWithRefundsByBudgetMonth(filters);

    const responseData = {
      success: true,
      error: null,
      data: {
        categories: result.categories || [],
        allProducts: result.allProducts || [],
        summary: {
          totalOrders: result.totalOrders || 0,
          ordersWithRefunds: result.ordersWithRefunds || 0,
          totalCategories: result.totalCategories || 0,
          grossValue: result.grossValue || 0,
          refundedValue: result.refundedValue || 0,
          totalValue: result.totalValue || 0, // Net value after refunds
          refundRate: result.refundRate || 0,
          month: searchMonth,
          year: searchYear,
          isAuthenticated: isAuthenticated,
          shopifyUser: isAuthenticated
            ? shopifySession?.shop || customerInfo?.shop || "authenticated"
            : null,
          customerInfo: requireSecureAuth
            ? {
                customerId: customerInfo?.customerId || null,
                isLoggedIn: customerInfo?.isLoggedIn || false,
              }
            : null,
          filters: {
            customerId: customerId || null,
            locationId: locationId || null,
            companyLocationId: companyLocationId || null,
          },
          secureMode: requireSecureAuth,
          refundAware: true, // Indicates this response includes refund calculations
        },
      },
    };

    // === BACKUP STORAGE FOR LAST 10 DAYS ===
    // Store JSON backup for location-based queries
    const locationForBackup = locationId || companyLocationId;
    if (locationForBackup) {
      // Use today's date as the backup filename
      const today = new Date();
      const todayDate = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      
      try {
        // Check if backup already exists for today's date, this location, and search month/year
        const exists = await backupExists(todayDate, locationForBackup, searchMonth, searchYear);
        
        if (!exists) {
          // Save backup asynchronously (don't wait for it)
          saveBackup(todayDate, locationForBackup, searchMonth, searchYear, responseData).catch(err => {
            console.error('Backup save error (non-blocking):', err);
          });
          console.log(`📦 Backup queued: ${locationForBackup}/${searchMonth}-${searchYear}/${todayDate}.json`);
        } else {
          console.log(`⏭️  Backup already exists: ${locationForBackup}/${searchMonth}-${searchYear}/${todayDate}.json, skipping`);
        }
        
        // Clean old backups asynchronously (don't wait for it)
        // Only run cleanup occasionally (10% chance) to avoid overhead
        if (Math.random() < 0.1) {
          cleanOldBackups().catch(err => {
            console.error('Cleanup error (non-blocking):', err);
          });
        }
      } catch (backupError) {
        // Log backup errors but don't fail the request
        console.error('Backup process error (non-blocking):', backupError);
      }
    }

    // Return secure response if secure authentication was used
    if (requireSecureAuth) {
      return createSecureProxyResponse(responseData);
    }

    // Standard JSON response for regular requests
    return json(responseData);
  } catch (error) {
    console.error("API Error - Monthly Orders by Category:", error);

    const errorResponse = {
      success: false,
      error:
        "Failed to fetch monthly order data by category with refunds. Please try again.",
      data: null,
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    };

    // Return secure error response if secure authentication was used
    if (url.searchParams.get("secure") === "true") {
      return createSecureProxyResponse(errorResponse, { status: 500 });
    }

    return json(errorResponse, { status: 500 });
  }
};
