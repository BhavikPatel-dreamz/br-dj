#!/usr/bin/env node

/**
 * Test Script for Backup Functionality
 * Tests the backup storage by making API calls for the last 10 days
 * 
 * Usage:
 *   node scripts/test-backup-storage.js <locationId>
 * 
 * Example:
 *   node scripts/test-backup-storage.js 2348220643
 */

const locationId = process.argv[2];

if (!locationId) {
  console.error('\n❌ Error: Location ID is required');
  console.log('\nUsage:');
  console.log('  node scripts/test-backup-storage.js <locationId>');
  console.log('\nExample:');
  console.log('  node scripts/test-backup-storage.js 2348220643\n');
  process.exit(1);
}

console.log(`\n${'='.repeat(60)}`);
console.log('Testing Backup Storage for Last 10 Days');
console.log(`Location: ${locationId}`);
console.log(`${'='.repeat(60)}\n`);

// Generate last 10 days dates
const dates = [];
for (let i = 0; i < 10; i++) {
  const date = new Date();
  date.setDate(date.getDate() - i);
  dates.push(date);
}

console.log('Dates to process:');
dates.forEach((date, idx) => {
  console.log(`  ${idx + 1}. ${date.toISOString().split('T')[0]}`);
});

console.log(`\n${'='.repeat(60)}`);
console.log('Note: This is a test script that shows which dates would be processed.');
console.log('To actually trigger backups, make API calls to:');
console.log('\nGET /api/monthly-orders-by-category');
console.log('  ?locationId=<locationId>');
console.log('  &month=<MM>');
console.log('  &year=<YYYY>');
console.log('  &signature=<signature>');
console.log(`\n${'='.repeat(60)}`);

console.log('\nBackup files will be stored in:');
dates.forEach(date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dateStr = date.toISOString().split('T')[0];
  console.log(`  data/daily-backups/${year}/${month}/${locationId}/${dateStr}.json`);
});

console.log(`\n${'='.repeat(60)}\n`);
