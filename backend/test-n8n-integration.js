#!/usr/bin/env node

/**
 * Simple test script for n8n integration
 * Usage: node test-n8n-integration.js
 */

const http = require('http');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:10000';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/zoho-bill-process';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function test1_CheckN8NWebhook() {
  log('\n=== Test 1: Check n8n Webhook Endpoint ===', 'blue');
  
  try {
    const url = new URL(N8N_WEBHOOK_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const result = await makeRequest(options, { runId: 'test-123', test: true });
    
    if (result.status === 200 || result.status === 201) {
      log(`✓ Webhook accessible (Status: ${result.status})`, 'green');
      return true;
    } else if (result.status === 404) {
      log(`✗ Webhook not found (Status: 404)`, 'red');
      log(`  Make sure the webhook path exists in n8n: ${N8N_WEBHOOK_URL}`, 'yellow');
      return false;
    } else {
      log(`⚠ Webhook returned status: ${result.status}`, 'yellow');
      return true;
    }
  } catch (err) {
    log(`✗ Cannot connect to n8n webhook: ${err.message}`, 'red');
    log(`  Is n8n running on ${N8N_WEBHOOK_URL}?`, 'yellow');
    return false;
  }
}

async function test2_CheckBackendCallback() {
  log('\n=== Test 2: Check Backend Callback Endpoint ===', 'blue');
  
  try {
    const url = new URL(`${BACKEND_URL}/api/n8n/callback`);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const testData = {
      runId: 'test-callback-123',
      status: 'completed',
      billId: 'BILL-TEST-123',
      vendorId: 'VENDOR-TEST-123',
    };

    const result = await makeRequest(options, testData);
    
    if (result.status === 200 && result.data.success) {
      log(`✓ Callback endpoint working (Status: ${result.status})`, 'green');
      return true;
    } else {
      log(`✗ Callback endpoint failed (Status: ${result.status})`, 'red');
      log(`  Response: ${JSON.stringify(result.data)}`, 'yellow');
      return false;
    }
  } catch (err) {
    log(`✗ Cannot connect to backend: ${err.message}`, 'red');
    log(`  Is backend running on ${BACKEND_URL}?`, 'yellow');
    return false;
  }
}

async function test3_CheckRunsEndpoint() {
  log('\n=== Test 3: Check Runs Endpoint ===', 'blue');
  
  try {
    const url = new URL(`${BACKEND_URL}/api/runs?limit=5`);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: 'GET',
    };

    const result = await makeRequest(options);
    
    if (result.status === 200 && result.data.runs) {
      log(`✓ Runs endpoint working (Status: ${result.status})`, 'green');
      log(`  Found ${result.data.runs.length} runs`, 'green');
      
      // Show status distribution
      const statusCounts = {};
      result.data.runs.forEach(run => {
        statusCounts[run.status] = (statusCounts[run.status] || 0) + 1;
      });
      log(`  Status distribution: ${JSON.stringify(statusCounts)}`, 'blue');
      
      return true;
    } else {
      log(`✗ Runs endpoint failed (Status: ${result.status})`, 'red');
      return false;
    }
  } catch (err) {
    log(`✗ Cannot connect to backend: ${err.message}`, 'red');
    return false;
  }
}

async function runAllTests() {
  log('\n🧪 n8n Integration Test Suite', 'blue');
  log('='.repeat(50), 'blue');
  
  const results = {
    webhook: await test1_CheckN8NWebhook(),
    callback: await test2_CheckBackendCallback(),
    runs: await test3_CheckRunsEndpoint(),
  };
  
  log('\n=== Test Summary ===', 'blue');
  log(`Webhook Test: ${results.webhook ? '✓ PASS' : '✗ FAIL'}`, results.webhook ? 'green' : 'red');
  log(`Callback Test: ${results.callback ? '✓ PASS' : '✗ FAIL'}`, results.callback ? 'green' : 'red');
  log(`Runs Test: ${results.runs ? '✓ PASS' : '✗ FAIL'}`, results.runs ? 'green' : 'red');
  
  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    log('\n🎉 All tests passed!', 'green');
    process.exit(0);
  } else {
    log('\n❌ Some tests failed. Check the output above.', 'red');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(err => {
  log(`\n✗ Test suite error: ${err.message}`, 'red');
  process.exit(1);
});







