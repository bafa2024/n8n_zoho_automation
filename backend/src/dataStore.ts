import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Run } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RUNS_PATH = path.join(__dirname, "../data/runs.json");

/**
 * Ensure the data directory exists
 */
function ensureDataDir(): void {
  const dataDir = path.dirname(RUNS_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * Read all runs from the JSON file
 * Returns empty array if file doesn't exist or is invalid
 */
export function readAllRuns(): Run[] {
  try {
    if (!fs.existsSync(RUNS_PATH)) {
      return [];
    }
    
    const data = fs.readFileSync(RUNS_PATH, "utf8");
    if (!data.trim()) {
      return [];
    }
    
    const runs = JSON.parse(data);
    
    // Ensure it's an array
    if (!Array.isArray(runs)) {
      console.warn("runs.json is not an array, initializing empty array");
      return [];
    }
    
    return runs;
  } catch (err) {
    console.error("Error reading runs.json:", err);
    return [];
  }
}

/**
 * Write all runs to the JSON file
 * Sorts runs by 'when' field (newest first) before writing
 */
export function writeAllRuns(runs: Run[]): void {
  try {
    ensureDataDir();
    
    // Sort by 'when' field (newest first)
    const sorted = [...runs].sort((a, b) => {
      const timeA = new Date(a.when).getTime();
      const timeB = new Date(b.when).getTime();
      return timeB - timeA; // Descending order (newest first)
    });
    
    fs.writeFileSync(RUNS_PATH, JSON.stringify(sorted, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing runs.json:", err);
    throw err;
  }
}

/**
 * Save a new run to the file
 * Adds to the beginning (newest first) and saves
 */
export function saveRun(run: Run): void {
  const runs = readAllRuns();
  runs.unshift(run); // Add to beginning
  writeAllRuns(runs);
}

/**
 * Update an existing run by ID
 * @param id Run ID to update
 * @param patch Partial run object with fields to update
 * @returns true if run was found and updated, false otherwise
 */
export function updateRun(id: string, patch: Partial<Run>): boolean {
  const runs = readAllRuns();
  const index = runs.findIndex((r) => r.id === id);
  
  if (index === -1) {
    console.warn(`Run ${id} not found in runs.json`);
    return false;
  }
  
  runs[index] = { ...runs[index], ...patch };
  writeAllRuns(runs);
  console.log(`Updated run ${id} in runs.json`);
  return true;
}

/**
 * List runs with pagination
 * Returns runs sorted newest-first
 * @param limit Maximum number of runs to return
 * @returns Object with runs array and nextCursor
 */
export function listRuns(limit: number = 20): { runs: Run[]; nextCursor: number | null } {
  const runs = readAllRuns();
  
  // Runs are already sorted newest-first from readAllRuns
  const slice = runs.slice(0, limit);
  
  return {
    runs: slice,
    nextCursor: slice.length === limit && runs.length > limit ? limit : null
  };
}

/**
 * Get a single run by ID
 * @param id Run ID to find
 * @returns Run object or null if not found
 */
export function getRunById(id: string): Run | null {
  const runs = readAllRuns();
  const run = runs.find((r) => r.id === id);
  return run || null;
}



