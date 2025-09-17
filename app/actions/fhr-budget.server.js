// Budget Management Server Actions
// This file will handle all budget-related database operations

import mssql from '../mssql.server.js';

// Predefined categories available for budget allocation
export const BUDGET_CATEGORIES = [
  "Gen Nsg>Medical Supplies",
  "Gen Nsg>Incontinent Supplies", 
  "Gen Nsg>Wound Care",
  "Gen Nsg>Personal Care",
  "Gen Nsg>Nutrition",
  "Capital>Fixed Equip",
  "Capital>Major Moveable Equip",
  "Capital>Leasehold Improvements",
  "Capital>Minor Equip",
  "Housekeeping>Minor Equip",
  "Housekeeping>Supplies",
  "Housekeeping>Cleaning Supplies",
  "Maintenance>Supplies",
  "Maintenance>Minor Equip",
  "Maintenance>Tools",
  "Administration>Office Supplies",
  "Administration>Technology",
  "Administration>Communications",
  "Food Service>Food & Beverages",
  "Food Service>Kitchen Supplies",
  "Food Service>Equipment",
  "Therapeutic>Recreation Supplies",
  "Therapeutic>Activity Materials",
  "Therapeutic>Equipment"
];

/**
 * Get budget categories from database with full details
 * @returns {Array} Array of available budget categories from the database with id, name, parent_category, etc.
 */
export async function getBudgetCategoriesFromDB() {
  try {
    const result = await mssql.query(`
      SELECT 
        id,
        category_name as name,
        parent_category,
        description,
        is_active,
        created_at,
        updated_at
      FROM shopify.budget_categories_master 
      WHERE is_active = 1
      ORDER BY parent_category ASC, category_name ASC
    `);

    console.log('Database query result length:', Array.isArray(result) ? result.length : 'Not an array');
    
    // Check if result is directly an array or has recordset property
    let categories = [];
    if (Array.isArray(result)) {
      categories = result;
    } else if (result && result.recordset && Array.isArray(result.recordset)) {
      categories = result.recordset;
    } else {
      console.warn('Unexpected result format, using fallback categories');
      return BUDGET_CATEGORIES.map((name, index) => ({ 
        id: index + 1, // Give fallback categories proper IDs
        name, 
        parent_category: name.split('>')[0] 
      }));
    }
    
    console.log(`✅ Loaded ${categories.length} categories from database`);
    
    return categories;
  } catch (error) {
    console.error('Error fetching categories from database:', error);
    // Fallback to hardcoded categories if database fails
    return BUDGET_CATEGORIES.map((name, index) => ({ 
      id: index + 1000, // Use a different range for error fallback 
      name, 
      parent_category: name.split('>')[0] 
    }));
  }
}

/**
 * Get predefined budget categories (keeping for backward compatibility)
 * @returns {Promise<Array>} Array of available budget categories with full details
 */
export async function getBudgetCategories() {
  // Try to get from database first, fallback to hardcoded
  return await getBudgetCategoriesFromDB();
}

/**
 * Get simple category names for backward compatibility
 * @returns {Promise<Array>} Array of category names only
 */
export async function getBudgetCategoryNames() {
  const categories = await getBudgetCategoriesFromDB();
  return categories.map(cat => cat.name);
}

/**
 * Validate budget categories with support for both IDs and names
 * @param {Object} categories - Categories object to validate (can use IDs or names as keys)
 * @param {Array} validCategoriesData - Array of valid category objects from database
 * @returns {Object} Validation result with isValid and errors
 */
export function validateBudgetCategories(categories, validCategoriesData = null) {
  const errors = [];
  const validCategories = {};

  if (!categories || typeof categories !== 'object') {
    return {
      isValid: false,
      errors: ['Categories must be provided as an object'],
      validCategories: {}
    };
  }

  // If we don't have validCategoriesData, use fallback validation
  if (!validCategoriesData) {
    for (const [category, value] of Object.entries(categories)) {
      // Check if category is in predefined list
      if (!BUDGET_CATEGORIES.includes(category)) {
        errors.push(`Invalid category: ${category}`);
        continue;
      }

      // Validate value is a positive number
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue < 0) {
        errors.push(`Invalid value for ${category}: must be a positive number`);
        continue;
      }

      validCategories[category] = numValue.toString();
    }
  } else {
    // Enhanced validation with database categories
    const validCategoryIds = validCategoriesData.map(cat => cat.id.toString());
    const validCategoryNames = validCategoriesData.map(cat => cat.name);
    
    for (const [categoryKey, value] of Object.entries(categories)) {
      let categoryData = null;
      
      // Check if key is an ID or a name
      if (validCategoryIds.includes(categoryKey.toString())) {
        categoryData = validCategoriesData.find(cat => cat.id.toString() === categoryKey.toString());
      } else if (validCategoryNames.includes(categoryKey)) {
        categoryData = validCategoriesData.find(cat => cat.name === categoryKey);
      }
      
      if (!categoryData) {
        errors.push(`Invalid category: ${categoryKey}`);
        continue;
      }

      // Validate value is a positive number
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue < 0) {
        errors.push(`Invalid value for ${categoryData.name}: must be a positive number`);
        continue;
      }

      // Store with category ID as key
      validCategories[categoryData.id.toString()] = {
        categoryId: categoryData.id,
        categoryName: categoryData.name,
        amount: numValue.toString()
      };
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    validCategories
  };
}

/**
 * Get all budgets in simple format (for UI compatibility)
 * @returns {Array} Array of simplified budget objects
 */
export async function getSimpleBudgets() {
  try {
    // Query budgets with their primary category
    const budgets = await mssql.query(`
      SELECT 
        b.*,
        bcm.category_name as category,
        bc.allocated_amount as amount
      FROM shopify.budget b
      LEFT JOIN shopify.budget_categories bc ON b.id = bc.budget_id
      LEFT JOIN shopify.budget_categories_master bcm ON bc.category_id = bcm.id
      ORDER BY b.created_at DESC
    `);

    // Transform to simple format expected by UI
    const simpleBudgets = budgets.map(budget => ({
      id: budget.id.toString(),
      name: budget.name,
      description: budget.description,
      amount: budget.amount || budget.total_amount || 0,
      category: budget.category || "Uncategorized",
      period: budget.period || "monthly", // Default period since it's not in DB
      status: budget.status,
      start_date: budget.start_date,
      end_date: budget.end_date,
      created_at: budget.created_at,
      updated_at: budget.updated_at
    }));

    // Remove duplicates (in case a budget has multiple categories, just take the first one)
    const uniqueBudgets = [];
    const seenIds = new Set();
    
    for (const budget of simpleBudgets) {
      if (!seenIds.has(budget.id)) {
        seenIds.add(budget.id);
        uniqueBudgets.push(budget);
      }
    }

    return uniqueBudgets;
  } catch (error) {
    console.error("Error fetching simple budgets:", error);
    throw new Error("Failed to fetch budgets");
  }
}

/**
 * Get all budgets
 * @returns {Array} Array of budget objects
 */
export async function getBudgets() {
  try {
    // Query budgets with category details
    const budgets = await mssql.query(`
      SELECT 
        b.*,
        ISNULL(bc.category_count, 0) as category_count,
        ISNULL(bc.total_spent, 0) as total_spent,
        ISNULL(bc.total_remaining, 0) as total_remaining
      FROM shopify.budget b
      LEFT JOIN (
        SELECT 
          budget_id,
          COUNT(*) as category_count,
          SUM(spent_amount) as total_spent,
          SUM(remaining_amount) as total_remaining
        FROM shopify.budget_categories
        GROUP BY budget_id
      ) bc ON b.id = bc.budget_id
      ORDER BY b.created_at DESC
    `);

    // Get categories for each budget
    for (const budget of budgets) {
      const categories = await mssql.query(`
        SELECT 
          bc.category_id,
          bcm.category_name,
          bcm.parent_category,
          bc.allocated_amount, 
          bc.spent_amount, 
          bc.remaining_amount
        FROM shopify.budget_categories bc
        INNER JOIN shopify.budget_categories_master bcm ON bc.category_id = bcm.id
        WHERE bc.budget_id = @budgetId
        ORDER BY bcm.parent_category, bcm.category_name
      `, { budgetId: budget.id });

      budget.categories = categories.reduce((acc, cat) => {
        acc[cat.category_id] = {
          categoryId: cat.category_id,
          categoryName: cat.category_name,
          parentCategory: cat.parent_category,
          amount: cat.allocated_amount.toString()
        };
        return acc;
      }, {});
      
      budget.categoryDetails = categories;
    }

    return budgets;
  } catch (error) {
    console.error("Error fetching budgets:", error);
    throw new Error("Failed to fetch budgets");
  }
}

/**
 * Create a simple budget with single category (for UI compatibility)
 * @param {Object} budgetData - Simple budget data
 * @param {string} budgetData.name - Budget name
 * @param {string} budgetData.description - Budget description
 * @param {number} budgetData.amount - Total budget amount
 * @param {string} budgetData.category - Single category name
 * @param {string} budgetData.period - Budget period
 * @param {string} budgetData.start_date - Start date
 * @param {string} budgetData.end_date - End date
 * @param {string} budgetData.status - Budget status
 * @returns {Object} Result object with success/error
 */
export async function createSimpleBudget(budgetData) {
  try {
    // Validate input
    if (!budgetData || !budgetData.name) {
      return { success: false, error: "Budget name is required" };
    }

    // Validate budget name
    if (typeof budgetData.name !== 'string' || budgetData.name.trim().length === 0) {
      return { success: false, error: "Budget name must be a non-empty string" };
    }

    // Validate amount
    const amount = parseFloat(budgetData.amount) || 0;
    if (amount <= 0) {
      return { success: false, error: "Budget amount must be greater than 0" };
    }

    // Find category ID if category is provided
    let categoryId = null;
    if (budgetData.category) {
      const validCategoriesData = await getBudgetCategoriesFromDB();
      const categoryData = validCategoriesData.find(cat => 
        cat.category_name === budgetData.category || cat.name === budgetData.category
      );
      if (categoryData) {
        categoryId = categoryData.id;
      }
    }

    // Start database transaction
    const pool = await mssql.getPool();
    const transaction = pool.transaction();
    
    try {
      await transaction.begin();

      // Insert budget record
      const budgetResult = await transaction.request()
        .input('name', budgetData.name.trim())
        .input('description', budgetData.description || null)
        .input('totalAmount', amount)
        .input('status', budgetData.status || 'active')
        .input('createdBy', budgetData.createdBy || 'system')
        .query(`
          INSERT INTO shopify.budget (name, description, total_amount, status, created_by)
          OUTPUT INSERTED.*
          VALUES (@name, @description, @totalAmount, @status, @createdBy)
        `);

      const newBudget = budgetResult.recordset[0];

      // Insert budget category if category is provided
      if (categoryId) {
        await transaction.request()
          .input('budgetId', newBudget.id)
          .input('categoryId', categoryId)
          .input('allocatedAmount', amount)
          .query(`
            INSERT INTO shopify.budget_categories (budget_id, category_id, allocated_amount, remaining_amount)
            VALUES (@budgetId, @categoryId, @allocatedAmount, @allocatedAmount)
          `);
      }

      await transaction.commit();

      // Return success with created budget
      return { 
        success: true, 
        budget: {
          id: newBudget.id.toString(),
          name: newBudget.name,
          description: newBudget.description,
          amount: newBudget.total_amount,
          category: budgetData.category,
          status: newBudget.status,
          created_at: newBudget.created_at
        }
      };

    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }

  } catch (error) {
    console.error("Error creating simple budget:", error);
    return { success: false, error: `Failed to create budget: ${error.message}` };
  }
}

/**
 * Create a new budget
 * @param {Object} budgetData - Budget data to create
 * @param {string} budgetData.name - Budget name
 * @param {Object} budgetData.categories - Categories with budget amounts (can use IDs or names as keys)
 * @returns {Object} Created budget object
 */
export async function createBudget(budgetData) {
  try {
    // Validate input
    if (!budgetData || !budgetData.name || !budgetData.categories) {
      throw new Error("Budget name and categories are required");
    }

    // Validate budget name
    if (typeof budgetData.name !== 'string' || budgetData.name.trim().length === 0) {
      throw new Error("Budget name must be a non-empty string");
    }

    // Get valid categories from database for validation
    const validCategoriesData = await getBudgetCategoriesFromDB();

    // Validate categories
    const validation = validateBudgetCategories(budgetData.categories, validCategoriesData);
    if (!validation.isValid) {
      throw new Error(`Invalid categories: ${validation.errors.join(', ')}`);
    }

    // Calculate total budget amount
    const totalAmount = Object.values(validation.validCategories)
      .reduce((sum, categoryData) => sum + parseFloat(categoryData.amount || categoryData), 0);

    // Start database transaction
    const pool = await mssql.getPool();
    const transaction = pool.transaction();
    
    try {
      await transaction.begin();

      // Insert budget record
      const budgetResult = await transaction.request()
        .input('name', budgetData.name.trim())
        .input('description', budgetData.description || null)
        .input('totalAmount', totalAmount)
        .input('status', 'active')
        .input('createdBy', budgetData.createdBy || 'system')
        .query(`
          INSERT INTO shopify.budget (name, description, total_amount, status, created_by)
          OUTPUT INSERTED.*
          VALUES (@name, @description, @totalAmount, @status, @createdBy)
        `);

      const newBudget = budgetResult.recordset[0];

      // Insert budget categories using category IDs
      for (const [categoryKey, categoryData] of Object.entries(validation.validCategories)) {
        const categoryId = categoryData.categoryId || categoryKey;
        const amount = parseFloat(categoryData.amount || categoryData);
        
        await transaction.request()
          .input('budgetId', newBudget.id)
          .input('categoryId', categoryId)
          .input('allocatedAmount', amount)
          .query(`
            INSERT INTO shopify.budget_categories (budget_id, category_id, allocated_amount)
            VALUES (@budgetId, @categoryId, @allocatedAmount)
          `);
      }

      await transaction.commit();

      // Return the created budget with categories
      const createdBudget = {
        id: newBudget.id.toString(),
        name: newBudget.name,
        description: newBudget.description,
        total_amount: newBudget.total_amount,
        totalAmount: newBudget.total_amount,
        status: newBudget.status,
        categories: validation.validCategories,
        created_at: newBudget.created_at,
        updated_at: newBudget.updated_at,
        createdAt: newBudget.created_at,
        updatedAt: newBudget.updated_at
      };

      console.log("Created budget:", createdBudget);
      return createdBudget;

    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }

  } catch (error) {
    console.error("Error creating budget:", error);
    throw new Error(`Failed to create budget: ${error.message}`);
  }
}

/**
 * Get budget by ID
 * @param {string|number} budgetId - Budget ID
 * @returns {Object} Budget object with categories
 */
export async function getBudgetById(budgetId) {
  try {
    const budget = await mssql.query(`
      SELECT * FROM shopify.budget WHERE id = @budgetId
    `, { budgetId });

    if (!budget || budget.length === 0) {
      throw new Error("Budget not found");
    }

    const categories = await mssql.query(`
      SELECT 
        bc.category_id,
        bcm.category_name,
        bcm.parent_category,
        bc.allocated_amount, 
        bc.spent_amount, 
        bc.remaining_amount
      FROM shopify.budget_categories bc
      INNER JOIN shopify.budget_categories_master bcm ON bc.category_id = bcm.id
      WHERE bc.budget_id = @budgetId
      ORDER BY bcm.parent_category, bcm.category_name
    `, { budgetId });

    const budgetData = budget[0];
    budgetData.categories = categories.reduce((acc, cat) => {
      acc[cat.category_id] = {
        categoryId: cat.category_id,
        categoryName: cat.category_name,
        parentCategory: cat.parent_category,
        amount: cat.allocated_amount.toString()
      };
      return acc;
    }, {});
    budgetData.categoryDetails = categories;

    return budgetData;
  } catch (error) {
    console.error("Error fetching budget by ID:", error);
    throw new Error(`Failed to fetch budget: ${error.message}`);
  }
}

/**
 * Update a simple budget (for UI compatibility)
 * @param {string|number} budgetId - Budget ID
 * @param {Object} updateData - Simple budget data to update
 * @returns {Object} Result object with success/error
 */
export async function updateSimpleBudget(budgetId, updateData) {
  try {
    // Validate amount if provided
    let amount = null;
    if (updateData.amount !== undefined) {
      amount = parseFloat(updateData.amount);
      if (isNaN(amount) || amount <= 0) {
        return { success: false, error: "Budget amount must be greater than 0" };
      }
    }

    // Find category ID if category is provided
    let categoryId = null;
    if (updateData.category) {
      const validCategoriesData = await getBudgetCategoriesFromDB();
      const categoryData = validCategoriesData.find(cat => 
        cat.category_name === updateData.category || cat.name === updateData.category
      );
      if (categoryData) {
        categoryId = categoryData.id;
      }
    }

    const pool = await mssql.getPool();
    const transaction = pool.transaction();
    
    try {
      await transaction.begin();

      // Update budget basic info
      const budgetUpdateResult = await transaction.request()
        .input('budgetId', budgetId)
        .input('name', updateData.name || null)
        .input('description', updateData.description || null)
        .input('totalAmount', amount)
        .input('status', updateData.status || null)
        .query(`
          UPDATE shopify.budget 
          SET 
            name = COALESCE(@name, name),
            description = COALESCE(@description, description),
            total_amount = COALESCE(@totalAmount, total_amount),
            status = COALESCE(@status, status),
            updated_at = GETUTCDATE()
          WHERE id = @budgetId
        `);

      // Update category assignment if category or amount changed
      if (categoryId !== null || amount !== null) {
        // First check if there's an existing category assignment
        const existingCategory = await transaction.request()
          .input('budgetId', budgetId)
          .query(`
            SELECT bc.id, bc.category_id, bc.allocated_amount 
            FROM shopify.budget_categories bc 
            WHERE bc.budget_id = @budgetId
          `);

        if (existingCategory.recordset.length > 0) {
          // Update existing category assignment
          await transaction.request()
            .input('budgetId', budgetId)
            .input('categoryId', categoryId || existingCategory.recordset[0].category_id)
            .input('allocatedAmount', amount || existingCategory.recordset[0].allocated_amount)
            .query(`
              UPDATE shopify.budget_categories 
              SET 
                category_id = @categoryId,
                allocated_amount = @allocatedAmount,
                remaining_amount = @allocatedAmount,
                updated_at = GETUTCDATE()
              WHERE budget_id = @budgetId
            `);
        } else if (categoryId !== null && amount !== null) {
          // Create new category assignment
          await transaction.request()
            .input('budgetId', budgetId)
            .input('categoryId', categoryId)
            .input('allocatedAmount', amount)
            .query(`
              INSERT INTO shopify.budget_categories (budget_id, category_id, allocated_amount, remaining_amount)
              VALUES (@budgetId, @categoryId, @allocatedAmount, @allocatedAmount)
            `);
        }
      }

      await transaction.commit();

      return { success: true };

    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }

  } catch (error) {
    console.error("Error updating simple budget:", error);
    return { success: false, error: `Failed to update budget: ${error.message}` };
  }
}

/**
 * Update budget
 * @param {string|number} budgetId - Budget ID
 * @param {Object} updateData - Data to update
 * @returns {Object} Updated budget object
 */
export async function updateBudget(budgetId, updateData) {
  try {
    const pool = await mssql.getPool();
    const transaction = pool.transaction();
    
    try {
      await transaction.begin();

      // Update budget basic info
      if (updateData.name || updateData.description || updateData.status) {
        await transaction.request()
          .input('budgetId', budgetId)
          .input('name', updateData.name)
          .input('description', updateData.description)
          .input('status', updateData.status)
          .query(`
            UPDATE shopify.budget 
            SET 
              name = COALESCE(@name, name),
              description = COALESCE(@description, description),
              status = COALESCE(@status, status),
              updated_at = GETUTCDATE()
            WHERE id = @budgetId
          `);
      }

      // Update categories if provided
      if (updateData.categories) {
        const validation = validateBudgetCategories(updateData.categories);
        if (!validation.isValid) {
          throw new Error(`Invalid categories: ${validation.errors.join(', ')}`);
        }

        // Delete existing categories
        await transaction.request()
          .input('budgetId', budgetId)
          .query('DELETE FROM shopify.budget_categories WHERE budget_id = @budgetId');

        // Insert new categories
        for (const [categoryName, amount] of Object.entries(validation.validCategories)) {
          await transaction.request()
            .input('budgetId', budgetId)
            .input('categoryName', categoryName)
            .input('allocatedAmount', parseFloat(amount))
            .query(`
              INSERT INTO shopify.budget_categories (budget_id, category_name, allocated_amount)
              VALUES (@budgetId, @categoryName, @allocatedAmount)
            `);
        }
      }

      await transaction.commit();

      // Return updated budget
      return await getBudgetById(budgetId);

    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }

  } catch (error) {
    console.error("Error updating budget:", error);
    throw new Error(`Failed to update budget: ${error.message}`);
  }
}

/**
 * Delete budget
 * @param {string|number} budgetId - Budget ID
 * @returns {boolean} Success status
 */
export async function deleteBudget(budgetId) {
  try {

    console.log("deleted budget id:", budgetId);

    const result = await mssql.query(`
      DELETE FROM shopify.budget WHERE id = @budgetId
    `, { budgetId });

    console.log("deleted budget result:", result);

    return true;
  } catch (error) {
    console.error("Error deleting budget:", error);
    throw new Error(`Failed to delete budget: ${error.message}`);
  }
}

/**
 * Get budget summary statistics
 * @returns {Object} Budget statistics
 */
export async function getBudgetStats() {
  try {
    const stats = await mssql.query(`
      SELECT 
        COUNT(*) as total_budgets,
        SUM(total_amount) as total_allocated,
        AVG(total_amount) as avg_budget_amount,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_budgets,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_budgets
      FROM shopify.budget
    `);

    const categoryStats = await mssql.query(`
      SELECT 
        COUNT(*) as total_categories,
        SUM(allocated_amount) as total_category_allocation,
        SUM(spent_amount) as total_spent,
        SUM(remaining_amount) as total_remaining
      FROM shopify.budget_categories
    `);

    return {
      ...stats[0],
      ...categoryStats[0]
    };
  } catch (error) {
    console.error("Error fetching budget stats:", error);
    throw new Error(`Failed to fetch budget statistics: ${error.message}`);
  }
}

/**
 * Get available company locations from orders data
 * @returns {Array} Array of location objects with id and name
 */
export async function getAvailableLocations() {
  try {
    const locations = await mssql.query(`
      SELECT DISTINCT 
        CAST(o.company_location_id AS NVARCHAR(255)) as company_location_id,
        o.shipping_address_company,
        o.shipping_address_city,
        o.shipping_address_province,
        COUNT(*) as order_count
      FROM brdjdb.shopify.[order] AS o
      WHERE o.company_location_id IS NOT NULL 
        AND o.company_location_id != ''
        AND CAST(o.company_location_id AS NVARCHAR(255)) != 'null'
      GROUP BY 
        CAST(o.company_location_id AS NVARCHAR(255)),
        o.shipping_address_company,
        o.shipping_address_city,
        o.shipping_address_province
      ORDER BY order_count DESC, company_location_id ASC
    `);

    return locations.map(location => ({
      id: location.company_location_id,
      name: `${location.company_location_id}${location.shipping_address_company ? ' - ' + location.shipping_address_company : ''}${location.shipping_address_city ? ', ' + location.shipping_address_city : ''}${location.shipping_address_province ? ', ' + location.shipping_address_province : ''}`,
      company: location.shipping_address_company,
      city: location.shipping_address_city,
      province: location.shipping_address_province,
      orderCount: location.order_count
    }));
  } catch (error) {
    console.error("Error fetching available locations:", error);
    throw new Error(`Failed to fetch available locations: ${error.message}`);
  }
}

/**
 * Create budget location assignment
 * @param {Object} assignmentData - Assignment data
 * @param {string|number} assignmentData.budgetId - Budget ID
 * @param {string} assignmentData.locationId - Company location ID
 * @param {string} assignmentData.assignedBy - User who made the assignment
 * @returns {Object} Created assignment object
 */
export async function assignBudgetToLocation(assignmentData) {
  try {
    // Validate input
    if (!assignmentData || !assignmentData.budgetId || !assignmentData.locationId) {
      throw new Error("Budget ID and location ID are required");
    }

    // Check if budget exists
    const budget = await getBudgetById(assignmentData.budgetId);
    if (!budget) {
      throw new Error("Budget not found");
    }

    // Check if assignment already exists
    const existingAssignment = await mssql.query(`
      SELECT * FROM shopify.budget_location_assignments 
      WHERE budget_id = @budgetId AND location_id = @locationId
    `, {
      budgetId: assignmentData.budgetId,
      locationId: assignmentData.locationId
    });

    if (existingAssignment && existingAssignment.length > 0) {
      throw new Error("Budget is already assigned to this location");
    }

    // Create assignment
    const result = await mssql.query(`
      INSERT INTO shopify.budget_location_assignments (budget_id, location_id, assigned_by, status)
      OUTPUT INSERTED.*
      VALUES (@budgetId, @locationId, @assignedBy, 'active')
    `, {
      budgetId: assignmentData.budgetId,
      locationId: assignmentData.locationId,
      assignedBy: assignmentData.assignedBy || 'system'
    });

    return result[0];
  } catch (error) {
    console.error("Error assigning budget to location:", error);
    throw new Error(`Failed to assign budget to location: ${error.message}`);
  }
}

/**
 * Get budget assignments for a location
 * @param {string} locationId - Company location ID
 * @returns {Array} Array of budget assignments
 */
export async function getBudgetAssignmentsByLocation(locationId) {
  try {
    const assignments = await mssql.query(`
      SELECT 
        ba.*,
        b.name as budget_name,
        b.total_amount,
        b.status as budget_status
      FROM shopify.budget_location_assignments ba
      INNER JOIN shopify.budget b ON ba.budget_id = b.id
      WHERE ba.location_id = @locationId
        AND ba.status = 'active'
      ORDER BY ba.created_at DESC
    `, { locationId });

    return assignments;
  } catch (error) {
    console.error("Error fetching budget assignments by location:", error);
    throw new Error(`Failed to fetch budget assignments: ${error.message}`);
  }
}

/**
 * Get budget assignments for a budget
 * @param {string|number} budgetId - Budget ID
 * @returns {Array} Array of location assignments
 */
export async function getBudgetAssignmentsByBudget(budgetId) {
  try {
    const assignments = await mssql.query(`
      SELECT 
        ba.id,
        ba.budget_id,
        ba.location_id,
        ba.status,
        ba.assigned_by,
        ba.created_at,
        ba.updated_at,
        b.name as budget_name,
        b.total_amount,
        b.status as budget_status
      FROM shopify.budget_location_assignments ba
      INNER JOIN shopify.budget b ON ba.budget_id = b.id
      WHERE ba.budget_id = @budgetId
        AND ba.status = 'active'
      ORDER BY ba.created_at DESC
    `, { budgetId });

    return assignments;
  } catch (error) {
    console.error("Error fetching budget assignments by budget:", error);
    throw new Error(`Failed to fetch budget assignments: ${error.message}`);
  }
}

/**
 * Get all budget location assignments
 * @returns {Array} Array of all budget assignments
 */
export async function getAllBudgetAssignments() {
  try {
    const assignments = await mssql.query(`
      SELECT 
        ba.id,
        ba.budget_id,
        ba.location_id,
        ba.status,
        ba.assigned_by,
        ba.created_at,
        ba.updated_at,
        b.name as budget_name,
        b.total_amount,
        b.status as budget_status
      FROM shopify.budget_location_assignments ba
      INNER JOIN shopify.budget b ON ba.budget_id = b.id
      WHERE ba.status = 'active'
      ORDER BY ba.created_at DESC
    `);

    return assignments;
  } catch (error) {
    console.error("Error fetching all budget assignments:", error);
    throw new Error(`Failed to fetch all budget assignments: ${error.message}`);
  }
}

/**
 * Remove budget assignment
 * @param {string|number} assignmentId - Assignment ID
 * @returns {boolean} Success status
 */
export async function removeBudgetAssignment(assignmentId) {
  try {
    const result = await mssql.query(`
      UPDATE shopify.budget_location_assignments 
      SET status = 'inactive', updated_at = GETUTCDATE()
      WHERE id = @assignmentId
    `, { assignmentId });

    return result.rowsAffected && result.rowsAffected[0] > 0;
  } catch (error) {
    console.error("Error removing budget assignment:", error);
    throw new Error(`Failed to remove budget assignment: ${error.message}`);
  }
}
