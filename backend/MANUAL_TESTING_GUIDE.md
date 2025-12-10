# Manual Testing Guide

Complete step-by-step guide for manually testing the Zoho Bills Automation system.

---

## Prerequisites

### 1. Required Services Running

- ✅ **Backend Server** (Node.js/TypeScript)
- ✅ **Parser Service** (Python FastAPI)
- ✅ **Zoho Books Account** (with API access)
- ⚠️ **n8n** (optional - can skip if not configured)
- ⚠️ **Gmail** (optional - for email notifications)

### 2. Required Credentials

- Zoho Organization ID
- Zoho Access Token
- Gmail App Password (if testing email)
- n8n Webhook URL (if testing n8n)

---

## Step 1: Environment Setup

### 1.1 Configure Environment Variables

Create or edit `backend/.env` file:

```env
# Zoho Books (REQUIRED)
ZB_ORG_ID=your_organization_id_here
ZB_ACCESS_TOKEN=your_access_token_here
ZB_BASE_URL=https://www.zohoapis.com

# Parser URL
PARSER_URL=http://127.0.0.1:8000

# Email (OPTIONAL - for email testing)
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password-here
EMAIL_TO=recipient@example.com

# n8n (OPTIONAL - for n8n testing)
N8N_WEBHOOK_URL=http://localhost:5678/webhook/zoho-bill-process
N8N_AUTH_TOKEN=optional-token
```

### 1.2 Get Gmail App Password (if testing email)

1. Go to: https://myaccount.google.com/apppasswords
2. Sign in with your Google account
3. Select "Mail" and "Other (Custom name)"
4. Enter name: "Zoho Bills Automation"
5. Click "Generate"
6. Copy the 16-character password
7. Use it in `GMAIL_PASS`

---

## Step 2: Start Services

### 2.1 Start Parser Service

Open **Terminal 1**:

```bash
cd parser
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
python app.py
```

**Expected Output**:
```
INFO:     Started server process
INFO:     Uvicorn running on http://127.0.0.1:8000
```

**Verify**: Open browser to `http://localhost:8000/docs` - should see FastAPI docs

---

### 2.2 Start Backend Server

Open **Terminal 2**:

```bash
cd backend
npm install
npm run dev
```

**Expected Output**:
```
Server running on http://localhost:5050
```

**Verify**: Open browser to `http://localhost:10000` - should see dashboard

---

### 2.3 (Optional) Start n8n

Open **Terminal 3**:

```bash
npx n8n
```

**Expected Output**:
```
n8n ready on http://localhost:5678
```

**Note**: Only needed if testing n8n integration

---

## Step 3: Test PDF Upload & Parsing

### 3.1 Prepare Test PDF

- Use a sample invoice/bill PDF
- Ensure it contains:
  - Vendor name
  - Invoice number
  - Date
  - Line items with descriptions
  - (Optional) GST number
  - (Optional) Vendor address

### 3.2 Upload PDF via Dashboard

1. Open browser: `http://localhost:10000` (or your frontend URL)
2. Click "Upload PDF" or drag & drop PDF
3. Select your test PDF file
4. Click "Upload" or "Submit"

**Expected Result**:
- ✅ Upload progress indicator
- ✅ Success message: "File uploaded successfully"
- ✅ Run ID displayed (e.g., "R-XXXXX")

### 3.3 Verify Parsing

**Check Backend Logs** (Terminal 2):

```
[Server] PDF uploaded: filename.pdf
[Server] Calling parser: http://127.0.0.1:8000/parse
[Server] Parser response: { header: {...}, items: [...], totals: {...} }
[Server] Run saved: R-XXXXX
```

**Check Parser Logs** (Terminal 1):

```
INFO:     POST /parse
INFO:     Extracted vendor: "Vendor Name"
INFO:     Extracted invoice: "INV-001"
INFO:     Extracted 3 items
```

**Verify in Dashboard**:
- Go to "Recent Runs" table
- Find your run ID
- Check status: Should be "parsed" or "processing"

---

## Step 4: Test Vendor Matching

### 4.1 Test Case 1: New Vendor (Should Create)

**Setup**:
- Use PDF with vendor name that doesn't exist in Zoho Books

**Steps**:
1. Upload PDF with new vendor
2. Monitor backend logs

**Expected Result**:
```
[BillProcessor] Ensuring vendor exists for run R-XXXXX
[BillProcessor] Vendor ID: 1234567890 for run R-XXXXX (created)
```

**Verify in Zoho Books**:
1. Login to Zoho Books
2. Go to **Vendors** → **All Vendors**
3. Find the new vendor
4. Verify vendor name matches PDF
5. (If GST provided) Verify GST number is set
6. (If address provided) Verify address is set

---

### 4.2 Test Case 2: Existing Vendor (Should Find)

**Setup**:
- Create a vendor in Zoho Books first (e.g., "ABC Corporation")
- Upload PDF with similar name (e.g., "ABC Corp" or "ABC Corporation")

**Steps**:
1. Upload PDF with existing vendor
2. Monitor backend logs

**Expected Result**:
```
[BillProcessor] Ensuring vendor exists for run R-XXXXX
Fuzzy matched vendor "ABC Corp" with similarity 95.2%
[BillProcessor] Vendor ID: 1234567890 for run R-XXXXX (found)
```

**Verify**:
- ✅ No duplicate vendor created
- ✅ Uses existing vendor ID
- ✅ Log shows "found" not "created"

---

### 4.3 Test Case 3: Fuzzy Matching with GST

**Setup**:
- Create vendor in Zoho with GST: "29ABCDE1234F1Z5"
- Upload PDF with same GST but different name

**Steps**:
1. Upload PDF with matching GST
2. Monitor backend logs

**Expected Result**:
```
Fuzzy matched vendor "Different Name" with similarity 100.0% (GST match)
[BillProcessor] Vendor ID: 1234567890 for run R-XXXXX (found)
```

**Verify**:
- ✅ Exact GST match = 100% similarity
- ✅ Uses existing vendor despite name difference

---

## Step 5: Test Item Matching

### 5.1 Test Case 1: New Item (Should Create with SKU)

**Setup**:
- Use PDF with item that doesn't exist in Zoho Books
- Item should have SKU/code in PDF

**Steps**:
1. Upload PDF with new item
2. Monitor backend logs

**Expected Result**:
```
[BillProcessor] Ensuring items exist for run R-XXXXX
Created new item "Product Name" with SKU: D0054-ABC
[BillProcessor] New items created: Product Name
```

**Verify in Zoho Books**:
1. Go to **Items** → **All Items**
2. Find the new item
3. Verify SKU format: `{itemCode}-{supplierInitials}`
4. Example: If item code is "D0054" and vendor is "ABC Corp", SKU should be "D0054-ABC"

---

### 5.2 Test Case 2: Existing Item (Should Find)

**Setup**:
- Create an item in Zoho Books (e.g., "Product XYZ")
- Upload PDF with similar item name

**Steps**:
1. Upload PDF with existing item
2. Monitor backend logs

**Expected Result**:
```
Fuzzy matched item "Product XYZ" with similarity 92.5%
[BillProcessor] Created/found 1 items for run R-XXXXX
```

**Verify**:
- ✅ No duplicate item created
- ✅ Uses existing item ID
- ✅ Log shows "found" not "created"

---

### 5.3 Test Case 3: Fuzzy Matching with SKU

**Setup**:
- Create item in Zoho with SKU: "ITEM-123"
- Upload PDF with same SKU but different name

**Steps**:
1. Upload PDF with matching SKU
2. Monitor backend logs

**Expected Result**:
```
Fuzzy matched item "Different Name" with similarity 100.0% (SKU match)
```

**Verify**:
- ✅ Exact SKU match = 100% similarity
- ✅ Uses existing item despite name difference

---

## Step 6: Test Bill Creation

### 6.1 Verify Bill Created in Zoho

**Steps**:
1. After upload completes, check backend logs for bill ID
2. Login to Zoho Books
3. Go to **Purchases** → **Bills**
4. Find the bill (should be in Draft status)

**Expected Result**:
```
[BillProcessor] Bill created: 9876543210 (BILL-001) for run R-XXXXX
```

**Verify in Zoho Books**:
- ✅ Bill exists in Draft status
- ✅ Vendor matches PDF
- ✅ Line items match PDF items
- ✅ Quantities and rates are correct
- ✅ Bill number matches invoice number (if provided)

---

## Step 7: Test Email Notification

### 7.1 Verify Email Configuration

**Check Environment**:
```bash
# In backend/.env
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password
EMAIL_TO=recipient@example.com
```

### 7.2 Upload PDF and Check Email

**Steps**:
1. Upload a PDF (new vendor or new items)
2. Wait for processing to complete
3. Check your email inbox

**Expected Email Content**:
- **Subject**: "Bill Processed: INV-001 - Vendor Name"
- **Body Includes**:
  - Run ID
  - Invoice Number
  - Vendor Name
  - Bill ID and Number
  - Bill Link (clickable)
  - New vendors created (if any)
  - New items created (if any)

**Verify**:
- ✅ Email received within 1-2 minutes
- ✅ All information is correct
- ✅ Bill link works (opens Zoho Books)
- ✅ New vendors/items listed correctly

**Check Backend Logs**:
```
[BillProcessor] Sending email notification for run R-XXXXX
Email sent successfully: <message-id>
Email sent to: recipient@example.com
```

---

## Step 8: Test n8n Integration (Optional)

### 8.1 Setup n8n Workflow

1. Open n8n: `http://localhost:5678`
2. Create new workflow
3. Add **Webhook** node:
   - Method: POST
   - Path: `zoho-bill-process`
   - Response Mode: "Last Node"
4. Add **IF** node to check payload
5. Add **Email** or **Slack** node for notification

### 8.2 Test Webhook Trigger

**Steps**:
1. Upload a PDF
2. Monitor n8n workflow execution

**Expected Result in n8n**:
- ✅ Webhook receives POST request
- ✅ Payload includes:
  - `runId`
  - `vendorId`
  - `billId`
  - `billNumber`
  - `parsedData`
  - `newVendor` (boolean)
  - `newItems` (array)

**Check Backend Logs**:
```
[BillProcessor] Triggering n8n webhook for run R-XXXXX
Triggering n8n webhook for run R-XXXXX...
Webhook URL: http://localhost:5678/webhook/zoho-bill-process
n8n webhook response for run R-XXXXX: { status: 200, data: {...} }
```

---

## Step 9: Test Dashboard

### 9.1 View Recent Runs

**Steps**:
1. Open dashboard: `http://localhost:10000`
2. Check "Recent Runs" table

**Expected Result**:
- ✅ Table shows uploaded runs
- ✅ Columns: Run ID, Invoice, Vendor, Status, Items, Bill, When
- ✅ Status badges are colored correctly:
  - Blue: "parsed"
  - Amber: "processing"
  - Green: "completed" or "zoho_synced"
  - Red: "error"

### 9.2 View Run Details

**Steps**:
1. Click on a Run ID in the table
2. Should navigate to run details page

**Expected Result**:
- ✅ Shows full run details
- ✅ Shows parsed data (header, items, totals)
- ✅ Shows bill information
- ✅ Shows processing status

---

## Step 10: Test Error Handling

### 10.1 Test Invalid PDF

**Steps**:
1. Upload a non-PDF file (e.g., .txt, .jpg)
2. Or upload corrupted PDF

**Expected Result**:
- ✅ Error message displayed
- ✅ Run status: "error"
- ✅ Error details in run record

### 10.2 Test Missing Zoho Credentials

**Steps**:
1. Temporarily remove `ZB_ACCESS_TOKEN` from `.env`
2. Upload a PDF

**Expected Result**:
- ✅ Error logged: "Zoho Books not configured"
- ✅ Run status: "error"
- ✅ Error message in run record

### 10.3 Test Email Failure (Non-Critical)

**Steps**:
1. Use invalid Gmail credentials
2. Upload a PDF

**Expected Result**:
- ✅ Email fails gracefully
- ✅ Processing continues
- ✅ Bill still created
- ✅ Error logged but doesn't break flow

---

## Step 11: Test Fuzzy Matching Edge Cases

### 11.1 Test Similar Vendor Names

**Test Cases**:
- "ABC Corporation" vs "ABC Corp"
- "XYZ Ltd" vs "XYZ Limited"
- "John's Company" vs "Johns Company"

**Expected Result**:
- ✅ Fuzzy matching finds similar vendors
- ✅ Similarity score logged (should be ≥ 80%)
- ✅ No duplicate vendors created

### 11.2 Test Similar Item Names

**Test Cases**:
- "Product A" vs "Product A - Standard"
- "Widget Type 1" vs "Widget Type-1"

**Expected Result**:
- ✅ Fuzzy matching finds similar items
- ✅ Similarity score logged
- ✅ No duplicate items created

---

## Step 12: Test SKU Generation

### 12.1 Test SKU with Supplier Initials

**Setup**:
- Vendor: "ABC Corporation"
- Item Code: "D0054"

**Expected SKU**: `D0054-ABC`

**Verify**:
- ✅ SKU format: `{code}-{initials}`
- ✅ Initials extracted correctly (removes "Corporation")
- ✅ SKU stored in Zoho item

### 12.2 Test SKU Without Item Code

**Setup**:
- Vendor: "XYZ Ltd"
- No item code in PDF

**Expected SKU**: `ITEM-XYZ-{timestamp}`

**Verify**:
- ✅ Fallback SKU generated
- ✅ Includes supplier initials
- ✅ Includes timestamp for uniqueness

---

## Troubleshooting

### Issue: Parser Not Responding

**Symptoms**: Backend logs show connection error

**Solutions**:
1. Check parser is running: `http://localhost:8000/docs`
2. Check `PARSER_URL` in `.env` matches parser port
3. Restart parser service

---

### Issue: Zoho API Errors

**Symptoms**: "Zoho Books API error (401)" or "(403)"

**Solutions**:
1. Verify `ZB_ACCESS_TOKEN` is valid (not expired)
2. Verify `ZB_ORG_ID` is correct
3. Check token has required permissions
4. Regenerate token if needed

---

### Issue: Email Not Sending

**Symptoms**: No email received, logs show error

**Solutions**:
1. Verify Gmail App Password (not regular password)
2. Check `GMAIL_USER` and `GMAIL_PASS` in `.env`
3. Verify 2-factor authentication is enabled
4. Check email spam folder
5. Verify `EMAIL_TO` is set

---

### Issue: Fuzzy Matching Not Working

**Symptoms**: Duplicate vendors/items created

**Solutions**:
1. Check backend logs for similarity scores
2. Verify similarity threshold (default 80%)
3. Check if GST/SKU are being extracted from PDF
4. Verify Zoho API returns vendors/items in search

---

### Issue: Dashboard Not Loading Runs

**Symptoms**: Empty table, "Error loading data"

**Solutions**:
1. Check backend is running
2. Check CORS configuration
3. Open browser console for errors
4. Verify API endpoint: `http://localhost:5050/api/runs`
5. Check `runs.json` file exists in `backend/data/`

---

## Test Checklist

Use this checklist to verify all features:

- [ ] **Environment Setup**
  - [ ] `.env` file configured
  - [ ] Zoho credentials set
  - [ ] (Optional) Gmail credentials set
  - [ ] (Optional) n8n webhook URL set

- [ ] **Services Running**
  - [ ] Parser service running (port 8000)
  - [ ] Backend service running (port 5050)
  - [ ] (Optional) n8n running (port 5678)

- [ ] **PDF Upload & Parsing**
  - [ ] PDF uploads successfully
  - [ ] Parser extracts fields correctly
  - [ ] Run saved to database

- [ ] **Vendor Matching**
  - [ ] New vendor creates correctly
  - [ ] Existing vendor found (fuzzy match)
  - [ ] GST matching works
  - [ ] Address matching works

- [ ] **Item Matching**
  - [ ] New item creates with SKU
  - [ ] Existing item found (fuzzy match)
  - [ ] SKU matching works
  - [ ] SKU generation includes supplier initials

- [ ] **Bill Creation**
  - [ ] Bill created in Zoho Books
  - [ ] Bill is in Draft status
  - [ ] Line items are correct
  - [ ] Quantities and rates match PDF

- [ ] **Email Notification**
  - [ ] Email sent successfully
  - [ ] Email contains correct information
  - [ ] New vendors/items listed
  - [ ] Bill link works

- [ ] **n8n Integration** (if configured)
  - [ ] Webhook triggered
  - [ ] Payload received correctly
  - [ ] Workflow executes

- [ ] **Dashboard**
  - [ ] Runs displayed in table
  - [ ] Status badges correct
  - [ ] Run details page works

- [ ] **Error Handling**
  - [ ] Invalid PDF handled gracefully
  - [ ] Missing credentials handled
  - [ ] Email failures don't break flow

---

## Success Criteria

✅ **All tests pass** if:
1. PDF uploads and parses correctly
2. Vendors/items matched or created correctly
3. Bills created in Zoho Books
4. Email notifications sent (if configured)
5. Dashboard displays runs correctly
6. No duplicate vendors/items created
7. SKU generation works correctly
8. Error handling works gracefully

---

## Next Steps After Testing

1. **Review Logs**: Check all console logs for any warnings
2. **Verify Zoho Data**: Check Zoho Books for created vendors/items/bills
3. **Check Email**: Verify email notifications are received
4. **Monitor Performance**: Check processing times
5. **Document Issues**: Note any edge cases or improvements needed

---

## Support

If you encounter issues:
1. Check logs in all terminals
2. Review `COMPLETION_CHECKUP.md` for implementation details
3. Check `ENV_SETUP_GUIDE.md` for configuration help
4. Review error messages in dashboard

---

**Happy Testing!** 🚀

