import { env } from '../lib/env.js';
import { RunPayloadsRepo } from '../storage/runPayloadsRepo.js';
import { RunsRepo } from '../storage/runsRepo.js';
import { getValidToken } from './zohoAuth.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

type ZohoBillLine = { name?: string; item_id?: string; sku?: string; rate: number; quantity: number };
type ZohoCreateBillReq = {
  vendor_name?: string;
  vendor_id?: string;
  date?: string;
  bill_number?: string;
  reference_number?: string;
  line_items: ZohoBillLine[];
  notes?: string;
};
type ZohoCreateBillRes = { bill?: { bill_id?: string; bill_number?: string; total?: number }; code?: number; message?: string };
type ZohoVendor = { vendor_id?: string; vendor_name?: string };
type ZohoItem = { item_id?: string; name?: string; rate?: number };
type ZohoVendorsRes = { vendors?: ZohoVendor[]; code?: number; message?: string };
type ZohoItemsRes = { items?: ZohoItem[]; code?: number; message?: string };

function useMock() {
  if (env.ZOHO_MODE === 'mock') return true;
  if (!env.ZOHO_ACCESS_TOKEN || !env.ZOHO_ORG_ID) return true;
  return false;
}

function buildRequestFromParsed(parsed: any): ZohoCreateBillReq {
  const vendorName = parsed?.header?.vendor || 'Unknown Vendor';
  const billDate = parsed?.header?.date;
  const billNumber = parsed?.header?.invoiceNo || parsed?.header?.bill_number;
  const reference = parsed?.header?.reference_number;

  const line_items: ZohoBillLine[] = (parsed?.items || []).map((it: any) => ({
    name: it.name || it.desc || it.description || 'Item',
    rate: Number(it.rate ?? it.unit_price ?? 0),
    quantity: Number(it.qty ?? it.quantity ?? 1),
  }));

  return {
    vendor_name: vendorName,
    date: billDate,
    bill_number: billNumber,
    reference_number: reference,
    line_items,
    notes: 'Created by automation (draft).',
  };
}

export async function ensureVendor(name: string, token: string): Promise<string> {
  const apiRoot = env.ZOHO_API_DOMAIN.replace(/\/+$/, '');
  
  // Search for existing vendor
  const searchUrl = new URL(`${apiRoot}/books/v3/vendors`);
  searchUrl.searchParams.set('organization_id', env.ZOHO_ORG_ID);
  searchUrl.searchParams.set('search_text', name);
  
  const searchRes = await fetch(searchUrl.toString(), {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!searchRes.ok) {
    throw new Error(`Failed to search vendors: ${searchRes.status}`);
  }
  
  const searchData = (await searchRes.json()) as ZohoVendorsRes;
  
  // If vendor found, return its ID
  if (searchData.vendors && searchData.vendors.length > 0) {
    const vendor = searchData.vendors.find(v => v.vendor_name?.toLowerCase() === name.toLowerCase());
    if (vendor?.vendor_id) {
      return vendor.vendor_id;
    }
  }
  
  // Create new vendor
  const createUrl = new URL(`${apiRoot}/books/v3/vendors`);
  createUrl.searchParams.set('organization_id', env.ZOHO_ORG_ID);
  
  const createRes = await fetch(createUrl.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      vendor_name: name,
    }),
  });
  
  if (!createRes.ok) {
    throw new Error(`Failed to create vendor: ${createRes.status}`);
  }
  
  const createData = (await createRes.json()) as { vendor?: ZohoVendor; code?: number; message?: string };
  
  if (!createData.vendor?.vendor_id) {
    throw new Error(`Vendor creation failed: ${createData.message || 'Unknown error'}`);
  }
  
  return createData.vendor.vendor_id;
}

export async function ensureItem(name: string, token: string): Promise<string> {
  const apiRoot = env.ZOHO_API_DOMAIN.replace(/\/+$/, '');
  
  // Search for existing item
  const searchUrl = new URL(`${apiRoot}/books/v3/items`);
  searchUrl.searchParams.set('organization_id', env.ZOHO_ORG_ID);
  searchUrl.searchParams.set('search_text', name);
  
  const searchRes = await fetch(searchUrl.toString(), {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!searchRes.ok) {
    throw new Error(`Failed to search items: ${searchRes.status}`);
  }
  
  const searchData = (await searchRes.json()) as ZohoItemsRes;
  
  // If item found, return its ID
  if (searchData.items && searchData.items.length > 0) {
    const item = searchData.items.find(i => i.name?.toLowerCase() === name.toLowerCase());
    if (item?.item_id) {
      return item.item_id;
    }
  }
  
  // Create new item
  const createUrl = new URL(`${apiRoot}/books/v3/items`);
  createUrl.searchParams.set('organization_id', env.ZOHO_ORG_ID);
  
  const createRes = await fetch(createUrl.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: name,
      rate: 0, // Default rate, can be updated later
    }),
  });
  
  if (!createRes.ok) {
    throw new Error(`Failed to create item: ${createRes.status}`);
  }
  
  const createData = (await createRes.json()) as { item?: ZohoItem; code?: number; message?: string };
  
  if (!createData.item?.item_id) {
    throw new Error(`Item creation failed: ${createData.message || 'Unknown error'}`);
  }
  
  return createData.item.item_id;
}

async function attachPdfToBill(billId: string, token: string, pdfPath: string): Promise<void> {
  try {
    if (!existsSync(pdfPath)) {
      console.warn(`PDF file not found: ${pdfPath}`);
      return;
    }

    const pdfBuffer = await readFile(pdfPath);
    const apiRoot = env.ZOHO_API_DOMAIN.replace(/\/+$/, '');
    const url = new URL(`${apiRoot}/books/v3/bills/${billId}/attachment`);
    url.searchParams.set('organization_id', env.ZOHO_ORG_ID);

    const formData = new FormData();
    formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'bill.pdf');

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      console.error(`Failed to attach PDF to bill ${billId}: ${res.status} ${res.statusText}`);
    } else {
      console.log(`PDF attached successfully to bill ${billId}`);
    }
  } catch (error) {
    console.error(`Error attaching PDF to bill ${billId}:`, error);
  }
}

export async function createDraftBill(runId: string) {
  const parsed = RunPayloadsRepo.getLatest(runId, 'parsed');
  if (!parsed) throw new Error(`No parsed payload found for run ${runId}`);

  const reqBody: ZohoCreateBillReq = buildRequestFromParsed(parsed);

  if (useMock()) {
    const total = reqBody.line_items.reduce((s, li) => s + (li.rate || 0) * (li.quantity || 0), 0);
    const mock: ZohoCreateBillRes = {
      bill: {
        bill_id: `mock_${Date.now()}`,
        bill_number: reqBody.bill_number || `DRAFT-${runId}`,
        total,
      },
      code: 0,
      message: 'Mock bill created (Zoho not configured).',
    };
    RunPayloadsRepo.add(runId, 'zoho_request', reqBody);
    RunPayloadsRepo.add(runId, 'zoho_response', mock);
    const placeholderLink = 'https://books.zoho.com/app#/purchases/bills';
    RunsRepo.setBillLink(runId, placeholderLink);
    return { mode: 'mock', data: mock };
  }

  const apiRoot = env.ZOHO_API_DOMAIN.replace(/\/+$/, '');
  const url = new URL(`${apiRoot}/books/v3/bills`);
  url.searchParams.set('organization_id', env.ZOHO_ORG_ID);

  RunPayloadsRepo.add(runId, 'zoho_request', reqBody);

  const accessToken = await getValidToken();
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(reqBody),
  });

  const json = (await res.json()) as ZohoCreateBillRes;
  RunPayloadsRepo.add(runId, 'zoho_response', json);

  if (!res.ok) throw new Error(`Zoho error ${res.status}: ${JSON.stringify(json)}`);

  const billId = json.bill?.bill_id || null;
  const billLink = billId ? `https://books.zoho.com/app#/purchases/bills/${billId}` : null;
  RunsRepo.setBillLink(runId, billLink);

  // Attach PDF if bill was created and file exists
  if (billId) {
    const storedPath = RunsRepo.getStoredPath(runId);
    if (storedPath) {
      await attachPdfToBill(billId, accessToken, storedPath);
    }
  }

  return { mode: 'live', data: json };
}
