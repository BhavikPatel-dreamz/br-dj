import '../app/mssql.server.js';
import { createBudgetCategory } from '../app/actions/budget-categories.server.js';

async function testCreate() {
  try {
    console.log('Testing budget category creation...');
    
    const result = await createBudgetCategory({
      category_name: 'Test Category ' + Date.now(),
      category_code: 'TEST' + Date.now(), 
      description: 'Test description',
      sort_order: 100,
      created_by: 'admin'
    });
    
    console.log('Create result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Test error:', error);
    console.error('Stack trace:', error.stack);
  }
  process.exit(0);
}

testCreate();
