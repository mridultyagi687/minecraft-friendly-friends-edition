const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
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
    
    // Initialize database schema
    async function initializeDatabase() {
        try {
            // Test connection
            await pool.query('SELECT NOW()');
            console.log('✅ Database connected successfully');
            
            // Read and execute schema file
            const schemaPath = path.join(__dirname, 'db-schema.sql');
            if (fs.existsSync(schemaPath)) {
                const schema = fs.readFileSync(schemaPath, 'utf8');
                await pool.query(schema);
                console.log('✅ Database schema initialized');
            }
        } catch (err) {
            console.error('Database initialization error:', err);
        }
    }
    
    initializeDatabase();
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
        // Try to find the user - check both 'User' and 'users' tables
        let query, user, passwordField;
        
        console.log(`[AUTH] Attempting login for: ${username}`);
        
        // First try with 'User' table (capitalized - used by Friendly Friends App)
        // This table uses camelCase: passwordHash instead of password_hash
        try {
            query = `
                SELECT id, username, email, "passwordHash" as password_hash
                FROM "User" 
                WHERE username = $1 OR email = $1
                LIMIT 1
            `;
            const result = await pool.query(query, [username]);
            
            if (result.rows.length > 0) {
                user = result.rows[0];
                passwordField = user.password_hash;
                console.log(`[AUTH] User found in 'User' table: ${user.username} (ID: ${user.id})`);
                console.log(`[AUTH] Password hash from User table: ${passwordField ? passwordField.substring(0, 30) + '...' : 'null'}`);
            } else {
                console.log(`[AUTH] User not found in 'User' table, trying 'users' table`);
            }
        } catch (tableError) {
            console.log(`[AUTH] 'User' table query error: ${tableError.message}, trying 'users' table`);
        }
        
        // If not found in 'User' table, try 'users' table
        if (!user) {
            try {
                query = `
                    SELECT id, username, email, password_hash
                    FROM users 
                    WHERE username = $1 OR email = $1
                    LIMIT 1
                `;
                const result = await pool.query(query, [username]);
                
                if (result.rows.length > 0) {
                    user = result.rows[0];
                    passwordField = user.password_hash;
                    console.log(`[AUTH] User found in 'users' table: ${user.username} (ID: ${user.id})`);
                }
            } catch (tableError) {
                console.error(`[AUTH] Error querying users table:`, tableError.message);
            }
        }
        
        if (!user) {
            console.log(`[AUTH] User not found in any table: ${username}`);
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid username or password' 
            });
        }
        
        console.log(`[AUTH] User found: ${user.username} (ID: ${user.id})`);
        
        // Check if password field exists
        if (!passwordField) {
            console.warn('[AUTH] No password field found in user record');
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid username or password' 
            });
        }
        
        // Log password hash format for debugging (first 20 chars only)
        const hashPreview = passwordField ? passwordField.substring(0, 20) + '...' : 'null';
        console.log(`[AUTH] Password hash preview: ${hashPreview} (length: ${passwordField ? passwordField.length : 0})`);
        
        let isValidPassword = false;
        const crypto = require('crypto');
        
        // Check hash format and use appropriate verification method
        if (passwordField.startsWith('pbkdf2:')) {
            // PBKDF2 format: pbkdf2:sha256:iterations$salt$hash
            // Example: pbkdf2:sha256:600000$1ZefPrgIXjwzkJ7F$7de0e4b6bf2f0908af0d307c233bd096b66bec10a27cad4500771239fb90a858
            try {
                const parts = passwordField.split(':');
                
                if (parts.length >= 3 && parts[0] === 'pbkdf2' && parts[1] === 'sha256') {
                    // Third part contains: iterations$salt$hash
                    const hashParts = parts[2].split('$');
                    
                    if (hashParts.length === 3) {
                        const iterations = parseInt(hashParts[0]);
                        const saltEncoded = hashParts[1];
                        const storedHash = hashParts[2];
                        
                        console.log(`[AUTH] PBKDF2 parsed - iterations: ${iterations}, salt: ${saltEncoded}, hash length: ${storedHash.length}`);
                        
                        // Try multiple salt encoding methods
                        const saltMethods = [
                            { name: 'string', value: saltEncoded },
                            { name: 'base64-buffer', value: Buffer.from(saltEncoded, 'base64') },
                            { name: 'base64-string', value: Buffer.from(saltEncoded, 'base64').toString('utf8') },
                            { name: 'hex-buffer', value: Buffer.from(saltEncoded, 'hex') }
                        ];
                        
                        // Hash is 64 hex characters = 32 bytes
                        const keyLength = 32;
                        
                        for (const saltMethod of saltMethods) {
                            try {
                                const derivedKey = crypto.pbkdf2Sync(password, saltMethod.value, iterations, keyLength, 'sha256');
                                const derivedHashHex = derivedKey.toString('hex');
                                
                                if (derivedHashHex === storedHash) {
                                    isValidPassword = true;
                                    console.log(`[AUTH] PBKDF2 match found using salt method: ${saltMethod.name}`);
                                    break;
                                } else {
                                    console.log(`[AUTH] PBKDF2 ${saltMethod.name} - stored: ${storedHash.substring(0, 16)}..., derived: ${derivedHashHex.substring(0, 16)}...`);
                                }
                            } catch (e) {
                                console.log(`[AUTH] PBKDF2 ${saltMethod.name} failed: ${e.message}`);
                            }
                        }
                        
                        if (!isValidPassword) {
                            console.log(`[AUTH] PBKDF2 comparison failed with all salt methods`);
                        }
                    } else {
                        console.error(`[AUTH] Invalid PBKDF2 hash format - expected iterations$salt$hash, got ${hashParts.length} parts`);
                    }
                } else {
                    console.error(`[AUTH] Invalid PBKDF2 format - expected pbkdf2:sha256:..., got ${parts.length} parts`);
                }
            } catch (pbkdf2Error) {
                console.error(`[AUTH] PBKDF2 comparison error:`, pbkdf2Error.message);
                console.error(`[AUTH] PBKDF2 error stack:`, pbkdf2Error.stack);
            }
        } else if (passwordField.startsWith('$2')) {
            // Bcrypt format
            try {
                const bcrypt = require('bcrypt');
                isValidPassword = await bcrypt.compare(password, passwordField);
                console.log(`[AUTH] Bcrypt comparison result: ${isValidPassword}`);
            } catch (bcryptError) {
                console.error(`[AUTH] Bcrypt comparison error:`, bcryptError.message);
            }
        } else {
            console.error(`[AUTH] Unknown password hash format: ${passwordField.substring(0, 20)}`);
        }
        
        if (!isValidPassword) {
            console.log(`[AUTH] Password mismatch for user: ${username}`);
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid username or password' 
            });
        }
        
        console.log(`[AUTH] Successful login for: ${username}`);
        
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
        console.error('[AUTH] Authentication error:', error);
        console.error('[AUTH] Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail
        });
        res.status(500).json({ 
            success: false, 
            message: 'An error occurred during authentication',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Middleware to verify user authentication
const authenticateUser = async (req, res, next) => {
    const userId = req.headers['user-id'];
    
    if (!userId) {
        return res.status(401).json({ 
            success: false, 
            message: 'Authentication required' 
        });
    }
    
    try {
        const result = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid user' 
            });
        }
        req.userId = parseInt(userId);
        next();
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Authentication error' 
        });
    }
};

// Worlds endpoints
app.get('/api/worlds', authenticateUser, async (req, res) => {
    try {
        const { world_type } = req.query;
        let query = 'SELECT * FROM worlds WHERE user_id = $1';
        const params = [req.userId];
        
        if (world_type) {
            query += ' AND world_type = $2';
            params.push(world_type);
        }
        
        query += ' ORDER BY last_played DESC NULLS LAST, created_at DESC';
        
        const result = await pool.query(query, params);
        res.json({ 
            success: true, 
            worlds: result.rows 
        });
    } catch (error) {
        console.error('Error fetching worlds:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching worlds' 
        });
    }
});

app.post('/api/worlds', authenticateUser, async (req, res) => {
    const { name, world_type = 'singleplayer', seed } = req.body;
    
    if (!name) {
        return res.status(400).json({ 
            success: false, 
            message: 'World name is required' 
        });
    }
    
    try {
        const result = await pool.query(
            `INSERT INTO worlds (user_id, name, world_type, seed) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *`,
            [req.userId, name, world_type, seed]
        );
        
        res.json({ 
            success: true, 
            world: result.rows[0] 
        });
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            res.status(409).json({ 
                success: false, 
                message: 'A world with this name already exists' 
            });
        } else {
            console.error('Error creating world:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error creating world' 
            });
        }
    }
});

app.put('/api/worlds/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { name, seed } = req.body;
    
    try {
        const result = await pool.query(
            `UPDATE worlds 
             SET name = COALESCE($1, name), 
                 seed = COALESCE($2, seed),
                 last_played = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 AND user_id = $4 
             RETURNING *`,
            [name, seed, id, req.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'World not found' 
            });
        }
        
        res.json({ 
            success: true, 
            world: result.rows[0] 
        });
    } catch (error) {
        console.error('Error updating world:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating world' 
        });
    }
});

app.delete('/api/worlds/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await pool.query(
            'DELETE FROM worlds WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, req.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'World not found' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'World deleted' 
        });
    } catch (error) {
        console.error('Error deleting world:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting world' 
        });
    }
});

// Servers endpoints
app.get('/api/servers', authenticateUser, async (req, res) => {
    try {
        // Get servers owned by user and servers user has joined
        const result = await pool.query(
            `SELECT DISTINCT s.*, 
                    CASE WHEN s.owner_id = $1 THEN true ELSE false END as is_owner,
                    sm.joined_at, sm.last_played
             FROM servers s
             LEFT JOIN server_members sm ON s.id = sm.server_id AND sm.user_id = $1
             WHERE s.owner_id = $1 OR sm.user_id = $1
             ORDER BY s.created_at DESC`,
            [req.userId]
        );
        
        res.json({ 
            success: true, 
            servers: result.rows 
        });
    } catch (error) {
        console.error('Error fetching servers:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching servers' 
        });
    }
});

app.post('/api/servers', authenticateUser, async (req, res) => {
    const { name, address, port = 25565, description, is_public = false } = req.body;
    
    if (!name || !address) {
        return res.status(400).json({ 
            success: false, 
            message: 'Server name and address are required' 
        });
    }
    
    try {
        const result = await pool.query(
            `INSERT INTO servers (owner_id, name, address, port, description, is_public) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING *`,
            [req.userId, name, address, port, description, is_public]
        );
        
        // Add owner as a member
        await pool.query(
            'INSERT INTO server_members (server_id, user_id) VALUES ($1, $2)',
            [result.rows[0].id, req.userId]
        );
        
        res.json({ 
            success: true, 
            server: result.rows[0] 
        });
    } catch (error) {
        if (error.code === '23505') {
            res.status(409).json({ 
                success: false, 
                message: 'A server with this name already exists' 
            });
        } else {
            console.error('Error creating server:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error creating server' 
            });
        }
    }
});

app.post('/api/servers/:id/join', authenticateUser, async (req, res) => {
    const { id } = req.params;
    
    try {
        // Check if server exists
        const serverResult = await pool.query('SELECT * FROM servers WHERE id = $1', [id]);
        if (serverResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Server not found' 
            });
        }
        
        // Add user to server members
        const result = await pool.query(
            `INSERT INTO server_members (server_id, user_id) 
             VALUES ($1, $2) 
             ON CONFLICT (server_id, user_id) DO UPDATE SET joined_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [id, req.userId]
        );
        
        res.json({ 
            success: true, 
            message: 'Joined server successfully' 
        });
    } catch (error) {
        console.error('Error joining server:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error joining server' 
        });
    }
});

app.put('/api/servers/:id/last-played', authenticateUser, async (req, res) => {
    const { id } = req.params;
    
    try {
        await pool.query(
            `UPDATE server_members 
             SET last_played = CURRENT_TIMESTAMP 
             WHERE server_id = $1 AND user_id = $2`,
            [id, req.userId]
        );
        
        res.json({ 
            success: true, 
            message: 'Last played updated' 
        });
    } catch (error) {
        console.error('Error updating last played:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating last played' 
        });
    }
});

// Debug endpoint to check database schema
app.get('/api/debug/schema', async (req, res) => {
    
    if (!pool) {
        return res.status(500).json({ 
            success: false, 
            message: 'Database not configured' 
        });
    }
    
    try {
        // Get table information
        const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `;
        const tablesResult = await pool.query(tablesQuery);
        
        // Get users table columns
        const columnsQuery = `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        `;
        const columnsResult = await pool.query(columnsQuery);
        
        // Get sample user (without password)
        const sampleUserQuery = `
            SELECT id, username, email, 
                   CASE WHEN password_hash IS NOT NULL THEN '***' ELSE NULL END as has_password_hash,
                   CASE WHEN password IS NOT NULL THEN '***' ELSE NULL END as has_password
            FROM users 
            LIMIT 1
        `;
        let sampleUser = null;
        try {
            const sampleResult = await pool.query(sampleUserQuery);
            if (sampleResult.rows.length > 0) {
                sampleUser = sampleResult.rows[0];
            }
        } catch (e) {
            // Table might not exist or have different structure
        }
        
        res.json({ 
            success: true,
            tables: tablesResult.rows.map(r => r.table_name),
            users_table_columns: columnsResult.rows,
            sample_user: sampleUser
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error checking schema',
            error: error.message 
        });
    }
});

// Simple test endpoint to check users table
app.get('/api/debug/test-users', async (req, res) => {
    if (!pool) {
        return res.status(500).json({ 
            success: false, 
            message: 'Database not configured' 
        });
    }
    
    try {
        const results = {};
        
        // Check 'User' table (capitalized)
        try {
            const userCols = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'User'
                ORDER BY ordinal_position
            `);
            results.User_table = {
                columns: userCols.rows.map(r => r.column_name),
                sample: null
            };
            
            const userSample = await pool.query('SELECT id, username, email FROM "User" LIMIT 1');
            if (userSample.rows.length > 0) {
                results.User_table.sample = userSample.rows[0];
            }
        } catch (e) {
            results.User_table = { error: e.message };
        }
        
        // Check 'users' table (lowercase)
        try {
            const usersCols = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users'
                ORDER BY ordinal_position
            `);
            results.users_table = {
                columns: usersCols.rows.map(r => r.column_name),
                sample: null
            };
            
            const usersSample = await pool.query('SELECT id, username, email FROM users LIMIT 1');
            if (usersSample.rows.length > 0) {
                results.users_table.sample = usersSample.rows[0];
            }
        } catch (e) {
            results.users_table = { error: e.message };
        }
        
        res.json({ 
            success: true,
            ...results
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error accessing tables',
            error: error.message 
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

