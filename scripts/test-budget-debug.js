import { getBudgets, getBudgetCategories, getAvailableLocations, getBudgetStats } from '../app/actions/fhr-budget.server.js';

async function testBudgetFunctions() {
  console.log('🔍 Testing budget functions...');
  
  try {
    console.log('\n1. Testing getBudgets()...');
    const budgets = await getBudgets();
    console.log('✅ getBudgets() - Success:', budgets ? `${budgets.length} budgets found` : 'No budgets');
  } catch (error) {
    console.error('❌ getBudgets() - Error:', error.message);
  }

  try {
    console.log('\n2. Testing getBudgetCategories()...');
    const categories = await getBudgetCategories();
    console.log('✅ getBudgetCategories() - Success:', categories ? `${categories.length} categories found` : 'No categories');
  } catch (error) {
    console.error('❌ getBudgetCategories() - Error:', error.message);
  }

  try {
    console.log('\n3. Testing getAvailableLocations()...');
    const locations = await getAvailableLocations();
    console.log('✅ getAvailableLocations() - Success:', locations ? `${locations.length} locations found` : 'No locations');
  } catch (error) {
    console.error('❌ getAvailableLocations() - Error:', error.message);
  }

  try {
    console.log('\n4. Testing getBudgetStats()...');
    const stats = await getBudgetStats();
    console.log('✅ getBudgetStats() - Success:', stats ? 'Stats retrieved' : 'No stats');
  } catch (error) {
    console.error('❌ getBudgetStats() - Error:', error.message);
  }
}

testBudgetFunctions().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
