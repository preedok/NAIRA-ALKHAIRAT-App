# Bintang Global Group - Backend API

RESTful API untuk platform Bintang Global Group dengan PostgreSQL

## Tech Stack
- Node.js + Express.js
- PostgreSQL + Sequelize ORM
- JWT Authentication
- Socket.io

## Setup
1. `npm install`
2. Configure `.env` (set `DB_NAME=db_bgg_group`, `DB_USERNAME`, `DB_PASSWORD`, dll.)
3. Buat database: `createdb db_bgg_group` (atau gunakan `npm run db:recreate` dari root untuk hapus DB lama + buat baru + migrate + seed)
4. `npm run db:update` (migrate + sync tabel + seed)
5. `npm start`

## Database Commands
```bash
npm run migrate         # Run migrations
npm run migrate:undo    # Undo last migration
npm run seed            # Seed database
npm run seed:undo       # Undo seeds
npm run db:update       # migrate + sync + seed (setelah DB kosong ada)
npm run db:recreate     # Hapus bintang_global, buat db_bgg_group kosong, lalu db:update
npm run db:sync         # Sync tabel saja (tanpa migrate/seed)
```
Database default: **db_bgg_group** (bukan bintang_global).
