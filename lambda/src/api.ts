import { query, queryOne } from './db.js';

// Profiles
export async function handleGetProfile(id: string) {
  return queryOne(
    'SELECT id, display_name, niche_interest, avatar_url, created_at FROM profiles WHERE id = $1',
    [id]
  );
}

export async function handleGetProfiles(ids: string[]) {
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  return query(
    `SELECT id, display_name, niche_interest, avatar_url, created_at FROM profiles WHERE id IN (${placeholders})`,
    ids
  );
}

// Traits
export async function handleGetTraits(userId: string) {
  return queryOne(
    'SELECT user_id, big5, passion_score, archetype, tags, deep_hooks, updated_at FROM traits WHERE user_id = $1',
    [userId]
  );
}

interface TraitsInput {
  big5: object;
  passion_score: number;
  archetype: string;
  tags: string[];
  deep_hooks: string[];
}

export async function handleUpsertTraits(userId: string, input: TraitsInput) {
  try {
    await query(
      `INSERT INTO traits (user_id, big5, passion_score, archetype, tags, deep_hooks, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         big5 = EXCLUDED.big5,
         passion_score = EXCLUDED.passion_score,
         archetype = EXCLUDED.archetype,
         tags = EXCLUDED.tags,
         deep_hooks = EXCLUDED.deep_hooks,
         updated_at = NOW()`,
      [userId, JSON.stringify(input.big5), input.passion_score, input.archetype, input.tags, input.deep_hooks]
    );
    return { success: true };
  } catch (error) {
    console.error('Traits upsert error:', error);
    return { error: 'Failed to save traits' };
  }
}

// Rooms
export async function handleGetRooms() {
  return query('SELECT id, name, slug, type, description, created_at FROM rooms ORDER BY created_at DESC');
}

export async function handleGetRoomBySlug(slug: string) {
  return queryOne(
    'SELECT id, name, slug, type, description, created_at FROM rooms WHERE slug = $1',
    [slug]
  );
}

interface RoomInput {
  name: string;
  slug: string;
  type: 'interest' | 'vibe';
  description?: string;
}

export async function handleCreateRoom(input: RoomInput) {
  try {
    const [room] = await query(
      `INSERT INTO rooms (name, slug, type, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, slug, type, description, created_at`,
      [input.name, input.slug, input.type, input.description || null]
    );
    return room;
  } catch (error: unknown) {
    // Handle unique constraint violation (room already exists)
    if ((error as { code?: string }).code === '23505') {
      return queryOne(
        'SELECT id, name, slug, type, description, created_at FROM rooms WHERE slug = $1',
        [input.slug]
      );
    }
    console.error('Room creation error:', error);
    return { error: 'Failed to create room' };
  }
}

// Room Members
export async function handleGetUserRooms(userId: string) {
  return query(
    `SELECT r.id, r.name, r.slug, r.type, r.description, r.created_at
     FROM rooms r
     INNER JOIN room_members rm ON r.id = rm.room_id
     WHERE rm.user_id = $1
     ORDER BY rm.joined_at DESC`,
    [userId]
  );
}

export async function handleAddRoomMember(roomId: string, userId: string) {
  try {
    await query(
      `INSERT INTO room_members (room_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (room_id, user_id) DO NOTHING`,
      [roomId, userId]
    );
    return { success: true };
  } catch (error) {
    console.error('Add room member error:', error);
    return { error: 'Failed to add room member' };
  }
}

// Messages
export async function handleGetMessages(roomId: string) {
  return query(
    `SELECT id, room_id, user_id, content, created_at
     FROM messages
     WHERE room_id = $1
     ORDER BY created_at ASC`,
    [roomId]
  );
}

interface MessageInput {
  room_id: string;
  content: string;
}

export async function handleCreateMessage(userId: string, input: MessageInput) {
  try {
    const [message] = await query(
      `INSERT INTO messages (room_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, room_id, user_id, content, created_at`,
      [input.room_id, userId, input.content]
    );
    return message;
  } catch (error) {
    console.error('Create message error:', error);
    return { error: 'Failed to create message' };
  }
}

// Sessions
interface SessionUpdateInput {
  status?: string;
  transcript?: string;
}

export async function handleUpdateSession(userId: string, input: SessionUpdateInput) {
  try {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.status) {
      updates.push(`status = $${paramIndex}`);
      values.push(input.status);
      paramIndex++;
    }

    if (input.transcript) {
      updates.push(`transcript = $${paramIndex}`);
      values.push(input.transcript);
      paramIndex++;
    }

    if (input.status === 'completed' || input.status === 'analyzed') {
      updates.push(`completed_at = NOW()`);
    }

    if (updates.length === 0) {
      return { error: 'No fields to update' };
    }

    values.push(userId);

    await query(
      `UPDATE sessions SET ${updates.join(', ')}
       WHERE user_id = $${paramIndex} AND status IN ('pending', 'active', 'completed')`,
      values
    );

    return { success: true };
  } catch (error) {
    console.error('Session update error:', error);
    return { error: 'Failed to update session' };
  }
}
