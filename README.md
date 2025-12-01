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

3. Set up environment variables:
   - Create a `.env` file in the root directory
   - Add your Neon database connection string:
   ```
   DATABASE_URL=postgresql://username:password@hostname:port/database?sslmode=require
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

- **Authentication**: Only users authorized in the Friendly Friends App database can log in
- **Login Screen**: Beautiful login interface with "Login with Friendly Friends App" branding
- **Title Screen**: Minecraft-style title screen with game options

## Database Schema

The authentication expects a `users` table with the following columns:
- `id` - User ID
- `username` - Username
- `email` - Email address
- `password_hash` - Bcrypt hashed password

If your database schema is different, you'll need to update the query in `server.js`.

## Development

We'll be pushing changes regularly as we build this application.

## API Endpoints

- `POST /api/auth/login` - Authenticate user with username/email and password
- `GET /api/health` - Health check endpoint
