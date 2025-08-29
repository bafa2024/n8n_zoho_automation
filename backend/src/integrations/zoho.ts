import { env } from '../lib/env';
import { RunPayloadsRepo } from '../storage/runPayloadsRepo';
import { RunsRepo } from '../storage/runsRepo';

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

  // live path is ready for when you add tokens; it won't execute while in mock mode
  const apiRoot = env.ZOHO_API_DOMAIN.replace(/\/+$/, '');
  const url = new URL(`${apiRoot}/books/v3/bills`);
  url.searchParams.set('organization_id', env.ZOHO_ORG_ID);

  RunPayloadsRepo.add(runId, 'zoho_request', reqBody);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${env.ZOHO_ACCESS_TOKEN}`,
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
  return { mode: 'live', data: json };
}
