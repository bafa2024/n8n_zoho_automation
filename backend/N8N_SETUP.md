# n8n Setup Guide

## What is n8n?

n8n is a workflow automation tool that can process your parsed invoices and integrate with Zoho Books. The backend will automatically send parsed invoice data to n8n for further processing.

## Installation Options

### Option 1: Install n8n Locally (Recommended for Development)

#### Using npm (Node.js)
```bash
npm install -g n8n
n8n start
```

#### Using Docker
```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

#### Using npx (No installation needed)
```bash
npx n8n
```

### Option 2: Use n8n Cloud (Production)

1. Sign up at https://n8n.io/cloud
2. Create a workflow
3. Get your webhook URL
4. Set environment variable: `N8N_WEBHOOK_URL=https://your-instance.n8n.cloud/webhook/...`

## Quick Start

### Step 1: Start n8n

```bash
# Using npm (if installed globally)
n8n start

# Or using npx (no installation)
npx n8n
```

n8n will start on `http://localhost:5678`

### Step 2: Create a Webhook Workflow

1. Open n8n: http://localhost:5678
2. Click "New Workflow"
3. Add a **Webhook** node:
   - **Path**: `zoho-bill-process`
   - **Method**: `POST`
   - **Response Mode**: `Response Node`
4. Click "Execute Workflow" to activate
5. Copy the webhook URL (should be: `http://localhost:5678/webhook/zoho-bill-process`)

### Step 3: Configure Backend (Optional)

If your n8n is on a different URL, set environment variable:

```bash
# Windows (PowerShell)
$env:N8N_WEBHOOK_URL="http://localhost:5678/webhook/zoho-bill-process"

# Windows (CMD)
set N8N_WEBHOOK_URL=http://localhost:5678/webhook/zoho-bill-process

# Linux/Mac
export N8N_WEBHOOK_URL=http://localhost:5678/webhook/zoho-bill-process
```

### Step 4: Test the Integration

1. Upload a PDF via the dashboard
2. Check backend console - you should see:
   ```
   Notifying n8n webhook for run R-XXXXX...
   n8n webhook response for run R-XXXXX: { status: 200, ... }
   ```
3. Check n8n workflow - it should show the execution with the parsed data

## Disable n8n Integration (Optional)

If you don't want to use n8n, you can disable it:

```bash
# Windows (PowerShell)
$env:N8N_DISABLED="true"

# Windows (CMD)
set N8N_DISABLED=true

# Linux/Mac
export N8N_DISABLED=true
```

When disabled, runs will stay with status `"parsed"` and won't be sent to n8n.

## Example n8n Workflow

Here's a simple workflow that receives the parsed invoice and calls back:

1. **Webhook** node (receives data)
2. **HTTP Request** node (calls back to backend):
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
3. **Respond to Webhook** node (returns success)

## Troubleshooting

### "ERR_CONNECTION_REFUSED"

**Problem**: n8n is not running

**Solution**: 
- Start n8n: `npx n8n` or `n8n start`
- Verify it's running: Open http://localhost:5678 in browser

### "404 Not Found"

**Problem**: Webhook path doesn't exist in n8n

**Solution**:
- Create a workflow with webhook path: `zoho-bill-process`
- Activate the workflow
- Verify the webhook URL matches

### "ECONNREFUSED" in Backend Logs

**Problem**: n8n is not available

**Solution**:
- Start n8n (see above)
- Or disable n8n: `N8N_DISABLED=true`
- The system will work without n8n - runs will stay with status `"parsed"`

### n8n Not Processing

**Problem**: Workflow is not active

**Solution**:
- In n8n UI, click the "Active" toggle to activate the workflow
- Check "Executions" tab to see if webhook was received

## Production Deployment

For production, consider:
- Using n8n Cloud (hosted service)
- Self-hosting n8n with proper authentication
- Setting up webhook authentication/security
- Using environment variables for webhook URLs

## More Resources

- n8n Documentation: https://docs.n8n.io/
- n8n Community: https://community.n8n.io/
- n8n Examples: https://n8n.io/workflows/







