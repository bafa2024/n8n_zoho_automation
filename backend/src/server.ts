import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import multer from 'multer';
import { config } from './config.js';
import { ensureDir } from './lib/fsutil.js';
import './db.js';
import { runsRouter } from './routes/runs.js';
import { zohoRouter } from './routes/zoho.js';
import { oauthRouter } from './routes/oauth.js';
import { infoRouter } from './routes/info.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json version
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

const app = express();

// Ensure upload directory exists
ensureDir(config.uploadDir);

// Multer configuration for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, config.uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB limit
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// Public health endpoint (before auth middleware)
app.get('/api/health', (_req, res) => res.json({ status: "healthy" }));

// Public version endpoint (before auth middleware)
app.get('/api/version', (_req, res) => res.json({ version: packageJson.version }));

// Public time endpoint (before auth middleware)
app.get('/api/time', (_req, res) => res.json({ time: new Date().toISOString() }));

// Public env-check endpoint (before auth middleware)
app.get('/api/env-check', (_req, res) => {
  const maskSecret = (value: string | undefined) => {
    if (!value) return "missing";
    if (value.length <= 4) return value + "***";
    return value.substring(0, 4) + "***";
  };

  const checkEnv = (key: string) => {
    const value = process.env[key];
    return value ? "set" : "missing";
  };

  const checkSecretEnv = (key: string) => {
    const value = process.env[key];
    return value ? maskSecret(value) : "missing";
  };

  res.json({
    ZOHO_CLIENT_ID: checkEnv('ZOHO_CLIENT_ID'),
    ZOHO_CLIENT_SECRET: checkSecretEnv('ZOHO_CLIENT_SECRET'),
    ZOHO_REDIRECT_URI: checkEnv('ZOHO_REDIRECT_URI')
  });
});

// Public mock Zoho user endpoint (before auth middleware)
app.get('/api/zoho/mock-user', (_req, res) => {
  res.json({
    id: "1234567890",
    email: "mock.user@zoho.com",
    name: "Mock User",
    role: "admin"
  });
});

// Public mock Zoho contacts endpoint (before auth middleware)
app.get('/api/zoho/mock-contacts', (_req, res) => {
  res.json([
    { id: "c1", name: "Alice Example", email: "alice@example.com" },
    { id: "c2", name: "Bob Example", email: "bob@example.com" }
  ]);
});

// Public OAuth Zoho authorize endpoint (before auth middleware)
app.get('/oauth/zoho/authorize', (_req, res) => {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const redirectUri = process.env.ZOHO_REDIRECT_URI;
  
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: "OAuth configuration missing" });
  }
  
  // Generate random state for security
  const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  const authUrl = `https://accounts.zoho.com/oauth/v2/auth?response_type=code&client_id=${clientId}&scope=ZohoBooks.fullaccess.all,ZohoBooks.invoices.READ,ZohoBooks.invoices.CREATE,ZohoBooks.items.READ,ZohoBooks.payments.READ&redirect_uri=${encodeURIComponent(redirectUri)}&access_type=offline&state=${state}`;
  
  res.redirect(302, authUrl);
});

// Public OAuth Zoho callback endpoint (before auth middleware)
app.get('/oauth/zoho/callback', async (req, res) => {
  const { code, 'accounts-server': accountsServer } = req.query;
  
  if (!code) {
    return res.status(400).json({ 
      error: "missing_code",
      message: "Authorization code not found. Make sure you start the flow from /oauth/zoho/authorize and confirm that your Redirect URI matches the one set in Zoho API Console."
    });
  }
  
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const redirectUri = process.env.ZOHO_REDIRECT_URI;
  
  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(500).json({ error: "OAuth configuration missing" });
  }
  
  // Determine the correct Zoho accounts domain
  const accountsDomain = accountsServer ? accountsServer as string : 'https://accounts.zoho.com';
  const tokenUrl = `${accountsDomain}/oauth/v2/token`;
  
  try {
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: code as string
      })
    });
    
    const tokenData = await tokenResponse.json() as any;
    
    if (!tokenResponse.ok) {
      return res.status(400).json({ 
        error: "token_exchange_failed", 
        details: tokenData 
      });
    }
    
    res.json(tokenData);
    
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).json({ error: "internal_error" });
  }
});

// Public Zoho user endpoint with token validation (before auth middleware)
app.get('/api/zoho/user', async (req, res) => {
  const { access_token, api_domain } = req.query;
  
  if (!access_token) {
    return res.status(401).json({ error: "unauthorized" });
  }
  
  try {
    // Safely build the API URL with sanitization
    const baseApi = (typeof api_domain === 'string' && api_domain) ? api_domain.trim() : 'https://www.zohoapis.com';
    const cleanBase = baseApi.replace(/\/+$/, '').replace(/[\r\n]/g, ''); // Remove trailing slashes and newlines
    const url = `${cleanBase}/oauth/user/info`;
    
    const userResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const userData = await userResponse.json() as any;
    
    if (!userResponse.ok) {
      return res.status(userResponse.status).json(userData);
    }
    
    res.json(userData);
    
  } catch (error) {
    console.error('Zoho user API error:', error);
    res.status(500).json({ error: "internal_error" });
  }
});

// Public Zoho contacts endpoint with token validation (before auth middleware)
app.get('/api/zoho/contacts', async (req, res) => {
  const { access_token, api_domain } = req.query;
  
  if (!access_token) {
    return res.status(401).json({ error: "unauthorized" });
  }
  
  try {
    // Safely build the API URL with sanitization
    const baseApi = (typeof api_domain === 'string' && api_domain) ? api_domain.trim() : 'https://www.zohoapis.com';
    const cleanBase = baseApi.replace(/\/+$/, '').replace(/[\r\n]/g, ''); // Remove trailing slashes and newlines
    const url = `${cleanBase}/crm/v2/Contacts`;
    
    const contactsResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const contactsData = await contactsResponse.json() as any;
    
    if (!contactsResponse.ok) {
      return res.status(contactsResponse.status).json(contactsData);
    }
    
    res.json(contactsData);
    
  } catch (error) {
    console.error('Zoho contacts API error:', error);
    res.status(500).json({ error: "internal_error" });
  }
});

// Public Zoho refresh token endpoint (before auth middleware)
app.get('/oauth/zoho/refresh', (req, res) => {
  const { refresh_token } = req.query;
  
  if (!refresh_token) {
    return res.status(401).json({ error: "unauthorized" });
  }
  
  res.json({
    access_token: "mock_new_access_token_123",
    expires_in: 3600
  });
});

// Public Zoho refresh token endpoint (POST) - before auth middleware
app.post('/api/zoho/refresh', async (req, res) => {
  const { refresh_token, accounts_server } = req.body;
  
  if (!refresh_token) {
    return res.status(400).json({ error: "missing_refresh_token" });
  }
  
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "OAuth configuration missing" });
  }
  
  // Determine the correct Zoho accounts domain
  const accountsDomain = accounts_server || 'https://accounts.zoho.com';
  const tokenUrl = `${accountsDomain}/oauth/v2/token`;
  
  try {
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refresh_token
      })
    });
    
    const tokenData = await tokenResponse.json() as any;
    
    if (!tokenResponse.ok) {
      return res.status(tokenResponse.status).json(tokenData);
    }
    
    res.json(tokenData);
    
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: "internal_error" });
  }
});

// Public Zoho token status endpoint (before auth middleware)
app.get('/api/zoho/token-status', async (req, res) => {
  const { access_token, accounts_server } = req.query;
  
  if (!access_token) {
    return res.status(400).json({ error: "missing_access_token" });
  }
  
  try {
    // Determine the correct Zoho accounts domain
    const accountsDomain = accounts_server ? accounts_server as string : 'https://accounts.zoho.com';
    const tokenInfoUrl = `${accountsDomain}/oauth/v2/tokeninfo?access_token=${access_token}`;
    
    const tokenResponse = await fetch(tokenInfoUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const tokenData = await tokenResponse.json() as any;
    
    if (!tokenResponse.ok) {
      return res.status(200).json({ 
        status: "invalid", 
        error: tokenData.error || "Token validation failed" 
      });
    }
    
    // Token is valid, return success with expiration info
    res.status(200).json({
      status: "valid",
      expires_in: tokenData.expires_in || 3600
    });
    
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(200).json({ 
      status: "invalid", 
      error: "Token validation request failed" 
    });
  }
});

// Public Zoho Books contacts endpoint (before auth middleware)
app.get('/api/zoho/books/contacts', async (req, res) => {
  const { access_token, organization_id, api_domain } = req.query;
  
  if (!access_token || !organization_id) {
    return res.status(400).json({ error: "missing_parameters" });
  }
  
  try {
    // Safely build the API URL with sanitization
    const baseApi = (typeof api_domain === 'string' && api_domain) ? api_domain.trim() : 'https://www.zohoapis.com';
    const cleanBase = baseApi.replace(/\/+$/, '').replace(/[\r\n]/g, ''); // Remove trailing slashes and newlines
    const url = `${cleanBase}/books/v3/contacts?organization_id=${organization_id}`;
    
    const contactsResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const contactsData = await contactsResponse.json() as any;
    
    if (!contactsResponse.ok) {
      return res.status(contactsResponse.status).json(contactsData);
    }
    
    res.json(contactsData);
    
  } catch (error) {
    console.error('Zoho Books contacts API error:', error);
    res.status(500).json({ error: "internal_error" });
  }
});

// Public Zoho Books create contact endpoint (before auth middleware)
app.post('/api/zoho/books/contacts', async (req, res) => {
  const { access_token, organization_id, api_domain, contact_name, email, phone } = req.body;
  
  // Debug logging - incoming request body
  console.log('=== ZOHO BOOKS CREATE CONTACT DEBUG ===');
  console.log('Incoming request body:', {
    access_token: access_token ? `${access_token.substring(0, 10)}...` : 'missing',
    organization_id: organization_id || 'missing',
    api_domain: api_domain || 'missing',
    contact_name: contact_name || 'missing',
    email: email || 'not provided',
    phone: phone || 'not provided'
  });
  
  if (!access_token || !organization_id || !contact_name) {
    console.log('Missing required parameters - returning 400');
    return res.status(400).json({ error: "missing_parameters" });
  }
  
  try {
    // Safely build the API URL with sanitization
    const baseApi = (typeof api_domain === 'string' && api_domain) ? api_domain.trim() : 'https://www.zohoapis.com';
    const cleanBase = baseApi.replace(/\/+$/, '').replace(/[\r\n]/g, ''); // Remove trailing slashes and newlines
    const url = `${cleanBase}/books/v3/contacts?organization_id=${organization_id}`;
    
    // Debug logging - constructed URL
    console.log('Constructed Zoho API URL:', url);
    
    // Build Zoho Books contact payload with contact_persons array
    const contactPayload = {
      contact_name: contact_name,
      contact_persons: [
        {
          ...(email && { email }),
          ...(phone && { phone })
        }
      ]
    };
    
    // Debug logging - request payload
    console.log('Request payload to Zoho:', JSON.stringify(contactPayload, null, 2));
    console.log('Request headers:', {
      'Authorization': `Zoho-oauthtoken ${access_token.substring(0, 10)}...`,
      'Content-Type': 'application/json'
    });
    
    const contactsResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactPayload)
    });
    
    // Debug logging - response status
    console.log('Zoho API response status:', contactsResponse.status, contactsResponse.statusText);
    
    const contactsData = await contactsResponse.json() as any;
    
    // Debug logging - raw Zoho response
    console.log('Raw Zoho API response:', JSON.stringify(contactsData, null, 2));
    console.log('=== END DEBUG ===');
    
    if (!contactsResponse.ok) {
      return res.status(contactsResponse.status).json(contactsData);
    }
    
    res.json(contactsData);
    
  } catch (error) {
    console.error('Zoho Books create contact API error:', error);
    console.log('=== END DEBUG (ERROR) ===');
    res.status(500).json({ error: "internal_error" });
  }
});

// Public Zoho Books invoices endpoint (before auth middleware)
app.get('/api/zoho/books/invoices', async (req, res) => {
  const { access_token, organization_id, api_domain } = req.query;
  
  if (!access_token || !organization_id) {
    return res.status(400).json({ error: "missing_parameters" });
  }
  
  try {
    // Safely build the API URL with sanitization
    const baseApi = (typeof api_domain === 'string' && api_domain) ? String(api_domain).trim() : 'https://www.zohoapis.com';
    const cleanBase = baseApi.replace(/\/+$/, '').replace(/[\r\n]/g, '');
    const url = `${cleanBase}/books/v3/invoices?organization_id=${organization_id}`;
    
    const invoicesResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const invoicesData = await invoicesResponse.json() as any;
    
    if (!invoicesResponse.ok) {
      return res.status(invoicesResponse.status).json(invoicesData);
    }
    
    res.json(invoicesData);
  } catch (error) {
    console.error('Zoho Books invoices API error:', error);
    res.status(500).json({ error: "internal_error" });
  }
});

// Public Zoho Books payments endpoint (before auth middleware)
app.get('/api/zoho/books/payments', async (req, res) => {
  const { access_token, organization_id, api_domain } = req.query;
  
  if (!access_token || !organization_id) {
    return res.status(400).json({ error: "missing_parameters" });
  }
  
  try {
    // Safely build the API URL with sanitization - using correct /customerpayments endpoint
    const baseApi = (typeof api_domain === 'string' && api_domain) ? String(api_domain).trim() : 'https://www.zohoapis.com';
    const cleanBase = baseApi.replace(/\/+$/, '').replace(/[\r\n]/g, '');
    const url = `${cleanBase}/books/v3/customerpayments?organization_id=${organization_id}`;
    
    const paymentsResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const paymentsData = await paymentsResponse.json() as any;
    
    if (!paymentsResponse.ok) {
      // Proactive fallback handling for common Zoho errors
      if (paymentsData.code === 37) {
        return res.status(400).json({
          error: "wrong_endpoint",
          hint: "Use /customerpayments instead of /payments"
        });
      }
      
      if (paymentsData.code === 57) {
        return res.status(401).json({
          error: "scope_missing",
          hint: "Reauthorize with ZohoBooks.payments.READ scope"
        });
      }
      
      // Forward other Zoho errors as-is
      return res.status(paymentsResponse.status).json(paymentsData);
    }
    
    res.json(paymentsData);
  } catch (error) {
    console.error('Zoho Books payments API error:', error);
    res.status(500).json({ error: "internal_error" });
  }
});

// Public n8n sync invoices endpoint (before auth middleware)
app.get('/api/n8n/sync-invoices', async (req, res) => {
  const { access_token, organization_id, api_domain, webhook_url } = req.query;
  
  // Basic validation
  if (!access_token || !organization_id || !api_domain || !webhook_url) {
    return res.status(400).json({ error: "missing_parameters" });
  }
  
  try {
    // Build Zoho Books invoices URL
    const baseApi = (typeof api_domain === 'string' && api_domain) ? String(api_domain).trim() : 'https://www.zohoapis.com';
    const cleanBase = baseApi.replace(/\/+$/, '').replace(/[\r\n]/g, '');
    const zohoUrl = `${cleanBase}/books/v3/invoices?organization_id=${organization_id}`;
    
    // Fetch invoices from Zoho Books
    const zohoResponse = await fetch(zohoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${access_token}`,
        'Content-Type': 'application/json'
      }
    });
    const invoicesData = await zohoResponse.json() as any;
    if (!zohoResponse.ok) {
      return res.status(zohoResponse.status).json(invoicesData);
    }
    
    // Forward to webhook
    const webhookResponse = await fetch(String(webhook_url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invoicesData)
    });
    if (!webhookResponse.ok) {
      const webhookError = await webhookResponse.text();
      return res.status(webhookResponse.status).json({ 
        error: 'webhook_failed', 
        webhook_status: webhookResponse.status,
        webhook_error: webhookError 
      });
    }
    
    const invoiceCount = invoicesData.invoices?.length || 0;
    res.json({ status: 'synced', count: invoiceCount });
  } catch (error) {
    console.error('n8n sync invoices error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Public n8n sync payments endpoint (before auth middleware)
app.get('/api/n8n/sync-payments', async (req, res) => {
  const { access_token, organization_id, api_domain, webhook_url } = req.query;
  
  // Basic validation
  if (!access_token || !organization_id || !api_domain || !webhook_url) {
    return res.status(400).json({ error: "missing_parameters" });
  }
  
  try {
    // Build Zoho Books payments URL - using correct /customerpayments endpoint
    const baseApi = (typeof api_domain === 'string' && api_domain) ? String(api_domain).trim() : 'https://www.zohoapis.com';
    const cleanBase = baseApi.replace(/\/+$/, '').replace(/[\r\n]/g, '');
    const zohoUrl = `${cleanBase}/books/v3/customerpayments?organization_id=${organization_id}`;
    
    // Fetch payments from Zoho Books
    const zohoResponse = await fetch(zohoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${access_token}`,
        'Content-Type': 'application/json'
      }
    });
    const paymentsData = await zohoResponse.json() as any;
    
    if (!zohoResponse.ok) {
      // Proactive fallback handling for common Zoho errors
      if (paymentsData.code === 37) {
        return res.status(400).json({
          error: "wrong_endpoint",
          hint: "Use /customerpayments instead of /payments"
        });
      }
      
      if (paymentsData.code === 57) {
        return res.status(401).json({
          error: "scope_missing",
          hint: "Reauthorize with ZohoBooks.payments.READ scope"
        });
      }
      
      // Forward other Zoho errors as-is
      return res.status(zohoResponse.status).json(paymentsData);
    }
    
    // Forward to webhook
    const webhookResponse = await fetch(String(webhook_url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentsData)
    });
    if (!webhookResponse.ok) {
      const webhookError = await webhookResponse.text();
      return res.status(webhookResponse.status).json({ 
        error: 'webhook_failed', 
        webhook_status: webhookResponse.status,
        webhook_error: webhookError 
      });
    }
    
    const paymentCount = paymentsData.customerpayments?.length || 0;
    res.json({ status: 'synced', count: paymentCount });
  } catch (error) {
    console.error('n8n sync payments error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Public Zoho Books items endpoint (before auth middleware)
app.get('/api/zoho/books/items', async (req, res) => {
  const { access_token, organization_id, api_domain } = req.query;
  
  if (!access_token || !organization_id) {
    return res.status(400).json({ error: "missing_parameters" });
  }
  
  try {
    // Safely build the API URL with sanitization
    const baseApi = (typeof api_domain === 'string' && api_domain) ? String(api_domain).trim() : 'https://www.zohoapis.com';
    const cleanBase = baseApi.replace(/\/+$/, '').replace(/[\r\n]/g, '');
    const url = `${cleanBase}/books/v3/items?organization_id=${organization_id}`;
    
    const itemsResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const itemsData = await itemsResponse.json() as any;
    
    if (!itemsResponse.ok) {
      return res.status(itemsResponse.status).json(itemsData);
    }
    
    res.json(itemsData);
  } catch (error) {
    console.error('Zoho Books items API error:', error);
    res.status(500).json({ error: "internal_error" });
  }
});

// Public n8n sync items endpoint (before auth middleware)
app.get('/api/n8n/sync-items', async (req, res) => {
  const { access_token, organization_id, api_domain, webhook_url } = req.query;
  
  // Basic validation
  if (!access_token || !organization_id || !api_domain || !webhook_url) {
    return res.status(400).json({ error: "missing_parameters" });
  }
  
  try {
    // Build Zoho Books items URL
    const baseApi = (typeof api_domain === 'string' && api_domain) ? String(api_domain).trim() : 'https://www.zohoapis.com';
    const cleanBase = baseApi.replace(/\/+$/, '').replace(/[\r\n]/g, '');
    const zohoUrl = `${cleanBase}/books/v3/items?organization_id=${organization_id}`;
    
    // Fetch items from Zoho Books
    const zohoResponse = await fetch(zohoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${access_token}`,
        'Content-Type': 'application/json'
      }
    });
    const itemsData = await zohoResponse.json() as any;
    if (!zohoResponse.ok) {
      return res.status(zohoResponse.status).json(itemsData);
    }
    
    // Forward to webhook
    const webhookResponse = await fetch(String(webhook_url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(itemsData)
    });
    if (!webhookResponse.ok) {
      const webhookError = await webhookResponse.text();
      return res.status(webhookResponse.status).json({ 
        error: 'webhook_failed', 
        webhook_status: webhookResponse.status,
        webhook_error: webhookError 
      });
    }
    
    const itemCount = itemsData.items?.length || 0;
    res.json({ status: 'synced', count: itemCount });
  } catch (error) {
    console.error('n8n sync items error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Public OAuth debug endpoint (before auth middleware)
app.get('/api/debug-oauth', (_req, res) => {
  res.json({
    ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID ? "set" : "missing",
    ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET ? "set" : "missing",
    ZOHO_REDIRECT_URI: process.env.ZOHO_REDIRECT_URI ? "set" : "missing"
  });
});

// Temporary debug route to list all registered routes
app.get('/debug/routes', (_req, res) => {
  const routes: string[] = [];
  
  // Extract routes from Express app
  app._router.stack.forEach((middleware: any) => {
    if (middleware.route) {
      // Direct route
      const path = middleware.route.path;
      const methods = Object.keys(middleware.route.methods);
      methods.forEach(method => {
        routes.push(`${method.toUpperCase()} ${path}`);
      });
    } else if (middleware.name === 'router') {
      // Router middleware
      if (middleware.regexp) {
        const path = middleware.regexp.source
          .replace(/\\\//g, '/')
          .replace(/\^/g, '')
          .replace(/\$/g, '')
          .replace(/\\/g, '');
        if (path && path !== '.*') {
          routes.push(`ROUTER ${path}`);
        }
      }
    }
  });
  
  res.json({
    routes: routes.sort(),
    total: routes.length,
    note: "Temporary debug endpoint - remove in production"
  });
});

// Public API documentation endpoint (before auth middleware)
app.get('/api/docs', (_req, res) => {
  res.json({
    endpoints: [
      { method: 'GET',  path: '/api/health', description: 'Check backend health status', example: 'GET https://<base_url>/api/health' },
      { method: 'GET',  path: '/api/version', description: 'Return backend version', example: 'GET https://<base_url>/api/version' },
      { method: 'GET',  path: '/api/time', description: 'Return current server time (ISO)', example: 'GET https://<base_url>/api/time' },
      { method: 'GET',  path: '/api/env-check', description: 'Show OAuth-related environment variable status', example: 'GET https://<base_url>/api/env-check' },

      { method: 'GET',  path: '/oauth/zoho/authorize', description: 'Redirect to Zoho OAuth with ZohoBooks scopes', example: 'GET https://<base_url>/oauth/zoho/authorize' },
      { method: 'GET',  path: '/oauth/zoho/callback', description: 'Handle Zoho OAuth callback and exchange code for tokens', example: 'GET https://<base_url>/oauth/zoho/callback?code=<auth_code>&accounts-server=https://accounts.zoho.com' },

      { method: 'GET',  path: '/api/zoho/user', description: 'Fetch Zoho user info', example: 'GET https://<base_url>/api/zoho/user?access_token=<token>&api_domain=https://www.zohoapis.com' },
      { method: 'GET',  path: '/api/zoho/contacts', description: 'Fetch Zoho CRM contacts', example: 'GET https://<base_url>/api/zoho/contacts?access_token=<token>&api_domain=https://www.zohoapis.com' },
      { method: 'GET',  path: '/api/zoho/token-status', description: 'Validate an access token against Zoho accounts', example: 'GET https://<base_url>/api/zoho/token-status?access_token=<token>&accounts_server=https://accounts.zoho.com' },
      { method: 'POST', path: '/api/zoho/refresh', description: 'Exchange refresh_token for new access_token', example: 'POST https://<base_url>/api/zoho/refresh  {"refresh_token":"<refresh_token>","accounts_server":"https://accounts.zoho.com"}' },

      { method: 'GET',  path: '/api/zoho/books/contacts', description: 'Fetch Zoho Books contacts', example: 'GET https://<base_url>/api/zoho/books/contacts?access_token=<token>&organization_id=<org_id>&api_domain=https://www.zohoapis.ca' },
      { method: 'POST', path: '/api/zoho/books/contacts', description: 'Create Zoho Books contact', example: 'POST https://<base_url>/api/zoho/books/contacts  {"access_token":"<token>","organization_id":"<org_id>","api_domain":"https://www.zohoapis.ca","contact_name":"Test Contact","email":"test@example.com","phone":"1234567890"}' },

      { method: 'GET',  path: '/api/zoho/books/invoices', description: 'Fetch Zoho Books invoices', example: 'GET https://<base_url>/api/zoho/books/invoices?access_token=<token>&organization_id=<org_id>&api_domain=https://www.zohoapis.ca' },
      { method: 'GET',  path: '/api/zoho/books/payments', description: 'Fetch Zoho Books payments', example: 'GET https://<base_url>/api/zoho/books/payments?access_token=<token>&organization_id=<org_id>&api_domain=https://www.zohoapis.ca' },
      { method: 'GET',  path: '/api/zoho/books/items', description: 'Fetch Zoho Books items (products/services)', example: 'GET https://<base_url>/api/zoho/books/items?access_token=<token>&organization_id=<org_id>&api_domain=https://www.zohoapis.ca' },

      { method: 'GET',  path: '/api/n8n/sync-contacts', description: 'Fetch Zoho Books contacts and POST to webhook', example: 'GET https://<base_url>/api/n8n/sync-contacts?access_token=<token>&organization_id=<org_id>&api_domain=https://www.zohoapis.ca&webhook_url=<your_webhook_url>' },
      { method: 'GET',  path: '/api/n8n/sync-invoices', description: 'Fetch Zoho Books invoices and POST to webhook', example: 'GET https://<base_url>/api/n8n/sync-invoices?access_token=<token>&organization_id=<org_id>&api_domain=https://www.zohoapis.ca&webhook_url=<your_webhook_url>' },
      { method: 'GET',  path: '/api/n8n/sync-payments', description: 'Fetch Zoho Books payments and POST to webhook', example: 'GET https://<base_url>/api/n8n/sync-payments?access_token=<token>&organization_id=<org_id>&api_domain=https://www.zohoapis.ca&webhook_url=<your_webhook_url>' },
      { method: 'GET',  path: '/api/n8n/sync-items', description: 'Fetch Zoho Books items and POST to webhook', example: 'GET https://<base_url>/api/n8n/sync-items?access_token=<token>&organization_id=<org_id>&api_domain=https://www.zohoapis.ca&webhook_url=<your_webhook_url>' },

      { method: 'GET',  path: '/api/docs', description: 'Return structured API documentation', example: 'GET https://<base_url>/api/docs' },
      { method: 'GET',  path: '/debug/routes', description: 'Temporary: list raw registered routes (dev only)', example: 'GET https://<base_url>/debug/routes' }
    ],
    note: 'Replace <base_url>, <token>, <org_id>, <auth_code>, <refresh_token>, and <your_webhook_url> with real values.'
  });
});

// Public n8n sync contacts endpoint (before auth middleware)
app.get('/api/n8n/sync-contacts', async (req, res) => {
  const { access_token, organization_id, api_domain, webhook_url } = req.query;
  
  // Debug logging
  console.log('=== N8N SYNC CONTACTS DEBUG ===');
  console.log('Query parameters:', {
    access_token: access_token ? `${String(access_token).substring(0, 10)}...` : 'missing',
    organization_id: organization_id || 'missing',
    api_domain: api_domain || 'missing',
    webhook_url: webhook_url || 'missing'
  });
  
  if (!access_token || !organization_id || !api_domain || !webhook_url) {
    console.log('Missing required parameters - returning 400');
    return res.status(400).json({ error: "missing_parameters" });
  }
  
  try {
    // Safely build the Zoho API URL with sanitization
    const baseApi = (typeof api_domain === 'string' && api_domain) ? String(api_domain).trim() : 'https://www.zohoapis.com';
    const cleanBase = baseApi.replace(/\/+$/, '').replace(/[\r\n]/g, ''); // Remove trailing slashes and newlines
    const zohoUrl = `${cleanBase}/books/v3/contacts?organization_id=${organization_id}`;
    
    console.log('Fetching contacts from Zoho URL:', zohoUrl);
    
    // Fetch contacts from Zoho Books
    const zohoResponse = await fetch(zohoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Zoho API response status:', zohoResponse.status, zohoResponse.statusText);
    
    const contactsData = await zohoResponse.json() as any;
    
    if (!zohoResponse.ok) {
      console.log('Zoho API error - forwarding to client');
      return res.status(zohoResponse.status).json(contactsData);
    }
    
    console.log('Successfully fetched contacts from Zoho, count:', contactsData.contacts?.length || 0);
    
    // Forward contacts to n8n webhook
    console.log('Forwarding to n8n webhook:', webhook_url);
    
    const webhookResponse = await fetch(String(webhook_url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactsData)
    });
    
    console.log('n8n webhook response status:', webhookResponse.status, webhookResponse.statusText);
    
    if (!webhookResponse.ok) {
      const webhookError = await webhookResponse.text();
      console.log('n8n webhook error:', webhookError);
      return res.status(webhookResponse.status).json({ 
        error: "webhook_failed", 
        webhook_status: webhookResponse.status,
        webhook_error: webhookError
      });
    }
    
    const contactCount = contactsData.contacts?.length || 0;
    console.log('Successfully synced', contactCount, 'contacts to n8n');
    console.log('=== END N8N SYNC DEBUG ===');
    
    res.json({ 
      status: "synced", 
      count: contactCount 
    });
    
  } catch (error) {
    console.error('n8n sync contacts error:', error);
    console.log('=== END N8N SYNC DEBUG (ERROR) ===');
    res.status(500).json({ error: "internal_error" });
  }
});

// Public upload endpoint (before auth middleware)
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'file_required' });
  }
  
  res.json({
    success: true,
    filename: req.file.filename,
    originalname: req.file.originalname,
    size: req.file.size,
    path: req.file.path
  });
});

// Auth middleware for /api routes
app.use('/api', (req, res, next) => {
  const demoAuthToken = process.env.DEMO_AUTH_TOKEN;
  if (demoAuthToken) {
    const providedToken = req.headers['x-auth-token'];
    if (providedToken !== demoAuthToken) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }
  next();
});

// Info endpoint (ops snapshot)
app.use('/api/info', infoRouter);

// OAuth routes
app.use('/oauth', oauthRouter);

// API routes
app.use('/api/runs', runsRouter);
app.use('/api', zohoRouter);

// Static frontend
const staticDir = path.join(__dirname, '..', 'public');
app.use(express.static(staticDir, { index: false, maxAge: 0 }));
app.get('/', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));

// 404s
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found' });
  return next();
});
app.use((_req, res) => res.status(404).send('Not found'));

// errors
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(config.port, () => {
  console.log(`API + static UI at ${config.publicBaseUrl} (Zoho mode: ${process.env.ZOHO_MODE || 'auto'})`);
});
