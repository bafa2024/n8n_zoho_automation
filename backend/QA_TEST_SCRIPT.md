# End-to-End QA Test Script

## Overview
This document provides a complete QA checklist for validating the PDF → Parser → Zoho → n8n → Dashboard end-to-end flow.

## Prerequisites

### Required Services Running
- [ ] Backend server: `cd backend && npm run dev`
- [ ] Parser service: `cd parser && python app.py` (or your parser command)
- [ ] n8n (optional): `npx n8n` or `n8n start`
- [ ] Worker (optional): `cd backend && npm run worker` (separate terminal)

### Required Environment Variables
- [ ] `ZB_BASE_URL` or `ZOHO_API_DOMAIN` - Zoho Books API base URL
- [ ] `ZB_ORG_ID` or `ZOHO_ORG_ID` - Zoho Books organization ID
- [ ] `ZB_ACCESS_TOKEN` or `ZOHO_ACCESS_TOKEN` - Zoho Books access token
- [ ] `N8N_WEBHOOK_URL` (optional) - n8n webhook URL
- [ ] `N8N_AUTH_TOKEN` (optional) - n8n authentication token

### Test Data
- [ ] At least one valid PDF invoice file for testing
- [ ] PDF should contain: vendor name, invoice number, items, dates

---

## Test Suite

### TEST 1: Backend Health Check

**Objective**: Verify backend is running and accessible

**Steps**:
1. Open browser: `http://localhost:10000`
2. Check dashboard loads without errors
3. Check browser console for errors

**Expected Result**:
- ✅ Dashboard loads successfully
- ✅ No console errors
- ✅ Status banner shows system status

**Debugging**:
- If dashboard doesn't load: Check backend logs for errors
- If CORS errors: Verify CORS configuration in `server.ts`

---

### TEST 2: PDF Upload and Parsing

**Objective**: Verify PDF upload triggers parser and creates run record

**Steps**:
1. Go to dashboard: `http://localhost:10000`
2. Upload a test PDF file
3. Wait for upload to complete
4. Check backend console logs

**Expected Result**:
- ✅ Upload completes successfully
- ✅ Backend logs show: "File uploaded", "Parsed result"
- ✅ Response shows: `{ ok: true, success: true, runId: "R-XXXXX" }`
- ✅ Run appears in dashboard with status "parsed"

**Debugging**:
- If upload fails: Check parser service is running on port 8000
- If parse fails: Check parser logs for PDF parsing errors
- If run not created: Check `backend/data/runs.json` file permissions

---

### TEST 3: Run Record Creation

**Objective**: Verify run is saved correctly to `runs.json`

**Steps**:
1. After upload, check `backend/data/runs.json`
2. Verify run structure

**Expected Result**:
- ✅ File contains new run entry
- ✅ Run has: `id`, `invoice`, `vendor`, `status: "parsed"`, `items`, `when`, `raw`
- ✅ Runs are sorted newest-first

**Debugging**:
- If file missing: Check data directory exists and is writable
- If structure wrong: Check `dataStore.saveRun()` function

---

### TEST 4: Zoho Books Integration (Vendor Creation)

**Objective**: Verify vendor is found or created in Zoho Books

**Steps**:
1. Upload PDF with vendor name
2. Check backend logs for vendor operations
3. Check Zoho Books for vendor existence

**Expected Result**:
- ✅ Backend logs: "Ensuring vendor exists", "Vendor ID: XXX"
- ✅ Vendor exists in Zoho Books (or was created)
- ✅ Run status updates to "processing"

**Debugging**:
- If vendor not found: Check vendor name matches exactly (case-insensitive)
- If vendor creation fails: Check Zoho API credentials and permissions
- If API error: Check `ZB_ORG_ID` and `ZB_ACCESS_TOKEN` are correct

---

### TEST 5: Zoho Books Integration (Items Creation)

**Objective**: Verify items are found or created in Zoho Books

**Steps**:
1. Upload PDF with items
2. Check backend logs for item operations
3. Check Zoho Books for items existence

**Expected Result**:
- ✅ Backend logs: "Ensuring items exist", "Created/found X items"
- ✅ Items exist in Zoho Books (or were created)
- ✅ Item IDs are returned

**Debugging**:
- If items not found: Check item names match exactly
- If item creation fails: Check Zoho API permissions for item creation
- If rate missing: Check parsed data includes rate information

---

### TEST 6: Zoho Books Integration (Bill Creation)

**Objective**: Verify bill draft is created in Zoho Books

**Steps**:
1. After vendor and items are processed
2. Check backend logs for bill creation
3. Check Zoho Books for bill draft

**Expected Result**:
- ✅ Backend logs: "Creating bill draft", "Bill created: XXX"
- ✅ Bill draft exists in Zoho Books
- ✅ Run status updates to "zoho_synced"
- ✅ Run `bill` field contains bill ID

**Debugging**:
- If bill creation fails: Check all required fields (vendor_id, line_items)
- If bill ID missing: Check Zoho API response structure
- If status not updated: Check `dataStore.updateRun()` function

---

### TEST 7: n8n Webhook Integration

**Objective**: Verify n8n webhook is triggered after Zoho sync

**Steps**:
1. Ensure n8n is running and workflow is active
2. Upload PDF and wait for processing
3. Check n8n UI "Executions" tab
4. Check backend logs

**Expected Result**:
- ✅ Backend logs: "Triggering n8n webhook"
- ✅ n8n shows new execution with payload
- ✅ Payload contains: `runId`, `vendorId`, `billId`, `parsedData`
- ✅ Run status updates to "completed"

**Debugging**:
- If webhook not called: Check `N8N_WEBHOOK_URL` is set correctly
- If n8n not receiving: Check n8n workflow is active
- If auth fails: Check `N8N_AUTH_TOKEN` if required

---

### TEST 8: Dashboard Run Display

**Objective**: Verify dashboard shows all runs correctly

**Steps**:
1. Refresh dashboard: `http://localhost:10000`
2. Check "Recent runs" table
3. Verify run statuses are correct
4. Test pagination (if more than 20 runs)

**Expected Result**:
- ✅ All runs displayed in table
- ✅ Status badges show correct colors:
  - "parsed" → Blue
  - "processing" → Amber
  - "zoho_synced" → Green
  - "completed" → Green
  - "error" → Red
- ✅ Run IDs are clickable links
- ✅ Dates formatted correctly
- ✅ Pagination works (Next/Prev buttons)

**Debugging**:
- If runs not showing: Check `GET /api/runs?limit=20` endpoint
- If status wrong: Check run status in `runs.json`
- If pagination broken: Check `nextCursor` logic

---

### TEST 9: Error Handling

**Objective**: Verify errors are handled gracefully

**Test Cases**:

#### 9a: Invalid PDF
1. Upload corrupted or non-PDF file
2. Check response and run status

**Expected**: Status "error", error message in `raw.error`

#### 9b: Zoho API Failure
1. Set invalid `ZB_ACCESS_TOKEN`
2. Upload PDF
3. Check error handling

**Expected**: Status "error", error message logged, server doesn't crash

#### 9c: n8n Not Available
1. Stop n8n or set wrong `N8N_WEBHOOK_URL`
2. Upload PDF
3. Check processing continues

**Expected**: Zoho sync completes, n8n error logged but doesn't block

---

### TEST 10: Background Worker (Optional)

**Objective**: Verify worker processes pending runs

**Steps**:
1. Stop main backend (or disable processing in upload)
2. Upload PDF (creates run with status "parsed")
3. Start worker: `npm run worker`
4. Check worker logs
5. Check run status updates

**Expected Result**:
- ✅ Worker logs: "Found X pending run(s)"
- ✅ Worker processes runs
- ✅ Run status updates: "parsed" → "processing" → "zoho_synced" → "completed"
- ✅ Worker continues scanning

**Debugging**:
- If worker not finding runs: Check `dataStore.readAllRuns()` function
- If worker crashes: Check error handling in `processBillRun()`

---

## Success Criteria

### Critical Path (Must Pass)
- ✅ TEST 2: PDF Upload and Parsing
- ✅ TEST 3: Run Record Creation
- ✅ TEST 8: Dashboard Run Display

### Integration Tests (Should Pass)
- ✅ TEST 4: Vendor Creation
- ✅ TEST 5: Items Creation
- ✅ TEST 6: Bill Creation

### Optional Tests (Nice to Have)
- ✅ TEST 7: n8n Webhook
- ✅ TEST 10: Background Worker

---

## Debugging Instructions

### Check Backend Logs
```bash
# Backend console should show:
- File upload events
- Parser responses
- Zoho API calls
- n8n webhook calls
- Status updates
```

### Check Parser Logs
```bash
# Parser console should show:
- PDF parsing attempts
- Extracted fields
- Any parsing errors
```

### Check n8n Logs
```bash
# n8n UI → Executions tab
- Shows webhook executions
- Shows payload received
- Shows any errors
```

### Check Data Files
```bash
# backend/data/runs.json
- Contains all runs
- Status fields are correct
- Runs sorted newest-first
```

### Common Issues

1. **"ECONNREFUSED" errors**
   - Service not running
   - Wrong port number
   - Firewall blocking

2. **"401 Unauthorized" errors**
   - Invalid access token
   - Token expired
   - Wrong organization ID

3. **"404 Not Found" errors**
   - Wrong API endpoint
   - Resource doesn't exist
   - Wrong webhook URL

4. **Status stuck on "parsed"**
   - Background processing not running
   - Error in processing (check logs)
   - Worker not started

---

## Performance Benchmarks

### Expected Timings
- PDF Upload: < 5 seconds
- Parsing: < 10 seconds
- Zoho Vendor/Items: < 5 seconds each
- Bill Creation: < 5 seconds
- n8n Webhook: < 2 seconds
- **Total**: < 30 seconds end-to-end

### Load Testing
- Upload 10 PDFs in quick succession
- Verify all processed correctly
- Check dashboard shows all runs

---

## Test Report Template

```
Date: ___________
Tester: ___________

TEST RESULTS:
[ ] TEST 1: Backend Health Check
[ ] TEST 2: PDF Upload and Parsing
[ ] TEST 3: Run Record Creation
[ ] TEST 4: Vendor Creation
[ ] TEST 5: Items Creation
[ ] TEST 6: Bill Creation
[ ] TEST 7: n8n Webhook
[ ] TEST 8: Dashboard Display
[ ] TEST 9: Error Handling
[ ] TEST 10: Background Worker

ISSUES FOUND:
1. 
2. 
3. 

NOTES:
```

---

## Next Steps After Testing

1. Fix any failing tests
2. Document any issues found
3. Update this script with new test cases
4. Run regression tests after fixes


