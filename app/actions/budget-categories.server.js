// Budget Categories Server Actions
// This file handles all CRUD operations for budget categories management

import mssql from "../mssql.server.js";
import { json, redirect } from "@remix-run/node";

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
        let searchParams = [];

        if (activeOnly) {
            whereClause = 'WHERE is_active = 1';
        }

        if (search && search.trim()) {
            const searchCondition = activeOnly 
                ? ' AND (category_name LIKE @search OR description LIKE @search)'
                : 'WHERE (category_name LIKE @search OR description LIKE @search)';
            whereClause += searchCondition;
            searchParams.push({ name: 'search', type: mssql.NVarChar, value: `%${search}%` });
        }

        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM shopify.budget_categories_master 
            ${whereClause}
        `;

        const countRequest = mssql.request();
        searchParams.forEach(param => {
            countRequest.input(param.name, param.type, param.value);
        });
        const countResult = await countRequest.query(countQuery);
        const totalRecords = countResult.recordset[0].total;

        // Get paginated data
        const offset = (page - 1) * limit;
        const dataQuery = `
            SELECT 
                id,
                category_name,
                category_code,
                description,
                is_active,
                sort_order,
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

        const dataRequest = mssql.request();
        searchParams.forEach(param => {
            dataRequest.input(param.name, param.type, param.value);
        });
        dataRequest.input('offset', mssql.Int, offset);
        dataRequest.input('limit', mssql.Int, limit);
        
        const dataResult = await dataRequest.query(dataQuery);

        return {
            success: true,
            data: dataResult.recordset,
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
            error: 'Failed to fetch budget categories: ' + error.message,
            data: [],
            pagination: null
        };
    }
}

// Get a single budget category by ID
export async function getBudgetCategoryById(id) {
    try {
        const request = mssql.request();
        request.input('id', mssql.BigInt, id);

        const result = await request.query(`
            SELECT 
                id,
                category_name,
                category_code,
                description,
                is_active,
                sort_order,
                created_at,
                updated_at,
                created_by,
                updated_by
            FROM shopify.budget_categories_master 
            WHERE id = @id
        `);

        if (result.recordset.length === 0) {
            return {
                success: false,
                error: 'Budget category not found',
                data: null
            };
        }

        return {
            success: true,
            data: result.recordset[0]
        };

    } catch (error) {
        console.error('Error fetching budget category:', error);
        return {
            success: false,
            error: 'Failed to fetch budget category: ' + error.message,
            data: null
        };
    }
}

// Create a new budget category
export async function createBudgetCategory(categoryData) {
    try {
        const {
            category_name,
            category_code = null,
            description = null,
            sort_order = 0,
            created_by = 'user'
        } = categoryData;

        // Validate required fields
        if (!category_name || category_name.trim() === '') {
            return {
                success: false,
                error: 'Category name is required'
            };
        }

        // Check if category name already exists
        const existingRequest = mssql.request();
        existingRequest.input('category_name', mssql.NVarChar, category_name.trim());
        
        const existingResult = await existingRequest.query(`
            SELECT id FROM shopify.budget_categories_master 
            WHERE category_name = @category_name
        `);

        if (existingResult.recordset.length > 0) {
            return {
                success: false,
                error: 'A category with this name already exists'
            };
        }

        // Insert new category
        const request = mssql.request();
        request.input('category_name', mssql.NVarChar, category_name.trim());
        request.input('category_code', mssql.NVarChar, category_code?.trim() || null);
        request.input('description', mssql.NVarChar, description?.trim() || null);
        request.input('sort_order', mssql.Int, sort_order || 0);
        request.input('created_by', mssql.NVarChar, created_by);

        const result = await request.query(`
            INSERT INTO shopify.budget_categories_master 
                (category_name, category_code, description, sort_order, created_by, updated_by)
            VALUES 
                (@category_name, @category_code, @description, @sort_order, @created_by, @created_by);
            
            SELECT SCOPE_IDENTITY() as newId;
        `);

        const newId = result.recordset[0].newId;

        return {
            success: true,
            message: 'Budget category created successfully',
            data: { id: newId }
        };

    } catch (error) {
        console.error('Error creating budget category:', error);
        return {
            success: false,
            error: 'Failed to create budget category: ' + error.message
        };
    }
}

// Update an existing budget category
export async function updateBudgetCategory(id, categoryData) {
    try {
        const {
            category_name,
            category_code = null,
            description = null,
            sort_order = 0,
            is_active = true,
            updated_by = 'user'
        } = categoryData;

        // Validate required fields
        if (!category_name || category_name.trim() === '') {
            return {
                success: false,
                error: 'Category name is required'
            };
        }

        // Check if category exists
        const existingRequest = mssql.request();
        existingRequest.input('id', mssql.BigInt, id);
        
        const existingResult = await existingRequest.query(`
            SELECT id FROM shopify.budget_categories_master WHERE id = @id
        `);

        if (existingResult.recordset.length === 0) {
            return {
                success: false,
                error: 'Budget category not found'
            };
        }

        // Check if category name already exists (excluding current category)
        const duplicateRequest = mssql.request();
        duplicateRequest.input('category_name', mssql.NVarChar, category_name.trim());
        duplicateRequest.input('id', mssql.BigInt, id);
        
        const duplicateResult = await duplicateRequest.query(`
            SELECT id FROM shopify.budget_categories_master 
            WHERE category_name = @category_name AND id != @id
        `);

        if (duplicateResult.recordset.length > 0) {
            return {
                success: false,
                error: 'A category with this name already exists'
            };
        }

        // Update category
        const request = mssql.request();
        request.input('id', mssql.BigInt, id);
        request.input('category_name', mssql.NVarChar, category_name.trim());
        request.input('category_code', mssql.NVarChar, category_code?.trim() || null);
        request.input('description', mssql.NVarChar, description?.trim() || null);
        request.input('sort_order', mssql.Int, sort_order || 0);
        request.input('is_active', mssql.Bit, is_active);
        request.input('updated_by', mssql.NVarChar, updated_by);

        await request.query(`
            UPDATE shopify.budget_categories_master 
            SET 
                category_name = @category_name,
                category_code = @category_code,
                description = @description,
                sort_order = @sort_order,
                is_active = @is_active,
                updated_by = @updated_by,
                updated_at = GETUTCDATE()
            WHERE id = @id
        `);

        return {
            success: true,
            message: 'Budget category updated successfully'
        };

    } catch (error) {
        console.error('Error updating budget category:', error);
        return {
            success: false,
            error: 'Failed to update budget category: ' + error.message
        };
    }
}

// Soft delete a budget category (set is_active = false)
export async function deleteBudgetCategory(id) {
    try {
        // Check if category exists
        const existingRequest = mssql.request();
        existingRequest.input('id', mssql.BigInt, id);
        
        const existingResult = await existingRequest.query(`
            SELECT id, category_name FROM shopify.budget_categories_master WHERE id = @id
        `);

        if (existingResult.recordset.length === 0) {
            return {
                success: false,
                error: 'Budget category not found'
            };
        }

        // Check if category is used in any budgets
        const usageRequest = mssql.request();
        usageRequest.input('category_name', mssql.NVarChar, existingResult.recordset[0].category_name);
        
        const usageResult = await usageRequest.query(`
            SELECT COUNT(*) as usage_count 
            FROM shopify.budget_categories bc
            WHERE bc.category = @category_name
        `);

        if (usageResult.recordset[0].usage_count > 0) {
            return {
                success: false,
                error: 'Cannot delete category that is currently used in budget allocations. Please remove it from all budgets first.'
            };
        }

        // Soft delete (set is_active = false)
        const deleteRequest = mssql.request();
        deleteRequest.input('id', mssql.BigInt, id);
        deleteRequest.input('updated_by', mssql.NVarChar, 'user');

        await deleteRequest.query(`
            UPDATE shopify.budget_categories_master 
            SET 
                is_active = 0,
                updated_by = @updated_by,
                updated_at = GETUTCDATE()
            WHERE id = @id
        `);

        return {
            success: true,
            message: 'Budget category deleted successfully'
        };

    } catch (error) {
        console.error('Error deleting budget category:', error);
        return {
            success: false,
            error: 'Failed to delete budget category: ' + error.message
        };
    }
}

// Get all active categories for dropdowns/select lists
export async function getActiveBudgetCategories() {
    try {
        const result = await mssql.query(`
            SELECT 
                id,
                category_name,
                category_code,
                description,
                sort_order
            FROM shopify.budget_categories_master 
            WHERE is_active = 1
            ORDER BY sort_order ASC, category_name ASC
        `);

        return {
            success: true,
            data: result.recordset
        };

    } catch (error) {
        console.error('Error fetching active budget categories:', error);
        return {
            success: false,
            error: 'Failed to fetch active budget categories: ' + error.message,
            data: []
        };
    }
}

// Bulk update sort order for categories
export async function updateCategoriesSortOrder(categoryIds, sortOrders) {
    try {
        if (!Array.isArray(categoryIds) || !Array.isArray(sortOrders) || categoryIds.length !== sortOrders.length) {
            return {
                success: false,
                error: 'Invalid parameters for bulk sort order update'
            };
        }

        // Use transaction for bulk update
        const transaction = new mssql.Transaction();
        await transaction.begin();

        try {
            for (let i = 0; i < categoryIds.length; i++) {
                const request = new mssql.Request(transaction);
                request.input('id', mssql.BigInt, categoryIds[i]);
                request.input('sort_order', mssql.Int, sortOrders[i]);

                await request.query(`
                    UPDATE shopify.budget_categories_master 
                    SET sort_order = @sort_order, updated_at = GETUTCDATE()
                    WHERE id = @id
                `);
            }

            await transaction.commit();

            return {
                success: true,
                message: 'Sort order updated successfully'
            };

        } catch (error) {
            await transaction.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Error updating categories sort order:', error);
        return {
            success: false,
            error: 'Failed to update sort order: ' + error.message
        };
    }
}
