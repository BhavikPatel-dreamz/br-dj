module.exports = {
  apps: [
    {
      name: 'product-sync-cron',
      script: './scripts/daily-product-sync-cron.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-product-sync-error.log',
      out_file: './logs/pm2-product-sync-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Cron restart if needed (optional - keeps the cron job running)
      cron_restart: '0 0 * * *', // Restart the cron job daily at midnight
      min_uptime: '10s',
      max_restarts: 10
    }
  ]
};
