import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, queryOne } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'passion-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

interface User {
  id: string;
  email: string;
  display_name: string;
  niche_interest: string;
  created_at: string;
}

interface SignupInput {
  email: string;
  password: string;
  display_name: string;
  niche_interest: string;
}

interface SigninInput {
  email: string;
  password: string;
}

export async function handleSignup(input: SignupInput): Promise<{ user?: User; token?: string; error?: string }> {
  const { email, password, display_name, niche_interest } = input;

  if (!email || !password || !display_name || !niche_interest) {
    return { error: 'Missing required fields' };
  }

  // Check if user exists
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existing) {
    return { error: 'Email already registered' };
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const [user] = await query<User>(
    `INSERT INTO users (email, password_hash, display_name, niche_interest)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, display_name, niche_interest, created_at`,
    [email, passwordHash, display_name, niche_interest]
  );

  // Create profile (for backwards compatibility with existing code)
  await query(
    `INSERT INTO profiles (id, display_name, niche_interest)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [user.id, display_name, niche_interest]
  );

  // Generate token
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return { user, token };
}

export async function handleSignin(input: SigninInput): Promise<{ user?: User; token?: string; error?: string }> {
  const { email, password } = input;

  if (!email || !password) {
    return { error: 'Email and password required' };
  }

  // Get user
  const user = await queryOne<User & { password_hash: string }>(
    `SELECT id, email, display_name, niche_interest, password_hash, created_at
     FROM users WHERE email = $1`,
    [email]
  );

  if (!user) {
    return { error: 'Invalid email or password' };
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return { error: 'Invalid email or password' };
  }

  // Generate token
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  // Return user without password_hash
  const { password_hash: _, ...safeUser } = user;
  return { user: safeUser, token };
}

export async function handleGetSession(token?: string): Promise<{ user?: User; error?: string }> {
  if (!token) {
    return { error: 'No token provided' };
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };

    const user = await queryOne<User>(
      `SELECT id, email, display_name, niche_interest, created_at
       FROM users WHERE id = $1`,
      [payload.userId]
    );

    if (!user) {
      return { error: 'User not found' };
    }

    return { user };
  } catch {
    return { error: 'Invalid or expired token' };
  }
}

export async function verifyAuth(authHeader?: string): Promise<{ user?: { id: string }; error?: string }> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    return { user: { id: payload.userId } };
  } catch {
    return { error: 'Invalid or expired token' };
  }
}
