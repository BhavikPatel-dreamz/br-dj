// Simple file-based budget storage
import { promises as fs } from 'fs';
import { join } from 'path';

const STORAGE_DIR = join(process.cwd(), 'data');
const BUDGETS_FILE = join(STORAGE_DIR, 'budgets.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

// Load budgets from file
export async function loadBudgets() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(BUDGETS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty array
      return [];
    }
    throw error;
  }
}

// Save budgets to file
export async function saveBudgets(budgets) {
  await ensureDataDir();
  await fs.writeFile(BUDGETS_FILE, JSON.stringify(budgets, null, 2));
}

// Get all budgets
export async function getBudgets() {
  try {
    let budgets = await loadBudgets();
    
    // Initialize with sample data if empty
    if (budgets.length === 0) {
      console.log('🔄 Initializing with sample budget data...');
      budgets = [
        {
          id: "1",
          name: "Q4 2024 Medical Supplies Budget",
          categories: {
            "Gen Nsg>Medical Supplies": "15000",
            "Gen Nsg>Incontinent Supplies": "8000",
            "Gen Nsg>Wound Care": "5000"
          },
          totalAmount: 28000,
          createdAt: new Date("2024-09-01").toISOString(),
          updatedAt: new Date("2024-09-15").toISOString(),
          createdBy: "system",
          status: "active"
        },
        {
          id: "2",
          name: "Annual Capital Equipment Budget",
          categories: {
            "Capital>Fixed Equip": "50000",
            "Capital>Major Moveable Equip": "25000",
            "Capital>Leasehold Improvements": "15000"
          },
          totalAmount: 90000,
          createdAt: new Date("2024-08-15").toISOString(),
          updatedAt: new Date("2024-09-10").toISOString(),
          createdBy: "system",
          status: "active"
        }
      ];
      
      await saveBudgets(budgets);
      console.log('✅ Sample budget data initialized');
    }
    
    return budgets;
  } catch (error) {
    console.error('Error loading budgets:', error);
    return [];
  }
}

// Create a new budget
export async function createBudget(budgetData) {
  try {
    const budgets = await loadBudgets();
    
    // Calculate total amount from categories
    let totalAmount = 0;
    if (budgetData.categories && typeof budgetData.categories === 'object') {
      totalAmount = Object.values(budgetData.categories).reduce((sum, amount) => {
        return sum + (parseFloat(amount) || 0);
      }, 0);
    }

    const newBudget = {
      id: Date.now().toString(),
      name: budgetData.name,
      categories: budgetData.categories,
      totalAmount: totalAmount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: budgetData.createdBy || 'user',
      status: budgetData.status || 'active'
    };

    budgets.push(newBudget);
    await saveBudgets(budgets);
    
    console.log('✅ Budget created:', newBudget.name, '- Total: $' + totalAmount);
    return newBudget;
  } catch (error) {
    console.error('Error creating budget:', error);
    throw error;
  }
}

// Find budget by ID
export async function getBudgetById(id) {
  const budgets = await loadBudgets();
  return budgets.find(budget => budget.id === id.toString());
}

// Update budget
export async function updateBudget(id, updateData) {
  try {
    const budgets = await loadBudgets();
    const index = budgets.findIndex(budget => budget.id === id.toString());
    
    if (index === -1) {
      throw new Error(`Budget with id ${id} not found`);
    }

    // Calculate new total if categories changed
    let totalAmount = budgets[index].totalAmount;
    if (updateData.categories && typeof updateData.categories === 'object') {
      totalAmount = Object.values(updateData.categories).reduce((sum, amount) => {
        return sum + (parseFloat(amount) || 0);
      }, 0);
    }

    budgets[index] = {
      ...budgets[index],
      ...updateData,
      totalAmount: totalAmount,
      updatedAt: new Date().toISOString()
    };

    await saveBudgets(budgets);
    return budgets[index];
  } catch (error) {
    console.error('Error updating budget:', error);
    throw error;
  }
}

// Delete budget
export async function deleteBudget(id) {
  try {
    const budgets = await loadBudgets();
    const filteredBudgets = budgets.filter(budget => budget.id !== id.toString());
    
    if (filteredBudgets.length === budgets.length) {
      throw new Error(`Budget with id ${id} not found`);
    }

    await saveBudgets(filteredBudgets);
    return true;
  } catch (error) {
    console.error('Error deleting budget:', error);
    throw error;
  }
}
