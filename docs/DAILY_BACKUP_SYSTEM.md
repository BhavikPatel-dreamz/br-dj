# Daily Backup System for Monthly Orders API

## Overview

The `api.monthly-orders-by-category` endpoint now automatically stores JSON responses as backup files organized by date and location. This provides a reliable data backup and quick access to historical data without database queries.

## Features

✅ **Automatic Backup Storage** - Every API call automatically saves a backup  
✅ **Skip Existing Files** - If backup exists, it skips to avoid duplicates  
✅ **Auto-Cleanup** - Keeps only last 10 days of backups  
✅ **Non-Blocking** - Backup operations don't slow down API responses  
✅ **Organized Structure** - Files organized by year/month/location/date  

## Backup File Structure

```
data/daily-backups/
├── 2025/
│   ├── 11/
│   │   ├── 2348220643/          (Location ID)
│   │   │   ├── 2025-11-01.json
│   │   │   ├── 2025-11-02.json
│   │   │   ├── 2025-11-03.json
│   │   │   └── ...
│   │   └── 2348220644/          (Another Location)
│   │       └── ...
│   └── 12/
│       └── ...
```

## Backup File Format

Each backup file contains:

```json
{
  "metadata": {
    "date": "2025-11-01",
    "locationId": "2348220643",
    "generatedAt": "2025-11-12T10:30:00.000Z",
    "dataType": "monthly-orders-by-category"
  },
  "success": true,
  "error": null,
  "data": {
    "categories": [...],
    "allProducts": [...],
    "summary": {
      "totalOrders": 150,
      "ordersWithRefunds": 5,
      "totalCategories": 12,
      "grossValue": 45000.00,
      "refundedValue": 500.00,
      "totalValue": 44500.00,
      "refundRate": 0.011,
      "month": "11",
      "year": "2025",
      ...
    }
  }
}
```

## How It Works

### Automatic Backup on API Call

Every time the API endpoint is called with a `locationId` or `companyLocationId`:

1. **Check if backup exists** for that date and location
2. **Skip if exists** - Logs "Backup already exists, skipping"
3. **Save if new** - Saves JSON file asynchronously
4. **Cleanup old files** - Randomly runs cleanup (10% chance per request)

### Example API Call

```bash
GET /api/monthly-orders-by-category?locationId=2348220643&month=11&year=2025&signature=...
```

This will:
- Return the API response immediately
- Save backup to `data/daily-backups/2025/11/2348220643/2025-11-01.json`
- Skip if file already exists

## Console Logs

When using the API, you'll see logs like:

```
✓ Backup saved: /path/to/data/daily-backups/2025/11/2348220643/2025-11-01.json
📦 Backup queued for 2025-11-01 - Location 2348220643
```

Or if already exists:

```
⏭️  Backup already exists for 2025-11-01 - Location 2348220643, skipping
```

When cleanup runs:

```
🗑️  Cleaned 15 old backup files (keeping last 10 days)
```

## Configuration

You can adjust settings in the file:

```javascript
const BACKUP_BASE_DIR = path.join(process.cwd(), 'data', 'daily-backups');
const DAYS_TO_KEEP = 10;  // Change to keep more/fewer days
```

## Manual Cleanup

To manually clean old backups, you can create a simple script:

```javascript
import { cleanOldBackups } from '../app/utils/json-storage.server.js';
await cleanOldBackups();
```

## Retrieving Backup Data

To read a backup file:

```javascript
import fs from 'fs/promises';

const backupPath = 'data/daily-backups/2025/11/2348220643/2025-11-01.json';
const data = JSON.parse(await fs.readFile(backupPath, 'utf8'));

console.log(data.data.summary.totalOrders); // Access the data
```

## Benefits

1. **Fast Historical Data** - No database queries needed for recent data
2. **Data Recovery** - Backup if database issues occur
3. **Audit Trail** - Track what data was returned for each day
4. **Offline Analysis** - Export JSON files for analysis
5. **Reduced Database Load** - Can serve from files instead of queries

## Notes

- Backups are stored for **locationId** or **companyLocationId** queries only
- If neither is provided, no backup is saved
- Backup operations are **asynchronous** and don't block API responses
- Failed backups are logged but don't affect API functionality
- Cleanup runs randomly (10% chance) to avoid overhead on every request

## Testing

Test the backup system:

```bash
node scripts/test-backup-storage.js 2348220643
```

This will show which files would be created for the last 10 days.

## Troubleshooting

### Backups not being created

1. Check write permissions on `data/daily-backups/` directory
2. Check console logs for error messages
3. Ensure `locationId` or `companyLocationId` is provided in API call

### Too many old files

1. Files older than 10 days should auto-delete
2. Manually run cleanup if needed
3. Check `DAYS_TO_KEEP` setting

### Large backup files

1. Each file contains full category and product data
2. Consider compressing old backups (gzip)
3. Adjust `DAYS_TO_KEEP` to reduce storage

---

**Last Updated:** November 12, 2025  
**API Version:** 1.0  
**Feature:** Automatic Daily Backups
