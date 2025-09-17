# Shopify Metafields to Budget Categories Sync

## Overview
This system fetches product metafields from Shopify (specifically looking for "APEX GL Code Name" and similar GL code patterns) and automatically creates/updates budget categories in your database.

## Files Created

### 1. Route-based Sync: `app/routes/app.sync-metafields.jsx`
- **Purpose**: Shopify app route that fetches metafields and updates budget categories
- **Access**: Visit `/app/sync-metafields` in your Shopify app
- **Authentication**: Uses existing Shopify app authentication
- **Features**:
  - Fetches up to 250 products (10 pages × 25 products)
  - Analyzes all metafields to find GL code patterns
  - Updates `budget_categories_master` table automatically
  - Returns JSON response with results

### 2. Standalone Script: `shopify-metafields-sync.js`
- **Purpose**: Independent script for testing/manual sync
- **Requirements**: Admin API access token
- **Run**: `node shopify-metafields-sync.js`

## How It Works

### Metafield Patterns Detected
The system looks for these metafield patterns:
- `apex` + (`gl` or `code`) in key name
- Exact matches: `gl_code`, `apex_gl_code_name`, `apex_gl_code`
- Namespace contains `apex`
- General patterns: `gl_code`, `budget_code`, `account_code`

### Budget Category Creation
When GL codes are found, the system:
1. Groups products by GL code value
2. Creates budget categories named `GL-{code}`
3. Includes description with product types and vendors
4. Sets category as active with sort order 1000

### Database Updates
- **Table**: `brdjdb.shopify.budget_categories_master`
- **Operation**: MERGE (insert new, update existing)
- **Tracking**: Records source as `shopify_metafield_sync`

## Usage

### Option 1: Via Shopify App Route (Recommended)
1. Start your Shopify app development server
2. Navigate to `/app/sync-metafields` in your browser
3. View JSON response with sync results

### Option 2: Via Standalone Script (Requires API Token)
1. Add `SHOPIFY_ADMIN_API_ACCESS_TOKEN` to your `.env` file
2. Run: `node shopify-metafields-sync.js`

## Example Output

```json
{
  "success": true,
  "totalProducts": 150,
  "totalMetafieldTypes": 25,
  "glCodeMetafieldsFound": 12,
  "budgetCategoriesUpdated": 5,
  "metafieldSummary": [
    {
      "fullKey": "custom.apex_gl_code_name",
      "namespace": "custom",
      "key": "apex_gl_code_name",
      "type": "single_line_text_field",
      "productCount": 8,
      "sampleValues": ["4500", "4600"]
    }
  ],
  "glCodeDetails": [
    {
      "productTitle": "Hollister Ostomy Pouch",
      "productType": "Ostomy",
      "vendor": "Hollister",
      "metafieldKey": "custom.apex_gl_code_name",
      "glCodeValue": "4500"
    }
  ]
}
```

## Current Ostomy Category Mapping

Based on your database analysis:
- **Product Category**: "Ostomy" (55 products)
- **Current Budget Category**: "Gen Nsg>Urology & Ostomy" (ID: 9)
- **New GL-based Categories**: Will be created based on APEX GL codes found in metafields

## Next Steps

1. **Test the Route**: Visit `/app/sync-metafields` to see what metafields exist
2. **Review Results**: Check which GL codes are found
3. **Verify Budget Categories**: Query `budget_categories_master` to see new categories
4. **Schedule Regular Sync**: Consider adding this to a cron job or webhook

## Environment Variables Required

For route-based sync (recommended):
- No additional variables needed (uses existing Shopify app auth)

For standalone script:
- `SHOPIFY_ADMIN_API_ACCESS_TOKEN` - Admin API access token
- `SHOPIFY_APP_URL` - Your store URL

## Database Impact

New budget categories will be created with:
- `category_name`: "GL-{code}"
- `category_code`: The GL code value
- `description`: Product types and vendors using this code
- `sort_order`: 1000
- `is_active`: true
- `created_by`/`updated_by`: "shopify_metafield_sync"
