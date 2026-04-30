const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase client
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
// PRODUCTS
// ============================================
app.get('/products', async (req, res) => {
    const since = req.query.since || 0;
    
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .gte('last_updated', since);
        
        if (error) throw error;
        
        res.json({ products: data, timestamp: Date.now() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// USERS
// ============================================
app.get('/users', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, username, pin, full_name, role, is_active');
        
        if (error) throw error;
        
        res.json({ users: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// SYNC
// ============================================
app.post('/sync', async (req, res) => {
    const { transactions, transaction_items, payouts } = req.body;
    
    try {
        if (transactions && transactions.length > 0) {
            const { error: txError } = await supabase
                .from('transactions')
                .upsert(transactions, { onConflict: 'id' });
            if (txError) throw txError;
        }
        
        if (transaction_items && transaction_items.length > 0) {
            const { error: itemsError } = await supabase
                .from('transaction_items')
                .upsert(transaction_items, { onConflict: 'id' });
            if (itemsError) throw itemsError;
        }
        
        if (payouts && payouts.length > 0) {
            const { error: payoutError } = await supabase
                .from('payouts')
                .upsert(payouts, { onConflict: 'id' });
            if (payoutError) throw payoutError;
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ KIRTS POS Backend running on port ${PORT}`);
});
});
