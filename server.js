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

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// ============================================
// TEST ENDPOINT
// ============================================
app.get('/test', (req, res) => {
    res.json({ message: 'Backend is working' });
});

// ============================================
// PRODUCTS
// ============================================
app.get('/products', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*');
        if (error) throw error;
        res.json({ products: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// SYNC ENDPOINT (for POS registers)
// ============================================
app.post('/sync', async (req, res) => {
    console.log('📥 Sync request received');
    
    try {
        const { transactions } = req.body;
        
        if (!transactions || transactions.length === 0) {
            return res.json({ success: true, message: 'Nothing to sync' });
        }
        
        for (const tx of transactions) {
            const { error } = await supabase
                .from('transactions')
                .upsert({
                    id: tx.id,
                    transaction_number: tx.transaction_number,
                    subtotal: tx.subtotal,
                    tax: tx.tax,
                    total: tx.total,
                    payment_method: tx.payment_method,
                    register_id: tx.register_id || 'REG-01',
                    user_id: tx.user_id || 'system',
                    created_at: tx.created_at,
                    synced_at: Date.now()
                });
            
            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }
            console.log(`✅ Synced: ${tx.transaction_number}`);
        }
        
        res.json({ success: true, message: `Synced ${transactions.length} transactions` });
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// TRANSACTIONS REPORT
// ============================================
app.get('/transactions', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// DAILY REPORT
// ============================================
app.get('/reports/daily', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`   GET /health`);
    console.log(`   GET /test`);
    console.log(`   GET /products`);
    console.log(`   POST /sync`);
});
