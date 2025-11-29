import axios, { AxiosInstance, AxiosError } from 'axios';
import type { Run } from '../types.js';
import { fuzzyMatchVendor, fuzzyMatchItem, extractSupplierInitials, generateSKUWithSupplier } from '../lib/fuzzyMatch.js';

/**
 * Zoho Books API Client
 * Handles vendor, item, and bill creation in Zoho Books
 */

// Environment variables
const ZB_BASE_URL = process.env.ZB_BASE_URL || process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com';
const ZB_ORG_ID = process.env.ZB_ORG_ID || process.env.ZOHO_ORG_ID || '';
const ZB_ACCESS_TOKEN = process.env.ZB_ACCESS_TOKEN || process.env.ZOHO_ACCESS_TOKEN || '';

/**
 * Create axios instance with Zoho Books headers
 */
function createZohoClient(accessToken: string, orgId: string): AxiosInstance {
  const baseURL = ZB_BASE_URL.replace(/\/+$/, '');
  
  return axios.create({
    baseURL,
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}

/**
 * Find or create a vendor in Zoho Books
 * @param name Vendor name
 * @param raw Optional raw data for additional vendor fields
 * @returns Object with vendorId and wasCreated flag
 */
export async function createOrGetVendor(
  name: string,
  raw?: any
): Promise<{ vendorId: string; wasCreated: boolean }> {
  if (!ZB_ORG_ID || !ZB_ACCESS_TOKEN) {
    throw new Error('Zoho Books not configured: ZB_ORG_ID and ZB_ACCESS_TOKEN required');
  }

  const client = createZohoClient(ZB_ACCESS_TOKEN, ZB_ORG_ID);
  const orgId = ZB_ORG_ID;

  try {
    // Search for existing vendor
    const searchResponse = await client.get('/books/v3/vendors', {
      params: {
        organization_id: orgId,
        search_text: name,
        per_page: 200, // Get more results for fuzzy matching
      },
    });

    const vendors = searchResponse.data?.vendors || [];
    
    // Extract GST and address from raw data
    const gst = raw?.header?.gst || raw?.header?.gstin || raw?.header?.gstNumber || null;
    const address = raw?.header?.vendorAddress || raw?.header?.billingAddress || raw?.header?.address || null;
    
    // Try fuzzy matching first
    const fuzzyMatch = fuzzyMatchVendor(
      { name, gst, address },
      vendors
    );

    if (fuzzyMatch) {
      console.log(`Fuzzy matched vendor "${name}" with similarity ${(fuzzyMatch.similarity * 100).toFixed(1)}%`);
      return { vendorId: fuzzyMatch.vendor_id, wasCreated: false };
    }

    // Fallback to exact name match (case-insensitive)
    const exactMatch = vendors.find(
      (v: any) => v.vendor_name?.toLowerCase() === name.toLowerCase()
    );

    if (exactMatch?.vendor_id) {
      return { vendorId: exactMatch.vendor_id, wasCreated: false };
    }

    // Create new vendor
    const createPayload: any = {
      vendor_name: name,
    };

    // Add additional fields from raw data if available
    if (raw?.header?.vendorEmail) {
      createPayload.email = raw.header.vendorEmail;
    }
    if (raw?.header?.vendorPhone) {
      createPayload.phone = raw.header.vendorPhone;
    }
    if (raw?.header?.vendorAddress || raw?.header?.billingAddress || raw?.header?.address) {
      createPayload.billing_address = raw?.header?.vendorAddress || raw?.header?.billingAddress || raw?.header?.address;
    }
    // Add GST if available
    if (gst) {
      createPayload.gstin = gst;
    }

    const createResponse = await client.post('/books/v3/vendors', createPayload, {
      params: {
        organization_id: orgId,
      },
    });

    const vendor = createResponse.data?.vendor;
    if (!vendor?.vendor_id) {
      throw new Error(
        `Failed to create vendor: ${createResponse.data?.message || 'Unknown error'}`
      );
    }

    console.log(`Created new vendor "${name}" with ID: ${vendor.vendor_id}`);
    return { vendorId: vendor.vendor_id, wasCreated: true };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const message = (axiosError.response?.data as any)?.message || axiosError.message;
      throw new Error(`Zoho Books vendor API error (${status}): ${message}`);
    }
    throw error;
  }
}

/**
 * Find or create items in Zoho Books
 * @param itemsArray Array of item objects with name, rate, quantity, sku, etc.
 * @param vendorName Vendor name for SKU generation
 * @param raw Raw parsed data for additional item fields
 * @returns Object with itemIds array and creation flags
 */
export async function createOrGetItems(
  itemsArray: Array<{ 
    name: string; 
    rate?: number; 
    quantity?: number;
    sku?: string;
    salesDesc?: string;
    purchaseDesc?: string;
  }>,
  vendorName?: string,
  raw?: any
): Promise<{ itemIds: string[]; newItems: string[] }> {
  if (!ZB_ORG_ID || !ZB_ACCESS_TOKEN) {
    throw new Error('Zoho Books not configured: ZB_ORG_ID and ZB_ACCESS_TOKEN required');
  }

  const client = createZohoClient(ZB_ACCESS_TOKEN, ZB_ORG_ID);
  const orgId = ZB_ORG_ID;
  const itemIds: string[] = [];
  const newItems: string[] = [];
  const supplierInitials = vendorName ? extractSupplierInitials(vendorName) : '';

  try {
    for (const item of itemsArray) {
      const itemName = item.name || 'Unnamed Item';
      const itemSku = item.sku || '';
      const salesDesc = item.salesDesc || raw?.items?.find((i: any) => i.name === itemName)?.sales_description || null;
      const purchaseDesc = item.purchaseDesc || raw?.items?.find((i: any) => i.name === itemName)?.purchase_description || null;

      // Search for existing item
      const searchResponse = await client.get('/books/v3/items', {
        params: {
          organization_id: orgId,
          search_text: itemName || itemSku,
          per_page: 200, // Get more results for fuzzy matching
        },
      });

      const items = searchResponse.data?.items || [];
      
      // Try fuzzy matching first
      const fuzzyMatch = fuzzyMatchItem(
        { name: itemName, sku: itemSku, salesDesc, purchaseDesc },
        items
      );

      if (fuzzyMatch) {
        console.log(`Fuzzy matched item "${itemName}" with similarity ${(fuzzyMatch.similarity * 100).toFixed(1)}%`);
        itemIds.push(fuzzyMatch.item_id);
        continue;
      }

      // Fallback to exact name match (case-insensitive)
      const exactMatch = items.find(
        (i: any) => i.name?.toLowerCase() === itemName.toLowerCase()
      );

      if (exactMatch?.item_id) {
        itemIds.push(exactMatch.item_id);
        continue;
      }

      // Generate SKU with supplier initials if item code exists
      const generatedSKU = itemSku 
        ? generateSKUWithSupplier(itemSku, supplierInitials)
        : (supplierInitials ? `ITEM-${supplierInitials}-${Date.now().toString().slice(-6)}` : '');

      // Create new item
      const createPayload: any = {
        name: itemName,
        rate: item.rate || 0,
        type: 'goods', // or 'service' based on your needs
      };

      // Add SKU if generated
      if (generatedSKU) {
        createPayload.sku = generatedSKU;
      }

      // Add descriptions if available
      if (salesDesc) {
        createPayload.sales_description = salesDesc;
      }
      if (purchaseDesc) {
        createPayload.purchase_description = purchaseDesc;
      }

      const createResponse = await client.post('/books/v3/items', createPayload, {
        params: {
          organization_id: orgId,
        },
      });

      const createdItem = createResponse.data?.item;
      if (!createdItem?.item_id) {
        throw new Error(
          `Failed to create item "${itemName}": ${createResponse.data?.message || 'Unknown error'}`
        );
      }

      itemIds.push(createdItem.item_id);
      newItems.push(itemName); // Track newly created items
      console.log(`Created new item "${itemName}" with SKU: ${generatedSKU || 'N/A'}`);
    }

    return { itemIds, newItems };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const message = (axiosError.response?.data as any)?.message || axiosError.message;
      throw new Error(`Zoho Books items API error (${status}): ${message}`);
    }
    throw error;
  }
}

/**
 * Create a bill draft in Zoho Books
 * @param params Object with vendorId, itemIds, and raw parsed data
 * @returns Bill ID and bill number
 */
export async function createBillDraft(params: {
  vendorId: string;
  itemIds: string[];
  raw: any;
}): Promise<{ billId: string; billNumber: string }> {
  if (!ZB_ORG_ID || !ZB_ACCESS_TOKEN) {
    throw new Error('Zoho Books not configured: ZB_ORG_ID and ZB_ACCESS_TOKEN required');
  }

  const client = createZohoClient(ZB_ACCESS_TOKEN, ZB_ORG_ID);
  const orgId = ZB_ORG_ID;
  const { vendorId, itemIds, raw } = params;

  try {
    // Build line items from itemIds and raw data
    const lineItems = itemIds.map((itemId, index) => {
      const rawItem = raw?.items?.[index] || {};
      return {
        item_id: itemId,
        quantity: rawItem.quantity || rawItem.qty || 1,
        rate: rawItem.rate || rawItem.unit_price || 0,
      };
    });

    // Build bill payload
    const billPayload: any = {
      vendor_id: vendorId,
      line_items: lineItems,
      bill_number: raw?.header?.invoiceNo || raw?.header?.bill_number || undefined,
      reference_number: raw?.header?.reference_number || undefined,
      date: raw?.header?.date || new Date().toISOString().split('T')[0],
      notes: 'Created by automation (draft)',
    };

    const response = await client.post('/books/v3/bills', billPayload, {
      params: {
        organization_id: orgId,
      },
    });

    const bill = response.data?.bill;
    if (!bill?.bill_id) {
      throw new Error(
        `Failed to create bill: ${response.data?.message || 'Unknown error'}`
      );
    }

    return {
      billId: bill.bill_id,
      billNumber: bill.bill_number || bill.bill_id,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const message = (axiosError.response?.data as any)?.message || axiosError.message;
      throw new Error(`Zoho Books bill API error (${status}): ${message}`);
    }
    throw error;
  }
}


