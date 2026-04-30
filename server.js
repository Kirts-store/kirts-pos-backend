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
// PRODUCTS (with better error logging)
// ============================================
app.get('/products', async (req, res) => {
    console.log('--- /products route was called ---');
    
    // Log the environment variables to see if they exist (without revealing the full key)
    console.log('SUPABASE_URL exists?', !!process.env.SUPABASE_URL);
    console.log('SUPABASE_ANON_KEY exists?', !!process.env.SUPABASE_ANON_KEY);

    try {
        // First, try to fetch a list of tables to see if we can connect
        const { data: tableCheck, error: tableError } = await supabase
            .from('products')
            .select('count', { count: 'exact', head: true });

        if (tableError) {
            console.error('Table access error:', tableError.message);
            return res.status(500).json({ 
                error: 'Database table access failed', 
                details: tableError.message 
            });
        }

        // If we get here, the table is accessible. Now fetch the products.
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('*');
        
        if (productsError) {
            console.error('Product fetch error:', productsError.message);
            return res.status(500).json({ 
                error: 'Product fetch failed', 
                details: productsError.message 
            });
        }

        console.log(`Successfully fetched ${products?.length || 0} products.`);
        res.json({ products: products, count: products?.length || 0 });

    } catch (error) {
        console.error('Unexpected error in /products route:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
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
