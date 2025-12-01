# Minecraft Friendly Friends Edition

A friendly Minecraft application for friends to play together, authenticated with the Friendly Friends App database.

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Access to the Friendly Friends App Neon database

### Installation

1. Clone the repository:
```bash
git clone https://github.com/mridultyagi687/minecraft-friendly-friends-edition.git
cd minecraft-friendly-friends-edition
```

2. Install dependencies:
```bash
npm install
```

3. Environment variables:
   - The `.env` file is already configured with the Neon database connection string
   - If you need to update it, edit the `.env` file:
   ```
   DATABASE_URL=postgresql://neondb_owner:npg_BltKNAi17hwM@ep-curly-fire-ahq59jtk-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   PORT=3000
   NODE_ENV=development
   ```

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

5. Open `index.html` in your browser or serve it through a local server.

## Features

- **Shared Database**: Uses the same Neon database as Friendly Friends App
- **Authentication**: Only users authorized in the Friendly Friends App database can log in
- **Login Screen**: Beautiful login interface with "Login with Friendly Friends App" branding
- **Title Screen**: Minecraft-style title screen with game options
- **Worlds Management**: Create and manage singleplayer and multiplayer worlds linked to your account
- **Server Management**: Create servers and join servers, all linked to your account
- **Account Linking**: All worlds and servers are linked to user accounts, shared between both apps

## Database Schema

The application uses a shared database with Friendly Friends App. The schema includes:

### Core Tables
- **users** - User accounts (shared with Friendly Friends App)
  - `id`, `username`, `email`, `password_hash`, `created_at`, `updated_at`

- **worlds** - Minecraft worlds (singleplayer and multiplayer)
  - `id`, `user_id`, `name`, `world_type`, `seed`, `created_at`, `updated_at`, `last_played`

- **servers** - Multiplayer servers
  - `id`, `owner_id`, `name`, `address`, `port`, `description`, `is_public`, `created_at`, `updated_at`

- **server_members** - Tracks which users have joined which servers
  - `id`, `server_id`, `user_id`, `joined_at`, `last_played`

The database schema is automatically initialized when the server starts. See `db-schema.sql` for the complete schema.

## Development

We'll be pushing changes regularly as we build this application.

## API Endpoints

### Authentication
- `POST /api/auth/login` - Authenticate user with username/email and password

### Worlds (requires authentication)
- `GET /api/worlds?world_type=singleplayer|multiplayer` - Get user's worlds
- `POST /api/worlds` - Create a new world
- `PUT /api/worlds/:id` - Update a world
- `DELETE /api/worlds/:id` - Delete a world

### Servers (requires authentication)
- `GET /api/servers` - Get user's servers (owned and joined)
- `POST /api/servers` - Create a new server
- `POST /api/servers/:id/join` - Join a server
- `PUT /api/servers/:id/last-played` - Update last played time

### Utility
- `GET /api/health` - Health check endpoint

All authenticated endpoints require the `user-id` header set to the logged-in user's ID.
