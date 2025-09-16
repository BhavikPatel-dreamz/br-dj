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
 * Get predefined budget categories
 * @returns {Array} Array of available budget categories
 */
export function getBudgetCategories() {
  return BUDGET_CATEGORIES;
}

/**
 * Validate budget categories
 * @param {Object} categories - Categories object to validate
 * @returns {Object} Validation result with isValid and errors
 */
export function validateBudgetCategories(categories) {
  const errors = [];
  const validCategories = {};

  if (!categories || typeof categories !== 'object') {
    return {
      isValid: false,
      errors: ['Categories must be provided as an object'],
      validCategories: {}
    };
  }

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

  return {
    isValid: errors.length === 0,
    errors,
    validCategories
  };
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
        SELECT category_name, allocated_amount, spent_amount, remaining_amount
        FROM shopify.budget_categories
        WHERE budget_id = @budgetId
        ORDER BY category_name
      `, { budgetId: budget.id });

      budget.categories = categories.reduce((acc, cat) => {
        acc[cat.category_name] = cat.allocated_amount.toString();
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
 * Create a new budget
 * @param {Object} budgetData - Budget data to create
 * @param {string} budgetData.name - Budget name
 * @param {Object} budgetData.categories - Categories with budget amounts
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

    // Validate categories
    const validation = validateBudgetCategories(budgetData.categories);
    if (!validation.isValid) {
      throw new Error(`Invalid categories: ${validation.errors.join(', ')}`);
    }

    // Calculate total budget amount
    const totalAmount = Object.values(validation.validCategories)
      .reduce((sum, value) => sum + parseFloat(value), 0);

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

      // Insert budget categories
      for (const [categoryName, amount] of Object.entries(validation.validCategories)) {
        await transaction.request()
          .input('budgetId', newBudget.id)
          .input('categoryName', categoryName)
          .input('allocatedAmount', parseFloat(amount))
          .query(`
            INSERT INTO shopify.budget_categories (budget_id, category_name, allocated_amount)
            VALUES (@budgetId, @categoryName, @allocatedAmount)
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
      SELECT category_name, allocated_amount, spent_amount, remaining_amount
      FROM shopify.budget_categories
      WHERE budget_id = @budgetId
      ORDER BY category_name
    `, { budgetId });

    const budgetData = budget[0];
    budgetData.categories = categories.reduce((acc, cat) => {
      acc[cat.category_name] = cat.allocated_amount.toString();
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
    const result = await mssql.query(`
      DELETE FROM shopify.budget WHERE id = @budgetId
    `, { budgetId });

    return result.rowsAffected && result.rowsAffected[0] > 0;
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
