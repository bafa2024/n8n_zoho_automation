import * as zohoBooks from '../integrations/zohoBooks.js';
import * as n8nClient from '../integrations/n8nClient.js';
import * as dataStore from '../dataStore.js';
import * as emailService from '../integrations/emailService.js';
import type { Run } from '../types.js';

/**
 * Bill Processor Service
 * Orchestrates the automation flow: vendor → items → bill → n8n
 */

/**
 * Process a bill run through the complete automation pipeline
 * @param runRecord Run record to process
 */
export async function processBillRun(runRecord: Run): Promise<void> {
  const runId = runRecord.id;
  
  try {
    console.log(`[BillProcessor] Starting processing for run ${runId}`);
    
    // Update status to indicate processing started
    dataStore.updateRun(runId, { status: 'processing' });
    
    // Track what was created for email summary
    let newVendor = false;
    let newItems: string[] = [];
    
    // Step 1: Ensure vendor exists
    console.log(`[BillProcessor] Ensuring vendor exists for run ${runId}`);
    const vendorName = runRecord.vendor || runRecord.raw?.header?.vendor || 'Unknown Vendor';
    const vendorResult = await zohoBooks.createOrGetVendor(vendorName, runRecord.raw);
    const vendorId = vendorResult.vendorId;
    newVendor = vendorResult.wasCreated;
    console.log(`[BillProcessor] Vendor ID: ${vendorId} for run ${runId} (${newVendor ? 'created' : 'found'})`);
    
    // Step 2: Ensure items exist
    console.log(`[BillProcessor] Ensuring items exist for run ${runId}`);
    const itemsArray = (runRecord.raw?.items || []).map((item: any) => ({
      name: item.name || item.desc || item.description || 'Unnamed Item',
      rate: item.rate || item.unit_price || 0,
      quantity: item.quantity || item.qty || 1,
      sku: item.sku || item.itemCode || null,
      salesDesc: item.sales_description || item.salesDesc || null,
      purchaseDesc: item.purchase_description || item.purchaseDesc || null,
    }));
    
    const itemsResult = await zohoBooks.createOrGetItems(itemsArray, vendorName, runRecord.raw);
    const itemIds = itemsResult.itemIds;
    newItems = itemsResult.newItems;
    console.log(`[BillProcessor] Created/found ${itemIds.length} items for run ${runId}`);
    if (newItems.length > 0) {
      console.log(`[BillProcessor] New items created: ${newItems.join(', ')}`);
    }
    
    // Step 3: Create bill draft
    console.log(`[BillProcessor] Creating bill draft for run ${runId}`);
    const billResult = await zohoBooks.createBillDraft({
      vendorId,
      itemIds,
      raw: runRecord.raw,
    });
    
    console.log(`[BillProcessor] Bill created: ${billResult.billId} (${billResult.billNumber}) for run ${runId}`);
    
    // Build bill link
    const billLink = `https://books.zoho.com/app#/purchases/bills/${billResult.billId}`;
    
    // Update run with bill information
    dataStore.updateRun(runId, {
      status: 'zoho_synced',
      bill: billResult.billId,
    });
    
    // Step 4: Send email notification
    console.log(`[BillProcessor] Sending email notification for run ${runId}`);
    try {
      await emailService.sendBillSummaryEmail({
        runId,
        invoiceNo: runRecord.invoice || runRecord.raw?.header?.invoiceNo || null,
        vendorName,
        billId: billResult.billId,
        billNumber: billResult.billNumber,
        newVendor,
        newItems,
        billLink,
      });
    } catch (emailError: any) {
      console.error(`[BillProcessor] Email sending failed (non-critical):`, emailError.message);
      // Don't fail the whole process if email fails
    }
    
    // Step 5: Trigger n8n webhook
    console.log(`[BillProcessor] Triggering n8n webhook for run ${runId}`);
    await n8nClient.triggerN8n({
      runId,
      vendorId,
      billId: billResult.billId,
      billNumber: billResult.billNumber,
      parsedData: runRecord.raw,
      newVendor,
      newItems,
    });
    
    // Step 6: Mark as completed
    console.log(`[BillProcessor] Marking run ${runId} as completed`);
    dataStore.updateRun(runId, { status: 'completed' });
    
    console.log(`[BillProcessor] Successfully processed run ${runId}`);
    
  } catch (error: any) {
    // Log error details
    const errorMessage = error?.message || 'Unknown error';
    console.error(`[BillProcessor] Error processing run ${runId}:`, errorMessage);
    console.error(`[BillProcessor] Error stack:`, error?.stack);
    
    // Update run status to failed with error message
    dataStore.updateRun(runId, {
      status: 'error',
      raw: {
        ...runRecord.raw,
        error: errorMessage,
        errorTimestamp: new Date().toISOString(),
      },
    });
    
    // Re-throw to allow caller to handle if needed
    // But wrap in try/catch at call site to prevent server crash
    throw error;
  }
}

