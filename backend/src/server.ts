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
  
  const authUrl = `https://accounts.zoho.com/oauth/v2/auth?response_type=code&client_id=${clientId}&scope=ZohoBooks.fullaccess.all&redirect_uri=${encodeURIComponent(redirectUri)}&access_type=offline&state=${state}`;
  
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
  
  if (!access_token || !organization_id || !contact_name) {
    return res.status(400).json({ error: "missing_parameters" });
  }
  
  try {
    // Safely build the API URL with sanitization
    const baseApi = (typeof api_domain === 'string' && api_domain) ? api_domain.trim() : 'https://www.zohoapis.com';
    const cleanBase = baseApi.replace(/\/+$/, '').replace(/[\r\n]/g, ''); // Remove trailing slashes and newlines
    const url = `${cleanBase}/books/v3/contacts?organization_id=${organization_id}`;
    
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
    
    const contactsResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactPayload)
    });
    
    const contactsData = await contactsResponse.json() as any;
    
    if (!contactsResponse.ok) {
      return res.status(contactsResponse.status).json(contactsData);
    }
    
    res.json(contactsData);
    
  } catch (error) {
    console.error('Zoho Books create contact API error:', error);
    res.status(500).json({ error: "internal_error" });
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
