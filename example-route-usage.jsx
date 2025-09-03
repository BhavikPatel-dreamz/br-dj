// Example usage in a Remix route
import { json } from "@remix-run/node";
import mssql from "~/mssql.server.js";

export async function loader() {
  try {
    // Example: Get data from your external MSSQL database
    const testData = await mssql.test.findMany();
    const testCount = await mssql.test.count();
    
    // Example: Custom SQL query
    const customQuery = await mssql.query(`
      SELECT TOP 10 * 
      FROM test 
      WHERE id > @minId 
      ORDER BY id DESC
    `, { minId: 0 });
    
    return json({
      success: true,
      data: {
        testData,
        testCount,
        customQuery,
      }
    });
    
  } catch (error) {
    console.error('Database error:', error);
    return json({
      success: false,
      error: 'Failed to connect to external database',
      data: null
    }, { status: 500 });
  }
}

export default function DatabaseExample() {
  const { success, data, error } = useLoaderData();

  if (!success) {
    return (
      <div className="error">
        <h2>Database Connection Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h1>External MSSQL Database Connection</h1>
      <div>
        <h2>Statistics</h2>
        <p>Total records in test table: {data.testCount}</p>
      </div>
      
      <div>
        <h2>Recent Data</h2>
        {data.testData.length > 0 ? (
          <ul>
            {data.testData.map((item) => (
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
