import { compareTwoStrings, findBestMatch } from 'string-similarity';

/**
 * Fuzzy Matching Utilities
 * Provides fuzzy matching for vendors and items using multiple fields
 */

/**
 * Similarity threshold for matching (0.0 to 1.0)
 * 0.8 = 80% similarity required
 */
const SIMILARITY_THRESHOLD = 0.8;

/**
 * Normalize string for comparison
 */
function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Calculate combined similarity score from multiple fields
 */
function calculateCombinedSimilarity(
  source: Record<string, string | null | undefined>,
  target: Record<string, string | null | undefined>,
  weights: Record<string, number>
): number {
  let totalWeight = 0;
  let weightedScore = 0;

  for (const [field, weight] of Object.entries(weights)) {
    const sourceValue = normalizeString(source[field]);
    const targetValue = normalizeString(target[field]);

    if (sourceValue && targetValue) {
      const similarity = compareTwoStrings(sourceValue, targetValue);
      weightedScore += similarity * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? weightedScore / totalWeight : 0;
}

/**
 * Fuzzy match vendor by name, GST, and address
 * @param vendorData Vendor data from PDF (name, gst, address)
 * @param candidates Array of existing vendors from Zoho
 * @returns Matched vendor or null
 */
export function fuzzyMatchVendor(
  vendorData: {
    name: string;
    gst?: string | null;
    address?: string | null;
  },
  candidates: Array<{
    vendor_id?: string;
    vendor_name?: string;
    gstin?: string;
    billing_address?: string;
    [key: string]: any;
  }>
): { vendor_id: string; similarity: number } | null {
  if (candidates.length === 0) return null;

  // Normalize vendor data
  const normalizedVendor = {
    name: normalizeString(vendorData.name),
    gst: normalizeString(vendorData.gst),
    address: normalizeString(vendorData.address),
  };

  // Calculate similarity for each candidate
  const matches = candidates.map((candidate) => {
    const candidateData = {
      name: normalizeString(candidate.vendor_name),
      gst: normalizeString(candidate.gstin),
      address: normalizeString(candidate.billing_address),
    };

    // Field weights: name is most important, then GST, then address
    const weights = {
      name: 0.5,
      gst: 0.3,
      address: 0.2,
    };

    const similarity = calculateCombinedSimilarity(normalizedVendor, candidateData, weights);

    // Bonus for exact GST match (if both have GST)
    if (normalizedVendor.gst && candidateData.gst && normalizedVendor.gst === candidateData.gst) {
      return { candidate, similarity: 1.0 }; // Exact GST match = 100% match
    }

    return { candidate, similarity };
  });

  // Find best match
  const bestMatch = matches.reduce((best, current) => {
    return current.similarity > best.similarity ? current : best;
  }, matches[0]);

  // Return if similarity meets threshold
  if (bestMatch.similarity >= SIMILARITY_THRESHOLD && bestMatch.candidate.vendor_id) {
    return {
      vendor_id: bestMatch.candidate.vendor_id,
      similarity: bestMatch.similarity,
    };
  }

  return null;
}

/**
 * Fuzzy match item by name, SKU, sales description, and purchase description
 * @param itemData Item data from PDF (name, sku, salesDesc, purchaseDesc)
 * @param candidates Array of existing items from Zoho
 * @returns Matched item or null
 */
export function fuzzyMatchItem(
  itemData: {
    name: string;
    sku?: string | null;
    salesDesc?: string | null;
    purchaseDesc?: string | null;
  },
  candidates: Array<{
    item_id?: string;
    name?: string;
    sku?: string;
    sales_description?: string;
    purchase_description?: string;
    [key: string]: any;
  }>
): { item_id: string; similarity: number } | null {
  if (candidates.length === 0) return null;

  // Normalize item data
  const normalizedItem = {
    name: normalizeString(itemData.name),
    sku: normalizeString(itemData.sku),
    salesDesc: normalizeString(itemData.salesDesc),
    purchaseDesc: normalizeString(itemData.purchaseDesc),
  };

  // Calculate similarity for each candidate
  const matches = candidates.map((candidate) => {
    const candidateData = {
      name: normalizeString(candidate.name),
      sku: normalizeString(candidate.sku),
      salesDesc: normalizeString(candidate.sales_description),
      purchaseDesc: normalizeString(candidate.purchase_description),
    };

    // Field weights: SKU is most important (exact match), then name, then descriptions
    const weights = {
      sku: 0.4,
      name: 0.4,
      salesDesc: 0.1,
      purchaseDesc: 0.1,
    };

    const similarity = calculateCombinedSimilarity(normalizedItem, candidateData, weights);

    // Bonus for exact SKU match (if both have SKU)
    if (normalizedItem.sku && candidateData.sku && normalizedItem.sku === candidateData.sku) {
      return { candidate, similarity: 1.0 }; // Exact SKU match = 100% match
    }

    return { candidate, similarity };
  });

  // Find best match
  const bestMatch = matches.reduce((best, current) => {
    return current.similarity > best.similarity ? current : best;
  }, matches[0]);

  // Return if similarity meets threshold
  if (bestMatch.similarity >= SIMILARITY_THRESHOLD && bestMatch.candidate.item_id) {
    return {
      item_id: bestMatch.candidate.item_id,
      similarity: bestMatch.similarity,
    };
  }

  return null;
}

/**
 * Extract supplier initials from vendor name
 * @param vendorName Vendor name (e.g., "ABC Corporation" -> "ABC")
 * @returns Supplier initials (uppercase, max 3-4 chars)
 */
export function extractSupplierInitials(vendorName: string): string {
  if (!vendorName) return '';

  // Remove common suffixes
  const cleaned = vendorName
    .replace(/\b(Inc|LLC|Ltd|Corp|Corporation|Company|Co|Pvt|Private|Limited)\b/gi, '')
    .trim();

  // Extract first letters of words
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length === 0) return '';

  // If single word, take first 3-4 uppercase letters
  if (words.length === 1) {
    return words[0].substring(0, 4).toUpperCase();
  }

  // Multiple words: take first letter of each word (max 3-4 letters total)
  const initials = words
    .slice(0, 4) // Max 4 words
    .map(w => w[0].toUpperCase())
    .join('');

  return initials.substring(0, 4); // Max 4 characters
}

/**
 * Generate SKU with supplier initials suffix
 * @param itemCode Original item code/SKU from PDF
 * @param supplierInitials Supplier initials to append
 * @returns Generated SKU: {itemCode}-{supplierInitials}
 */
export function generateSKUWithSupplier(itemCode: string | null | undefined, supplierInitials: string): string {
  const baseCode = (itemCode || '').trim().toUpperCase();
  const initials = supplierInitials.trim().toUpperCase();

  if (!baseCode) {
    // If no item code, generate one
    return `ITEM-${initials}-${Date.now().toString().slice(-6)}`;
  }

  // Format: ITEMCODE-SUPPLIER
  return `${baseCode}-${initials}`;
}


