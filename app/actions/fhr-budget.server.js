// Budget Management Server Actions
// This file will handle all budget-related database operations

/**
 * Get all budgets
 * @returns {Array} Array of budget objects
 */
export async function getBudgets() {
  try {
    // TODO: Replace with actual database query
    // Example using Prisma or your preferred ORM:
    /*
    const budgets = await prisma.budget.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return budgets;
    */

    // Mock data for now
    const mockBudgets = [
      {
        id: "1",
        name: "Q4 2024 Medical Supplies Budget",
        categories: {
          "Gen Nsg>Medical Supplies": "15000",
          "Gen Nsg>Incontinent Supplies": "8000",
          "Gen Nsg>Wound Care": "5000"
        },
        createdAt: new Date("2024-09-01"),
        updatedAt: new Date("2024-09-15")
      },
      {
        id: "2",
        name: "Annual Capital Equipment Budget",
        categories: {
          "Capital>Fixed Equip": "50000",
          "Capital>Major Moveable Equip": "25000",
          "Capital>Leasehold Improvements": "15000"
        },
        createdAt: new Date("2024-08-15"),
        updatedAt: new Date("2024-09-10")
      },
      {
        id: "3",
        name: "Housekeeping & Maintenance Budget",
        categories: {
          "Housekeeping>Minor Equip": "3000",
          "Housekeeping>Supplies": "8000",
          "Maintenance>Supplies": "6000",
          "Maintenance>Minor Equip": "4000"
        },
        createdAt: new Date("2024-08-01"),
        updatedAt: new Date("2024-09-05")
      }
    ];

    return mockBudgets;
  } catch (error) {
    console.error("Error fetching budgets:", error);
    throw new Error("Failed to fetch budgets");
  }
}

/**
 * Create a new budget
 * @param {Object} budgetData - Budget data to create
 * @returns {Object} Created budget object
 */
export async function createBudget(budgetData) {
  try {
    // TODO: Replace with actual database insert
    /*
    const budget = await prisma.budget.create({
      data: {
        name: budgetData.name,
        categories: budgetData.categories
      }
    });

    return budget;
    */

    // Mock creation for now
    const newBudget = {
      id: Date.now().toString(),
      name: budgetData.name,
      categories: budgetData.categories,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log("Created budget:", newBudget);
    return newBudget;
  } catch (error) {
    console.error("Error creating budget:", error);
    throw new Error("Failed to create budget");
  }
}
