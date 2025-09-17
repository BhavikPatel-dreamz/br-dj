// Server-only budget management functions
import { 
  createBudget, 
  getBudgets, 
  updateBudget, 
  deleteBudget, 
  getBudgetCategories, 
  getAvailableLocations,
  assignBudgetToLocation,
  getBudgetAssignmentsByLocation,
  getBudgetAssignmentsByBudget 
} from "./fhr-budget.server";

export async function loadBudgetData({ page, limit, search, category, view }) {
  try {
    const budgets = await getBudgets();
    const categories = await getBudgetCategories();
    const locations = await getAvailableLocations();
    // For now, we'll skip assignments until we implement a proper function
    const assignments = [];

    // Apply client-side filtering for now
    let filteredBudgets = budgets || [];
    
    if (search) {
      filteredBudgets = filteredBudgets.filter(budget => 
        budget.name?.toLowerCase().includes(search.toLowerCase()) ||
        budget.description?.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    if (category) {
      filteredBudgets = filteredBudgets.filter(budget => 
        budget.category === category
      );
    }

    // Apply pagination
    const totalBudgets = filteredBudgets.length;
    const startIndex = (page - 1) * limit;
    const paginatedBudgets = filteredBudgets.slice(startIndex, startIndex + limit);

    return {
      budgets: paginatedBudgets,
      totalBudgets: totalBudgets,
      currentPage: page,
      totalPages: Math.ceil(totalBudgets / limit),
      categories: categories || [],
      locations: locations || [],
      assignments: assignments || [],
      filters: { search, category },
      view
    };
  } catch (error) {
    console.error("Error loading budget data:", error);
    return {
      budgets: [],
      totalBudgets: 0,
      currentPage: 1,
      totalPages: 0,
      categories: [],
      locations: [],
      assignments: [],
      filters: { search: "", category: "" },
      view,
      error: "Failed to load budget data"
    };
  }
}

export async function handleBudgetAction({ intent, formData }) {
  try {
    switch (intent) {
      case "create": {
        const budgetData = {
          name: formData.get("name"),
          description: formData.get("description"),
          amount: parseFloat(formData.get("amount")),
          category: formData.get("category"),
          period: formData.get("period"),
          start_date: formData.get("start_date"),
          end_date: formData.get("end_date"),
          status: formData.get("status") || "active"
        };

        const result = await createBudget(budgetData);
        if (result.success) {
          return { success: "Budget created successfully", redirect: "/app/budget-management?view=budgets&success=Budget created successfully" };
        }
        return { error: result.error || "Failed to create budget" };
      }

      case "update": {
        const id = formData.get("id");
        const budgetData = {
          name: formData.get("name"),
          description: formData.get("description"),
          amount: parseFloat(formData.get("amount")),
          category: formData.get("category"),
          period: formData.get("period"),
          start_date: formData.get("start_date"),
          end_date: formData.get("end_date"),
          status: formData.get("status")
        };

        const result = await updateBudget(id, budgetData);
        if (result.success) {
          return { success: "Budget updated successfully" };
        }
        return { error: result.error || "Failed to update budget" };
      }

      case "delete": {
        const id = formData.get("id");
        const result = await deleteBudget(id);
        if (result.success) {
          return { success: "Budget deleted successfully" };
        }
        return { error: result.error || "Failed to delete budget" };
      }

      case "assign": {
        const budgetId = formData.get("budgetId");
        const locationId = formData.get("locationId");
        const allocationPercent = parseFloat(formData.get("allocationPercent"));

        const result = await assignBudgetToLocation({
          budgetId,
          locationId,
          allocationPercent
        });
        if (result.success) {
          return { success: "Budget assigned to location successfully" };
        }
        return { error: result.error || "Failed to assign budget" };
      }

      default:
        return { error: "Invalid action" };
    }
  } catch (error) {
    console.error("Action error:", error);
    return { error: "An unexpected error occurred" };
  }
}
