const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

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
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*');
        if (error) throw error;
        res.json({ products: data, timestamp: Date.now() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/products/:id', async (req, res) => {
    const { id } = req.params;
    const { stock_quantity } = req.body;
    try {
        const { error } = await supabase
            .from('products')
            .update({ stock_quantity, last_updated: Date.now() })
            .eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// TRANSACTIONS (SALES)
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

app.get('/reports/daily', async (req, res) => {
    try {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const { data, error } = await supabase
            .from('transactions')
            .select('total, created_at, register_id')
            .gte('created_at', thirtyDaysAgo);
        
        if (error) throw error;
        
        const daily = {};
        data.forEach(tx => {
            const day = new Date(tx.created_at).toISOString().split('T')[0];
            if (!daily[day]) {
                daily[day] = { total_sales: 0, transaction_count: 0, registers: new Set() };
            }
            daily[day].total_sales += tx.total;
            daily[day].transaction_count++;
            daily[day].registers.add(tx.register_id);
        });
        
        const result = Object.entries(daily).map(([date, values]) => ({
            date,
            total_sales: values.total_sales,
            transaction_count: values.transaction_count,
            active_registers: values.registers.size
        })).sort((a, b) => b.date.localeCompare(a.date));
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/reports/top-products', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('transaction_items')
            .select('product_id, quantity, total_price, products(name)')
            .limit(100);
        
        if (error) throw error;
        
        const productSales = {};
        data.forEach(item => {
            const name = item.products?.name || item.product_id;
            if (!productSales[name]) {
                productSales[name] = { quantity: 0, revenue: 0 };
            }
            productSales[name].quantity += item.quantity;
            productSales[name].revenue += item.total_price;
        });
        
        const result = Object.entries(productSales)
            .map(([name, values]) => ({ name, ...values }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ message: 'Backend is working' });
});

// ============================================
// SYNC ENDPOINT (For POS registers to upload)
// ============================================
app.post('/sync', async (req, res) => {
    const { transactions } = req.body;
    
    console.log('📥 Received sync request with:', transactions);
    
    if (!transactions || transactions.length === 0) {
        return res.json({ success: true, message: 'Nothing to sync' });
    }
    
    try {
        for (const transaction of transactions) {
            // Insert or update transaction
            const { error: txError } = await supabase
                .from('transactions')
                .upsert({
                    id: transaction.id,
                    transaction_number: transaction.transaction_number,
                    subtotal: transaction.subtotal,
                    tax: transaction.tax,
                    total: transaction.total,
                    payment_method: transaction.payment_method,
                    register_id: transaction.register_id || 'REG-01',
                    created_at: transaction.created_at,
                    synced_at: Date.now()
                });
            
            if (txError) {
                console.error('Transaction error:', txError);
                throw txError;
            }
            
            console.log(`✅ Synced transaction: ${transaction.transaction_number}`);
        }
        
        res.json({ success: true, message: `Synced ${transactions.length} transactions` });
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// PAYOUTS
// ============================================
app.get('/payouts', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('payouts')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
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
            .select('id, username, full_name, role, is_active');
        if (error) throw error;
        res.json({ users: data });
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
    console.log(`📊 Remote dashboard available at: https://kirts-pos-backend.onrender.com/reports/daily`);
});
