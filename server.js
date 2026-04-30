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
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// ============================================
// SYNC TRANSACTIONS FROM REGISTER
// ============================================
app.post('/api/sync', async (req, res) => {
    const { transactions, transaction_items, payouts } = req.body;
    
    try {
        // Sync transactions
        if (transactions && transactions.length > 0) {
            const { error: txError } = await supabase
                .from('transactions')
                .upsert(transactions, { onConflict: 'id' });
            
            if (txError) throw txError;
        }
        
        // Sync transaction items
        if (transaction_items && transaction_items.length > 0) {
            const { error: itemsError } = await supabase
                .from('transaction_items')
                .upsert(transaction_items, { onConflict: 'id' });
            
            if (itemsError) throw itemsError;
        }
        
        // Sync payouts
        if (payouts && payouts.length > 0) {
            const { error: payoutError } = await supabase
                .from('payouts')
                .upsert(payouts, { onConflict: 'id' });
            
            if (payoutError) throw payoutError;
        }
        
        res.json({ success: true, message: 'Sync completed' });
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// GET PRODUCTS FOR REGISTER DOWNLOAD
// ============================================
app.get('/api/products', async (req, res) => {
    const since = req.query.since || 0;
    
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .gte('last_updated', since);
        
        if (error) throw error;
        
        res.json({
            products: data,
            timestamp: Date.now()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// GET USERS FOR REGISTER DOWNLOAD
// ============================================
app.get('/api/users', async (req, res) => {
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
// DAILY SALES REPORT (for remote dashboard)
// ============================================
app.get('/api/reports/daily', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('total, created_at, register_id')
            .gte('created_at', Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        if (error) throw error;
        
        // Group by day
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

// ============================================
// TOP PRODUCTS REPORT
// ============================================
app.get('/api/reports/top-products', async (req, res) => {
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

// ============================================
// PAYOUTS SUMMARY
// ============================================
app.get('/api/reports/payouts', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('payouts')
            .select('*')
            .gte('created_at', Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        if (error) throw error;
        
        const totalPayouts = data.reduce((sum, p) => sum + p.amount, 0);
        
        res.json({
            payouts: data,
            total: totalPayouts,
            count: data.length
        });
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