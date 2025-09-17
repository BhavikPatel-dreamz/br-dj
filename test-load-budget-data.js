import { loadBudgetData } from './app/actions/budget-management.server.js';

async function testLoadBudgetData() {
  console.log('🔍 Testing loadBudgetData function...');
  
  try {
    const result = await loadBudgetData({ 
      page: 1, 
      limit: 10, 
      search: "", 
      category: "", 
      view: "budgets", 
      includeBudgetStats: true 
    });
    
    console.log('✅ loadBudgetData - Success!');
    console.log('Result structure:');
    console.log('- budgets:', result.budgets ? `${result.budgets.length} items` : 'null');
    console.log('- totalBudgets:', result.totalBudgets);
    console.log('- currentPage:', result.currentPage);
    console.log('- totalPages:', result.totalPages);
    console.log('- categories:', result.categories ? `${result.categories.length} items` : 'null');
    console.log('- locations:', result.locations ? `${result.locations.length} items` : 'null');
    console.log('- budgetStats:', result.budgetStats ? 'Available' : 'null');
    console.log('- error:', result.error || 'None');
    
    if (result.budgets && result.budgets.length > 0) {
      console.log('\nSample budget from loadBudgetData:', result.budgets[0]);
    }
  } catch (error) {
    console.error('❌ loadBudgetData - Error:', error.message);
  }
}

testLoadBudgetData().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
