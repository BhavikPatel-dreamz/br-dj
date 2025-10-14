# 🚀 Quick Start: Daily Product Sync with PM2

## Step 1: Start the Cron Job with PM2

```bash
pm2 start ecosystem.config.cjs
```

## Step 2: Verify it's Running

```bash
pm2 list
```

You should see:
```
┌─────┬──────────────────────┬─────────────┬─────────┬─────────┐
│ id  │ name                 │ mode        │ ↺       │ status  │
├─────┼──────────────────────┼─────────────┼─────────┼─────────┤
│ 0   │ product-sync-cron    │ fork        │ 0       │ online  │
└─────┴──────────────────────┴─────────────┴─────────┴─────────┘
```

## Step 3: View Logs

```bash
# Real-time logs
pm2 logs product-sync-cron

# View last 50 lines
pm2 logs product-sync-cron --lines 50
```

## Step 4: Save Configuration (Optional - for auto-start on reboot)

```bash
# Save the PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Then run the command it gives you (usually needs sudo)
```

---

## 📅 Default Schedule

The cron job runs **daily at 2:00 AM** by default.

To change the schedule, add this to your `.env` file:

```env
# Run daily at 3:00 AM
PRODUCT_SYNC_CRON="0 3 * * *"

# Run every 6 hours
PRODUCT_SYNC_CRON="0 */6 * * *"

# Run every day at 1:30 PM
PRODUCT_SYNC_CRON="30 13 * * *"
```

Then restart:
```bash
pm2 restart product-sync-cron --update-env
```

---

## 🎯 Common Commands

| Command | Description |
|---------|-------------|
| `pm2 start ecosystem.config.cjs` | Start the cron job |
| `pm2 stop product-sync-cron` | Stop the cron job |
| `pm2 restart product-sync-cron` | Restart the cron job |
| `pm2 delete product-sync-cron` | Remove the cron job |
| `pm2 logs product-sync-cron` | View live logs |
| `pm2 monit` | Monitor dashboard |
| `pm2 status` | Check status |

---

## 🧪 Test the Sync Manually

```bash
# Test the cron script (won't run the actual sync, just shows schedule)
npm run cron

# Or directly:
node scripts/daily-product-sync-cron.js
```

To test the actual sync immediately:
```bash
node scripts/shopify-metafields-sync.js
```

---

## 📊 What Happens?

1. **PM2 starts** the cron job script
2. **Cron waits** until the scheduled time (default: 2:00 AM daily)
3. **At scheduled time**, it runs `node scripts/shopify-metafields-sync.js`
4. **Logs everything** to `logs/pm2-product-sync-out.log`
5. **Auto-restarts** if it crashes
6. **Repeats daily** automatically

---

## ✅ You're Done!

The product sync will now run automatically every day. PM2 keeps it running in the background.

**Need help?** Check `scripts/README-CRON.md` for detailed documentation.
