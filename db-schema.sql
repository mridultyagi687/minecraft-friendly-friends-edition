-- Database schema for Minecraft Friendly Friends Edition
-- This schema is shared with Friendly Friends App

-- Ensure users table exists (should already exist from Friendly Friends App)
-- If not, create it:
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Worlds table - stores singleplayer and multiplayer worlds
CREATE TABLE IF NOT EXISTS worlds (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    world_type VARCHAR(50) NOT NULL DEFAULT 'singleplayer', -- 'singleplayer' or 'multiplayer'
    seed VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_played TIMESTAMP,
    UNIQUE(user_id, name)
);

-- Servers table - stores multiplayer servers
CREATE TABLE IF NOT EXISTS servers (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255) NOT NULL,
    port INTEGER DEFAULT 25565,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner_id, name)
);

-- Server members table - tracks which users have joined which servers
CREATE TABLE IF NOT EXISTS server_members (
    id SERIAL PRIMARY KEY,
    server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_played TIMESTAMP,
    UNIQUE(server_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_worlds_user_id ON worlds(user_id);
CREATE INDEX IF NOT EXISTS idx_worlds_type ON worlds(world_type);
CREATE INDEX IF NOT EXISTS idx_servers_owner_id ON servers(owner_id);
CREATE INDEX IF NOT EXISTS idx_server_members_server_id ON server_members(server_id);
CREATE INDEX IF NOT EXISTS idx_server_members_user_id ON server_members(user_id);

