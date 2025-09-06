const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('./db'); // Knex instance
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

/* ======================
   AUTH ROUTES
====================== */

// Sign in
app.post('/api/v1/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db('users').where({ email }).first();
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.hashed_password);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { id: user.id, role: user.role, brand_id: user.brand_id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token });
  } catch (err) {
    console.error('Error in /auth/signin:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Current user profile (with brand name)
app.get('/api/v1/users/me', requireAuth, async (req, res) => {
  try {
    const user = await db('users')
      .select(
        'users.id',
        'users.email',
        'users.full_name',
        'users.role',
        'users.brand_id',
        'brands.name as brand_name'
      )
      .leftJoin('brands', 'users.brand_id', 'brands.id')
      .where('users.id', req.user.id)
      .first();

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(user);
  } catch (err) {
    console.error('Error in GET /users/me:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ======================
   PUBLIC ROUTES
====================== */

// Submit new ticket
app.post('/api/v1/public/tickets', async (req, res) => {
  try {
    const { name, email, phone, brand_name, description } = req.body;

    if (!name || !email || !brand_name || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find existing brand (case-insensitive)
    let brand = await db('brands')
      .whereRaw('LOWER(name) = ?', brand_name.toLowerCase())
      .first();

    // If not found, create it
    if (!brand) {
      const [newBrand] = await db('brands')
        .insert({ name: brand_name })
        .returning('*');
      brand = newBrand;
    }

    // Insert ticket linked to brand_id
    const [ticket] = await db('tickets')
      .insert({
        title: `Complaint by ${name}`,
        description,
        status: 'Open',
        user_email: email,
        user_phone: phone,
        brand_id: brand.id,
      })
      .returning('*');

    res.status(201).json(ticket);
  } catch (err) {
    console.error('Error in POST /public/tickets:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ======================
   BRAND ROUTES
====================== */

// Brand dashboard data
app.get('/api/v1/brand/dashboard', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'brand_user') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const brand = await db('brands').where({ id: req.user.brand_id }).first();
    if (!brand) return res.status(404).json({ error: 'Brand not found' });

    const stats = {
      total_tickets: await db('tickets')
        .where({ brand_id: brand.id })
        .count('* as c')
        .first()
        .then((r) => Number(r.c)),
      open_tickets: await db('tickets')
        .where({ brand_id: brand.id, status: 'Open' })
        .count('* as c')
        .first()
        .then((r) => Number(r.c)),
      resolved_tickets: await db('tickets')
        .where({ brand_id: brand.id, status: 'Resolved' })
        .count('* as c')
        .first()
        .then((r) => Number(r.c)),
      avg_rating: 0, // Placeholder until ratings implemented
    };

    const tickets = await db('tickets')
      .select(
        'tickets.id',
        'tickets.title',
        'tickets.description',
        'tickets.status',
        'tickets.created_at',
        'tickets.user_email',
        'tickets.user_phone'
      )
      .where({ brand_id: brand.id })
      .orderBy('tickets.created_at', 'desc')
      .limit(10);

    res.json({
      brand: {
        id: brand.id,
        name: brand.name,
        support_email: brand.support_email,
        credit_balance: brand.credit_balance || 0,
      },
      stats,
      tickets,
    });
  } catch (err) {
    console.error('Error in GET /brand/dashboard:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List all tickets for a brand
app.get('/api/v1/tickets', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'brand_user') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const tickets = await db('tickets')
      .select(
        'tickets.id',
        'tickets.title',
        'tickets.description',
        'tickets.status',
        'tickets.created_at',
        'tickets.user_email',
        'tickets.user_phone',
        'brands.name as brand_name'
      )
      .leftJoin('brands', 'tickets.brand_id', 'brands.id')
      .where('tickets.brand_id', req.user.brand_id)
      .orderBy('tickets.created_at', 'desc');

    res.json(tickets);
  } catch (err) {
    console.error('Error in GET /tickets:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get ticket by ID
app.get('/api/v1/tickets/:id', requireAuth, async (req, res) => {
  try {
    const ticket = await db('tickets')
      .where({ id: req.params.id, brand_id: req.user.brand_id })
      .first();

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    res.json(ticket);
  } catch (err) {
    console.error('Error in GET /tickets/:id:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update ticket
app.put('/api/v1/tickets/:id', requireAuth, async (req, res) => {
  try {
    const { status, assignee, notes } = req.body;

    const [updated] = await db('tickets')
      .where({ id: req.params.id, brand_id: req.user.brand_id })
      .update({ status, assignee, notes })
      .returning('*');

    if (!updated) return res.status(404).json({ error: 'Ticket not found' });

    res.json(updated);
  } catch (err) {
    console.error('Error in PUT /tickets/:id:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ======================
   START SERVER
====================== */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
