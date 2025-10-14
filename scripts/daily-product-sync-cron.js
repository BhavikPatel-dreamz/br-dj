import 'dotenv/config';
import { scheduleJob } from 'node-schedule';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure when to run the sync (default: daily at 2:00 AM)
const CRON_SCHEDULE = process.env.PRODUCT_SYNC_CRON || '0 2 * * *'; // minute hour day month dayOfWeek

console.log('🕐 Product Sync Cron Job Starting...');
console.log('═'.repeat(80));
console.log(`📅 Schedule: ${CRON_SCHEDULE}`);
console.log(`🔄 Next run will execute: node scripts/shopify-metafields-sync.js`);
console.log('═'.repeat(80));

// Function to run the sync script
function runSync() {
  const startTime = new Date();
  console.log(`\n🚀 Starting product sync at ${startTime.toISOString()}`);
  console.log('─'.repeat(80));

  const syncScriptPath = join(__dirname, 'shopify-metafields-sync.js');
  
  // Spawn the sync process
  const syncProcess = spawn('node', [syncScriptPath], {
    stdio: 'inherit', // This will pipe output to the parent process
    env: process.env
  });

  syncProcess.on('error', (error) => {
    console.error('❌ Failed to start sync process:', error);
  });

  syncProcess.on('exit', (code) => {
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000; // in seconds
    
    console.log('─'.repeat(80));
    if (code === 0) {
      console.log(`✅ Product sync completed successfully at ${endTime.toISOString()}`);
      console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    } else {
      console.error(`❌ Product sync failed with exit code ${code} at ${endTime.toISOString()}`);
      console.error(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    }
    console.log('─'.repeat(80));
  });
}

// Schedule the job
const job = scheduleJob(CRON_SCHEDULE, () => {
  console.log('\n⏰ Cron trigger fired!');
  runSync();
});

// Verify job was scheduled
if (job) {
  const nextInvocation = job.nextInvocation();
  console.log(`✅ Cron job scheduled successfully!`);
  console.log(`⏭️  Next run: ${nextInvocation ? nextInvocation.toISOString() : 'N/A'}`);
  console.log('\n💡 Press Ctrl+C to stop the cron job\n');
} else {
  console.error('❌ Failed to schedule cron job. Please check your cron expression.');
  process.exit(1);
}

// Optional: Run sync immediately on startup (comment out if not needed)
// Uncomment the line below if you want to run sync on startup
// setTimeout(() => runSync(), 5000); // Run 5 seconds after startup

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down cron job...');
  if (job) {
    job.cancel();
    console.log('✅ Cron job cancelled successfully');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Received SIGTERM, shutting down...');
  if (job) {
    job.cancel();
  }
  process.exit(0);
});
