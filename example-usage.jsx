import mssql from '~/mssql.server.js';

export async function loader() {
  try {
    // Example: Get data from your external database
    const testData = await mssql.test.findMany();
    const testCount = await mssql.test.count();
    
    // Example: Get data from any table
    const customData = await mssql.table('test').select('id, message', 'WHERE id < @maxId', { maxId: 10 });
    
    // Example: Raw SQL query
    const rawResults = await mssql.query('SELECT TOP 5 * FROM test ORDER BY id DESC');
    
    return {
      testData,
      testCount,
      customData,
      rawResults,
    };
  } catch (error) {
    console.error('Database error:', error);
    return {
      error: 'Failed to load data from external database',
      testData: [],
      testCount: 0,
      customData: [],
      rawResults: [],
    };
  }
}

// Example component using the data
export default function ExternalDataPage() {
  const { testData, testCount, error } = useLoaderData();

  if (error) {
    return (
      <div className="error">
        <h2>Database Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h1>External MSSQL Database Data</h1>
      <p>Total records: {testCount}</p>
      
      <div>
        <h2>Test Data:</h2>
        {testData.length > 0 ? (
          <ul>
            {testData.map(item => (
              <li key={item.id}>
                ID: {item.id}, Message: {item.message}
              </li>
            ))}
          </ul>
        ) : (
          <p>No data found in test table</p>
        )}
      </div>
    </div>
  );
}
