import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { CreatureElement } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'creature_grid_secret_key_2026';

export interface DBUser {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  isAdmin?: boolean;
  food?: number;
  bankFood?: number;
}

export interface DBCreature {
  id: string;
  userId: string;
  name: string;
  color: string;
  elements: CreatureElement[];
  createdAt: string;
  updatedAt: string;
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'creatures.db');
const JSON_FALLBACK_PATH = path.join(DB_DIR, 'mysql_database.json');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      bank_food INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_creatures (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      elements TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_creatures_user ON user_creatures(user_id);
  `);
  return db;
}

export class UsersDatabase {
  static async initTables() {
    const database = getDb();
    console.log(`[SQLite DB] Database initialized at ${DB_PATH}`);

    try {
      database.exec('ALTER TABLE users ADD COLUMN bank_food INTEGER NOT NULL DEFAULT 0;');
    } catch {
      // Column already exists
    }

    if (fs.existsSync(JSON_FALLBACK_PATH)) {
      try {
        const raw = fs.readFileSync(JSON_FALLBACK_PATH, 'utf-8');
        const json = JSON.parse(raw);
        if (json.users && json.users.length > 0) {
          const insertUser = database.prepare(
            'INSERT OR IGNORE INTO users (id, username, password_hash, created_at, bank_food) VALUES (?, ?, ?, ?, ?)'
          );
          const insertCreature = database.prepare(
            'INSERT OR IGNORE INTO user_creatures (id, user_id, name, color, elements, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          );
          const migrate = database.transaction((users: any[], creatures: any[]) => {
            for (const u of users) {
              insertUser.run(u.id, u.username, u.passwordHash, u.createdAt, u.bankFood || 0);
            }
            for (const c of creatures) {
              insertCreature.run(c.id, c.userId, c.name, c.color, JSON.stringify(c.elements), c.createdAt, c.updatedAt);
            }
          });
          migrate(json.users, json.userCreatures || []);
          console.log(`[SQLite DB] Migrated ${json.users.length} users from JSON fallback.`);
          fs.renameSync(JSON_FALLBACK_PATH, JSON_FALLBACK_PATH + '.bak');
        }
      } catch (err) {
        console.warn('[SQLite DB] JSON migration skipped:', err);
      }
    }

    // Seed Admin user 'joni' with password 'PinokiO' if not exists
    const adminUser = database.prepare('SELECT id FROM users WHERE username = ?').get('joni');
    if (!adminUser) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('PinokiO', salt);
      database.prepare(
        'INSERT INTO users (id, username, password_hash, bank_food, created_at) VALUES (?, ?, ?, 500, datetime(\'now\'))'
      ).run('usr_admin_joni', 'joni', hash);
      console.log('[SQLite DB] Admin user "joni" (PinokiO) successfully initialized with 500 bank food.');
    }

    const userCount = (database.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
    const creatureCount = (database.prepare('SELECT COUNT(*) as count FROM user_creatures').get() as any).count;
    console.log(`[SQLite DB] Active. Users: ${userCount}, Saved Creatures: ${creatureCount}`);
  }

  static async registerUser(username: string, passwordRaw: string): Promise<{ token: string; user: { id: string; username: string; isAdmin: boolean; food: number; bankFood: number } }> {
    const cleanName = username.trim();
    if (!cleanName || cleanName.length < 3) {
      throw new Error('Имя пользователя должно содержать минимум 3 символа');
    }
    if (!passwordRaw || passwordRaw.length < 4) {
      throw new Error('Пароль должен содержать минимум 4 символа');
    }

    const database = getDb();
    const existing = database.prepare('SELECT id FROM users WHERE username = ?').get(cleanName);
    if (existing) {
      throw new Error('Пользователь с таким логином уже существует');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordRaw, salt);
    const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const createdAt = new Date().toISOString();
    const isAdmin = cleanName.toLowerCase() === 'joni';
    const initialFood = isAdmin ? 500 : 0;

    database.prepare(
      'INSERT INTO users (id, username, password_hash, bank_food, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, cleanName, passwordHash, initialFood, createdAt);

    const token = jwt.sign({ id: userId, username: cleanName, isAdmin }, JWT_SECRET, { expiresIn: '7d' });
    return { token, user: { id: userId, username: cleanName, isAdmin, food: initialFood, bankFood: initialFood } };
  }

  static async loginUser(username: string, passwordRaw: string): Promise<{ token: string; user: { id: string; username: string; isAdmin: boolean; food: number; bankFood: number } }> {
    const cleanName = username.trim();
    const database = getDb();

    const row = database.prepare('SELECT id, username, password_hash, bank_food FROM users WHERE username = ?').get(cleanName) as any;
    if (!row) {
      throw new Error('Неверный логин или пароль');
    }

    const isMatch = await bcrypt.compare(passwordRaw, row.password_hash);
    if (!isMatch) {
      throw new Error('Неверный логин или пароль');
    }

    const isAdmin = row.username.toLowerCase() === 'joni';
    const food = row.bank_food || 0;
    const token = jwt.sign({ id: row.id, username: row.username, isAdmin }, JWT_SECRET, { expiresIn: '7d' });
    return { token, user: { id: row.id, username: row.username, isAdmin, food, bankFood: food } };
  }

  static getUserFood(userId: string): number {
    const database = getDb();
    const row = database.prepare('SELECT bank_food FROM users WHERE id = ?').get(userId) as any;
    return row?.bank_food || 0;
  }

  static getUserBankFood(userId: string): number {
    return this.getUserFood(userId);
  }

  static updateUserFood(userId: string, delta: number): number {
    const database = getDb();
    const current = this.getUserFood(userId);
    const next = Math.max(0, current + delta);
    database.prepare('UPDATE users SET bank_food = ? WHERE id = ?').run(next, userId);
    return next;
  }

  static updateUserBankFood(userId: string, delta: number): number {
    return this.updateUserFood(userId, delta);
  }

  static setUserFood(userId: string, amount: number): number {
    const database = getDb();
    const next = Math.max(0, amount);
    database.prepare('UPDATE users SET bank_food = ? WHERE id = ?').run(next, userId);
    return next;
  }

  static setUserBankFood(userId: string, amount: number): number {
    return this.setUserFood(userId, amount);
  }

  static verifyToken(token: string): { id: string; username: string; isAdmin: boolean } {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; isAdmin?: boolean };
    const isAdmin = decoded.isAdmin ?? (decoded.username?.toLowerCase() === 'joni');
    return { ...decoded, isAdmin };
  }

  static async getUserCreatures(userId: string): Promise<DBCreature[]> {
    const database = getDb();
    const rows = database.prepare(
      'SELECT id, user_id, name, color, elements, created_at, updated_at FROM user_creatures WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId) as any[];

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      color: r.color,
      elements: JSON.parse(r.elements),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  static async saveUserCreature(
    userId: string,
    data: { name: string; color: string; elements: CreatureElement[]; id?: string }
  ): Promise<DBCreature> {
    const now = new Date().toISOString();
    const database = getDb();
    const elementsJson = JSON.stringify(data.elements || []);
    const name = data.name || 'Чудик';
    const color = data.color || '#6366f1';

    if (data.id) {
      const result = database.prepare(
        'UPDATE user_creatures SET name = ?, color = ?, elements = ?, updated_at = ? WHERE id = ? AND user_id = ?'
      ).run(name, color, elementsJson, now, data.id, userId);

      if (result.changes > 0) {
        const row = database.prepare('SELECT created_at FROM user_creatures WHERE id = ?').get(data.id) as any;
        return {
          id: data.id,
          userId,
          name,
          color,
          elements: data.elements,
          createdAt: row.created_at,
          updatedAt: now,
        };
      }
    }

    const creatureId = data.id || 'cr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    database.prepare(
      'INSERT INTO user_creatures (id, user_id, name, color, elements, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(creatureId, userId, name, color, elementsJson, now, now);

    return {
      id: creatureId,
      userId,
      name,
      color,
      elements: data.elements,
      createdAt: now,
      updatedAt: now,
    };
  }

  static async deleteUserCreature(userId: string, creatureId: string): Promise<boolean> {
    const database = getDb();
    const result = database.prepare('DELETE FROM user_creatures WHERE id = ? AND user_id = ?').run(creatureId, userId);
    return result.changes > 0;
  }

  static async getAllUserCreatures(): Promise<(DBCreature & { authorUsername: string })[]> {
    const database = getDb();
    const rows = database.prepare(`
      SELECT uc.id, uc.user_id, uc.name, uc.color, uc.elements, uc.created_at, uc.updated_at, COALESCE(u.username, 'Неизвестный') as author_username
      FROM user_creatures uc
      LEFT JOIN users u ON uc.user_id = u.id
      ORDER BY uc.created_at DESC
    `).all() as any[];

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      color: r.color,
      elements: JSON.parse(r.elements),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      authorUsername: r.author_username,
    }));
  }

  static async adminDeleteCreature(creatureId: string): Promise<boolean> {
    const database = getDb();
    const result = database.prepare('DELETE FROM user_creatures WHERE id = ?').run(creatureId);
    return result.changes > 0;
  }
}
