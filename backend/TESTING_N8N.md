# Testing n8n Integration Guide

## Prerequisites

1. **Backend running** on `http://localhost:10000` (or configured port)
2. **n8n running** on `http://localhost:5678` (default port)
3. **Parser running** on `http://localhost:8000`

## Test 1: Verify n8n Webhook Endpoint Exists

### Option A: Using curl
```bash
curl -X POST http://localhost:5678/webhook/zoho-bill-process \
  -H "Content-Type: application/json" \
  -d '{"runId":"test-123","test":true}'
```

**Expected:** 
- If webhook exists: `200 OK` with response
- If webhook doesn't exist: `404 Not Found`

### Option B: Using browser/Postman
- URL: `http://localhost:5678/webhook/zoho-bill-process`
- Method: `POST`
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "runId": "test-123",
  "test": true
}
```

## Test 2: Full Upload Flow (Happy Path)

### Step 1: Upload a PDF
1. Open dashboard: `http://localhost:10000`
2. Upload a PDF file
3. Check backend console logs:
   ```
   File uploaded: {...}
   Parsed result: {...}
   Notifying n8n webhook for run R-XXXXX...
   Webhook URL: http://localhost:5678/webhook/zoho-bill-process
   Payload size: XXXX bytes
   ```

### Step 2: Check Run Status
1. Check `backend/data/runs.json`:
   ```json
   {
     "id": "R-XXXXX",
     "status": "processing",  // Should be "processing" after webhook call
     ...
   }
   ```

2. Check backend console for webhook response:
   ```
   n8n webhook response for run R-XXXXX: {
     status: 200,
     statusText: "OK",
     data: {...}
   }
   ```

### Step 3: Simulate n8n Callback
```bash
curl -X POST http://localhost:10000/api/n8n/callback \
  -H "Content-Type: application/json" \
  -d '{
    "runId": "R-XXXXX",
    "status": "completed",
    "billId": "BILL-123",
    "vendorId": "VENDOR-555"
  }'
```

**Expected:**
- Response: `200 OK` with `{"success": true, "message": "Run R-XXXXX updated"}`
- Check `runs.json` - status should be `"completed"`, bill should be `"BILL-123"`

## Test 3: Error Scenarios

### Test 3a: n8n Not Running
1. Stop n8n
2. Upload a PDF
3. Check backend console:
   ```
   n8n webhook error for run R-XXXXX: {
     "message": "connect ECONNREFUSED 127.0.0.1:5678",
     "code": "ECONNREFUSED",
     ...
   }
   ```
4. Check `runs.json` - status should be `"error"`

### Test 3b: Wrong Webhook URL
1. Set environment variable:
   ```bash
   export N8N_WEBHOOK_URL=http://localhost:5678/webhook/wrong-path
   ```
2. Restart backend
3. Upload a PDF
4. Check console for `404 Not Found` error
5. Status should be `"error"`

### Test 3c: n8n Returns Error Status
1. Configure n8n workflow to return error
2. Upload PDF
3. Check console for error response
4. Status should be `"error"`

### Test 3d: Callback with Error
```bash
curl -X POST http://localhost:10000/api/n8n/callback \
  -H "Content-Type: application/json" \
  -d '{
    "runId": "R-XXXXX",
    "status": "error",
    "error": "Failed to create bill in Zoho"
  }'
```

**Expected:**
- Status updated to `"error"` in `runs.json`

## Test 4: Manual API Testing

### Test Upload Endpoint
```bash
curl -X POST http://localhost:10000/api/upload \
  -F "file=@path/to/test.pdf"
```

**Expected Response:**
```json
{
  "ok": true,
  "success": true,
  "run": {
    "id": "R-XXXXX",
    "status": "parsed",
    ...
  }
}
```

### Test Runs Endpoint
```bash
curl http://localhost:10000/api/runs?limit=20
```

**Expected Response:**
```json
{
  "runs": [
    {
      "id": "R-XXXXX",
      "status": "processing",
      ...
    }
  ],
  "nextCursor": null
}
```

### Test Callback Endpoint
```bash
curl -X POST http://localhost:10000/api/n8n/callback \
  -H "Content-Type: application/json" \
  -d '{
    "runId": "R-XXXXX",
    "status": "completed",
    "billId": "BILL-123"
  }'
```

## Test 5: Create Simple n8n Workflow for Testing

### Step 1: Create Webhook Trigger
1. Open n8n: `http://localhost:5678`
2. Create new workflow
3. Add "Webhook" node
4. Configure:
   - **Path**: `zoho-bill-process`
   - **Method**: `POST`
   - **Response Mode**: `Response Node`

### Step 2: Add HTTP Request Node (Callback)
1. Add "HTTP Request" node after webhook
2. Configure:
   - **Method**: `POST`
   - **URL**: `http://localhost:10000/api/n8n/callback`
   - **Body**: 
   ```json
   {
     "runId": "{{ $json.runId }}",
     "status": "completed",
     "billId": "BILL-{{ $json.runId }}",
     "vendorId": "VENDOR-123"
   }
   ```

### Step 3: Add Respond to Webhook Node
1. Add "Respond to Webhook" node
2. Configure:
   - **Response Code**: `200`
   - **Response Body**: `{"success": true}`

### Step 4: Activate Workflow
1. Click "Active" toggle to activate workflow
2. Copy the webhook URL (should be: `http://localhost:5678/webhook/zoho-bill-process`)

## Test 6: End-to-End Flow

1. **Start all services:**
   - Backend: `cd backend && npm run dev`
   - Parser: (your parser command)
   - n8n: (your n8n command)

2. **Upload PDF via UI:**
   - Go to `http://localhost:10000`
   - Upload a test PDF

3. **Monitor logs:**
   - Backend console should show:
     - File upload
     - Parser response
     - n8n webhook call
     - Status updates

4. **Check n8n workflow:**
   - Open n8n UI
   - Check workflow execution
   - Verify webhook received data
   - Verify callback was sent

5. **Verify final state:**
   - Check `backend/data/runs.json`
   - Status should be `"completed"`
   - `bill` field should be populated
   - `vendor` field should be populated (if provided)

## Debugging Tips

### Check Backend Logs
Look for:
- `Notifying n8n webhook for run R-XXXXX...`
- `Webhook URL: ...`
- `Payload size: ...`
- `n8n webhook response...` or `n8n webhook error...`

### Check n8n Logs
- Open n8n UI
- Go to "Executions" tab
- Check latest execution
- Verify webhook received correct data

### Check runs.json
```bash
cat backend/data/runs.json | jq '.[0]'
```

### Test Webhook URL
```bash
# Test if webhook is accessible
curl -v http://localhost:5678/webhook/zoho-bill-process
```

### Environment Variables
```bash
# Check if custom webhook URL is set
echo $N8N_WEBHOOK_URL

# Or set it
export N8N_WEBHOOK_URL=http://localhost:5678/webhook/zoho-bill-process
```

## Common Issues

1. **ECONNREFUSED**: n8n is not running or wrong port
2. **404 Not Found**: Webhook path doesn't exist in n8n
3. **Timeout**: n8n is taking too long (increase timeout in code)
4. **Status stuck on "processing"**: n8n didn't call back (check n8n workflow)

## Quick Test Script

Save as `test-n8n.sh`:

```bash
#!/bin/bash

echo "Testing n8n webhook..."
curl -X POST http://localhost:5678/webhook/zoho-bill-process \
  -H "Content-Type: application/json" \
  -d '{"runId":"test-123","test":true}' \
  -w "\nStatus: %{http_code}\n"

echo -e "\nTesting callback endpoint..."
curl -X POST http://localhost:10000/api/n8n/callback \
  -H "Content-Type: application/json" \
  -d '{"runId":"test-123","status":"completed","billId":"BILL-TEST"}' \
  -w "\nStatus: %{http_code}\n"
```

Make executable: `chmod +x test-n8n.sh`
Run: `./test-n8n.sh`







