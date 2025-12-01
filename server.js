const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
let pool;
if (process.env.DATABASE_URL) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false
    });
    
    // Test database connection
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error('Database connection error:', err);
        } else {
            console.log('✅ Database connected successfully');
        }
    });
} else {
    console.warn('⚠️  DATABASE_URL not set. Authentication will not work.');
}

// Authentication endpoint
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Username and password are required' 
        });
    }
    
    if (!pool) {
        return res.status(500).json({ 
            success: false, 
            message: 'Database not configured' 
        });
    }
    
    try {
        // Query the Friendly Friends App database for the user
        // Adjust the table and column names based on your actual database schema
        const query = `
            SELECT id, username, email, password_hash 
            FROM users 
            WHERE username = $1 OR email = $1
            LIMIT 1
        `;
        
        const result = await pool.query(query, [username]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid username or password' 
            });
        }
        
        const user = result.rows[0];
        
        // Check if password_hash exists (assuming bcrypt)
        if (user.password_hash) {
            const bcrypt = require('bcrypt');
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            
            if (!isValidPassword) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Invalid username or password' 
                });
            }
        } else {
            // If no password_hash column, you might need to adjust this logic
            // For now, we'll just check if the user exists
            console.warn('No password_hash found. User authentication may need adjustment.');
        }
        
        // Successful authentication
        res.json({ 
            success: true, 
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
        
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'An error occurred during authentication',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        database: pool ? 'connected' : 'not configured' 
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

