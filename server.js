const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ message: 'Backend is working' });
});

// Products
app.get('/products', async (req, res) => {
    try {
        const { data } = await supabase.from('products').select('*');
        res.json({ products: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SYNC - Simple version
app.post('/sync', async (req, res) => {
    console.log('Sync endpoint hit');
    console.log('Body:', req.body);
    
    try {
        res.json({ success: true, message: 'Sync received' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
