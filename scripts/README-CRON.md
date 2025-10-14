# Daily Product Sync Cron Job

This cron job automatically syncs Shopify product metafields daily using PM2.

## 📋 Requirements

```bash
npm install node-schedule
npm install -g pm2
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install node-schedule
```

### 2. Start with PM2
```bash
# Start the cron job
pm2 start ecosystem.config.cjs

# View logs
pm2 logs product-sync-cron

# Check status
pm2 status

# Stop the cron job
pm2 stop product-sync-cron

# Restart the cron job
pm2 restart product-sync-cron

# Remove the cron job
pm2 delete product-sync-cron
```

### 3. Save PM2 Configuration (Auto-start on server reboot)
```bash
# Save the current PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the command it gives you (usually needs sudo)
```

## ⚙️ Configuration

### Change Sync Schedule

Edit the `.env` file to customize the cron schedule:

```env
# Default: Daily at 2:00 AM
PRODUCT_SYNC_CRON="0 2 * * *"

# Examples:
# Every day at 3:00 AM
PRODUCT_SYNC_CRON="0 3 * * *"

# Every day at 1:30 PM
PRODUCT_SYNC_CRON="30 13 * * *"

# Every 6 hours
PRODUCT_SYNC_CRON="0 */6 * * *"

# Every Monday at 2:00 AM
PRODUCT_SYNC_CRON="0 2 * * 1"
```

### Cron Format
```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of Week (0-7, 0 and 7 are Sunday)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of Month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### Common Cron Patterns
- `0 2 * * *` - Daily at 2:00 AM
- `0 */6 * * *` - Every 6 hours
- `30 13 * * *` - Daily at 1:30 PM
- `0 0 * * 1` - Every Monday at midnight
- `0 0 1 * *` - First day of every month at midnight

## 📊 Monitoring

### View Real-time Logs
```bash
pm2 logs product-sync-cron --lines 100
```

### View Log Files
```bash
# Error logs
tail -f logs/pm2-product-sync-error.log

# Output logs
tail -f logs/pm2-product-sync-out.log
```

### PM2 Monitoring Dashboard
```bash
pm2 monit
```

### Web-based Monitoring (Optional)
```bash
pm2 plus
```

## 🔧 Manual Sync

If you need to run a sync manually outside the schedule:

```bash
# Full sync
node scripts/shopify-metafields-sync.js

# Sync specific product
node scripts/shopify-metafields-sync.js 7897897987
```

## 🛠️ Troubleshooting

### Check if cron job is running
```bash
pm2 list
```

### Check logs for errors
```bash
pm2 logs product-sync-cron --err
```

### Restart if stuck
```bash
pm2 restart product-sync-cron
```

### Check environment variables
```bash
pm2 env product-sync-cron
```

### Update cron job after code changes
```bash
pm2 restart product-sync-cron --update-env
```

## 📝 Notes

- The cron job runs in the background and automatically executes the product sync at the scheduled time
- Logs are stored in the `logs/` directory
- PM2 will automatically restart the cron job if it crashes
- The cron job itself is lightweight and only spawns the sync process when scheduled
- PM2 can be configured to start automatically on server reboot

## 🔄 Updating

After making changes to the cron script:

```bash
pm2 restart product-sync-cron
```

## 🗑️ Uninstall

```bash
# Stop and remove from PM2
pm2 stop product-sync-cron
pm2 delete product-sync-cron
pm2 save

# Remove dependencies (optional)
npm uninstall node-schedule
```
