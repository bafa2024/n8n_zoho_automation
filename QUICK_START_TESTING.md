# Quick Start Testing Guide

**Fast 5-minute test to verify everything works**

---

## Step 1: Start Services (2 minutes)

### Terminal 1 - Parser
```bash
cd parser
python app.py
```
✅ Wait for: `Uvicorn running on http://127.0.0.1:8000`

### Terminal 2 - Backend
```bash
cd backend
npm run dev
```
✅ Wait for: `Server running on http://localhost:5050` (or check config)

---

## Step 2: Configure Environment (1 minute)

Create `backend/.env`:
```env
ZB_ORG_ID=your_org_id
ZB_ACCESS_TOKEN=your_token
PARSER_URL=http://127.0.0.1:8000
```

---

## Step 3: Upload Test PDF (2 minutes)

1. Open dashboard: `http://localhost:10000`
2. Upload a PDF invoice
3. Check console logs for:
   - ✅ "PDF uploaded"
   - ✅ "Parser response"
   - ✅ "Run saved"

---

## Step 4: Verify Results

### Check Backend Logs:
```
[BillProcessor] Starting processing for run R-XXXXX
[BillProcessor] Vendor ID: 1234567890 (created/found)
[BillProcessor] Created/found X items
[BillProcessor] Bill created: 9876543210
```

### Check Dashboard:
- ✅ Run appears in "Recent Runs" table
- ✅ Status shows "completed" or "zoho_synced"

### Check Zoho Books:
- ✅ Bill created in Draft status
- ✅ Vendor exists (or was created)
- ✅ Items exist (or were created)

---

## ✅ Success!

If all checks pass, the system is working correctly!

For detailed testing, see: `backend/MANUAL_TESTING_GUIDE.md`


