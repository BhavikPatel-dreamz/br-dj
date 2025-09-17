// Budget Categories Server Actions
// This file handles all CRUD operations for budget categories management

import mssql from "../mssql.server.js";

// Get all budget categories with optional pagination and filtering
export async function getBudgetCategories(params = {}) {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            sortBy = 'category_name',
            sortOrder = 'ASC',
            activeOnly = true
        } = params;

        let whereClause = '';

        if (activeOnly) {
            whereClause = 'WHERE is_active = 1';
        }

        if (search && search.trim()) {
            const searchCondition = activeOnly 
                ? ' AND (category_name LIKE @search OR description LIKE @search)'
                : 'WHERE (category_name LIKE @search OR description LIKE @search)';
            whereClause += searchCondition;
        }

        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM shopify.budget_categories_master 
            ${whereClause}
        `;

        const countParams = search && search.trim() ? { search: `%${search}%` } : {};
        const countResult = await mssql.query(countQuery, countParams);
        const totalRecords = countResult[0].total;

        // Get paginated data
        const offset = (page - 1) * limit;
        const dataQuery = `
            SELECT 
                id,
                category_name,
                category_code,
                description,
                sort_order,
                is_active,
                created_at,
                updated_at,
                created_by,
                updated_by
            FROM shopify.budget_categories_master 
            ${whereClause}
            ORDER BY ${sortBy} ${sortOrder}
            OFFSET @offset ROWS 
            FETCH NEXT @limit ROWS ONLY
        `;

        const dataParams = {
            offset: offset,
            limit: limit,
            ...(search && search.trim() ? { search: `%${search}%` } : {})
        };
        
        const dataResult = await mssql.query(dataQuery, dataParams);

        return {
            success: true,
            data: dataResult,
            pagination: {
                currentPage: parseInt(page),
                pageSize: parseInt(limit),
                totalRecords: totalRecords,
                totalPages: Math.ceil(totalRecords / limit),
                hasNext: page * limit < totalRecords,
                hasPrevious: page > 1
            }
        };
    } catch (error) {
        console.error('Error fetching budget categories:', error);
        return {
            success: false,
            error: error.message || 'Failed to fetch budget categories',
            data: [],
            pagination: {
                currentPage: 1,
                pageSize: limit || 20,
                totalRecords: 0,
                totalPages: 0,
                hasNext: false,
                hasPrevious: false
            }
        };
    }
}

// Get a single budget category by ID
export async function getBudgetCategoryById(id) {
    try {
        const result = await mssql.query(`
            SELECT 
                id,
                category_name,
                category_code,
                description,
                sort_order,
                is_active,
                created_at,
                updated_at,
                created_by,
                updated_by
            FROM shopify.budget_categories_master 
            WHERE id = @id
        `, { id });

        if (result.length === 0) {
            return {
                success: false,
                error: 'Category not found',
                data: null
            };
        }

        return {
            success: true,
            data: result[0]
        };
    } catch (error) {
        console.error('Error fetching budget category:', error);
        return {
            success: false,
            error: error.message || 'Failed to fetch budget category',
            data: null
        };
    }
}

// Create a new budget category
export async function createBudgetCategory(categoryData) {
    try {
        const { category_name, category_code, description, sort_order, created_by } = categoryData;

        if (!category_name || !category_name.trim()) {
            return {
                success: false,
                error: 'Category name is required'
            };
        }

        // Check if category name already exists
        const existingResult = await mssql.query(`
            SELECT COUNT(*) as count
            FROM shopify.budget_categories_master 
            WHERE category_name = @category_name AND is_active = 1
        `, { category_name: category_name.trim() });

        if (existingResult[0].count > 0) {
            return {
                success: false,
                error: 'A category with this name already exists'
            };
        }

        // Create the new category
        const result = await mssql.query(`
            INSERT INTO shopify.budget_categories_master 
            (category_name, category_code, description, sort_order, created_by, is_active, created_at)
            OUTPUT INSERTED.id, INSERTED.category_name, INSERTED.category_code, 
                   INSERTED.description, INSERTED.sort_order, INSERTED.is_active,
                   INSERTED.created_at, INSERTED.updated_at, INSERTED.created_by, INSERTED.updated_by
            VALUES (@category_name, @category_code, @description, @sort_order, @created_by, 1, GETDATE())
        `, {
            category_name: category_name.trim(),
            category_code: category_code?.trim() || null,
            description: description?.trim() || null,
            sort_order: sort_order || 0,
            created_by: created_by
        });

        return {
            success: true,
            data: result[0],
            message: 'Category created successfully'
        };
    } catch (error) {
        console.error('Error creating budget category:', error);
        return {
            success: false,
            error: error.message || 'Failed to create budget category'
        };
    }
}

// Update an existing budget category
export async function updateBudgetCategory(id, categoryData) {
    try {
        const { category_name, category_code, description, sort_order, updated_by } = categoryData;

        if (!id) {
            return {
                success: false,
                error: 'Category ID is required'
            };
        }

        if (!category_name || !category_name.trim()) {
            return {
                success: false,
                error: 'Category name is required'
            };
        }

        // Check if category exists
        const existingResult = await mssql.query(`
            SELECT id FROM shopify.budget_categories_master WHERE id = @id
        `, { id });

        if (existingResult.length === 0) {
            return {
                success: false,
                error: 'Category not found'
            };
        }

        // Check for duplicate name (excluding current record)
        const duplicateResult = await mssql.query(`
            SELECT COUNT(*) as count
            FROM shopify.budget_categories_master 
            WHERE category_name = @category_name AND id != @id AND is_active = 1
        `, { 
            category_name: category_name.trim(), 
            id: id 
        });

        if (duplicateResult[0].count > 0) {
            return {
                success: false,
                error: 'A category with this name already exists'
            };
        }

        // Update the category
        const result = await mssql.query(`
            UPDATE shopify.budget_categories_master 
            SET 
                category_name = @category_name,
                category_code = @category_code,
                description = @description,
                sort_order = @sort_order,
                updated_by = @updated_by,
                updated_at = GETDATE()
            OUTPUT INSERTED.id, INSERTED.category_name, INSERTED.category_code, 
                   INSERTED.description, INSERTED.sort_order, INSERTED.is_active,
                   INSERTED.created_at, INSERTED.updated_at, INSERTED.created_by, INSERTED.updated_by
            WHERE id = @id
        `, {
            id: id,
            category_name: category_name.trim(),
            category_code: category_code?.trim() || null,
            description: description?.trim() || null,
            sort_order: sort_order || 0,
            updated_by: updated_by
        });

        return {
            success: true,
            data: result[0],
            message: 'Category updated successfully'
        };
    } catch (error) {
        console.error('Error updating budget category:', error);
        return {
            success: false,
            error: error.message || 'Failed to update budget category'
        };
    }
}

// Delete (soft delete) a budget category
export async function deleteBudgetCategory(id) {
    try {
        if (!id) {
            return {
                success: false,
                error: 'Category ID is required'
            };
        }

        // Check if category exists and is active
        const existingResult = await mssql.query(`
            SELECT id, category_name FROM shopify.budget_categories_master 
            WHERE id = @id AND is_active = 1
        `, { id });

        if (existingResult.length === 0) {
            return {
                success: false,
                error: 'Category not found or already deleted'
            };
        }

        // Check if category is being used in any budgets
        const usageResult = await mssql.query(`
            SELECT COUNT(*) as count
            FROM shopify.budget 
            WHERE category = @category_name AND status = 'active'
        `, { category_name: existingResult[0].category_name });

        if (usageResult[0].count > 0) {
            return {
                success: false,
                error: 'Cannot delete category that is currently being used in active budgets'
            };
        }

        // Soft delete the category
        await mssql.query(`
            UPDATE shopify.budget_categories_master 
            SET is_active = 0, updated_at = GETDATE()
            WHERE id = @id
        `, { id });

        return {
            success: true,
            message: 'Category deleted successfully'
        };
    } catch (error) {
        console.error('Error deleting budget category:', error);
        return {
            success: false,
            error: error.message || 'Failed to delete budget category'
        };
    }
}

// Get categories for dropdown/select options
export async function getBudgetCategoryOptions() {
    try {
        const result = await mssql.query(`
            SELECT 
                id,
                category_name,
                category_code
            FROM shopify.budget_categories_master 
            WHERE is_active = 1
            ORDER BY sort_order ASC, category_name ASC
        `);

        const options = result.map(category => ({
            label: category.category_name,
            value: category.category_name,
            id: category.id,
            code: category.category_code
        }));

        return {
            success: true,
            data: options
        };
    } catch (error) {
        console.error('Error fetching budget category options:', error);
        return {
            success: false,
            error: error.message || 'Failed to fetch budget category options',
            data: []
        };
    }
}
