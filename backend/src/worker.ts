/**
 * Background Worker
 * Continuously scans for runs with status "parsed" and processes them
 * 
 * Usage:
 *   npm run worker
 * 
 * Run this in a separate terminal from the main backend server
 */

import * as dataStore from './dataStore.js';
import { processBillRun } from './services/billProcessor.js';
import type { Run } from './types.js';

const SCAN_INTERVAL_MS = 2000; // 2 seconds between scans
const MAX_BATCH_SIZE = 5; // Process max 5 runs per scan

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process a single run
 */
async function processRun(run: Run): Promise<void> {
  try {
    console.log(`[Worker] Processing run ${run.id}...`);
    await processBillRun(run);
    console.log(`[Worker] Successfully processed run ${run.id}`);
  } catch (error: any) {
    console.error(`[Worker] Error processing run ${run.id}:`, error?.message || error);
    // Error is already handled in processBillRun, just log here
  }
}

/**
 * Scan for runs with status "parsed" and process them
 */
async function scanAndProcess(): Promise<void> {
  try {
    // Get all runs
    const allRuns = dataStore.readAllRuns();
    
    // Filter runs with status "parsed"
    const pendingRuns = allRuns.filter(run => run.status === 'parsed');
    
    if (pendingRuns.length === 0) {
      return; // No pending runs
    }
    
    console.log(`[Worker] Found ${pendingRuns.length} pending run(s) to process`);
    
    // Process up to MAX_BATCH_SIZE runs
    const runsToProcess = pendingRuns.slice(0, MAX_BATCH_SIZE);
    
    // Process runs in parallel (but limit concurrency)
    const promises = runsToProcess.map(run => processRun(run));
    await Promise.allSettled(promises);
    
  } catch (error: any) {
    console.error(`[Worker] Error in scan cycle:`, error?.message || error);
  }
}

/**
 * Main worker loop
 */
async function main(): Promise<void> {
  console.log('========================================');
  console.log('Background Worker Started');
  console.log(`Scan interval: ${SCAN_INTERVAL_MS}ms`);
  console.log(`Max batch size: ${MAX_BATCH_SIZE}`);
  console.log('========================================');
  console.log('');
  
  // Run continuously
  while (true) {
    await scanAndProcess();
    await sleep(SCAN_INTERVAL_MS);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Worker] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Worker] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the worker
main().catch((error) => {
  console.error('[Worker] Fatal error:', error);
  process.exit(1);
});


