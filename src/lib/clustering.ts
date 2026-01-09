import { supabase } from '@/integrations/supabase/client';
import { Room, TraitAnalysis, Archetype } from './types';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

function getArchetypeDescription(archetype: Archetype): string {
  const descriptions: Record<Archetype, string> = {
    'Quiet Builder': 'Creators who find joy in the craft, building with patience and precision.',
    'Curious Explorer': 'Seekers who delight in discovery, always asking "what if?"',
    'Warm Connector': 'Sharers who bring people together through their passions.',
    'Storyteller': 'Narrators who weave experiences into captivating tales.',
    'Calm Analyst': 'Thinkers who find beauty in understanding the details.',
  };
  return descriptions[archetype];
}

async function findRoomBySlug(slug: string): Promise<Room | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('slug', slug)
    .single();
  
  if (error || !data) return null;
  return data as Room;
}

async function createRoom(room: Omit<Room, 'id' | 'created_at'>): Promise<Room> {
  const { data, error } = await supabase
    .from('rooms')
    .insert(room)
    .select()
    .single();
  
  if (error) throw error;
  return data as Room;
}

async function addMemberToRoom(roomId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('room_members')
    .upsert({ room_id: roomId, user_id: userId }, { onConflict: 'room_id,user_id' });
  
  if (error) throw error;
}

export async function assignUserToClusters(
  userId: string,
  traits: TraitAnalysis,
  niche: string
): Promise<{ interestRoom: Room; vibeRoom: Room }> {
  // 1. INTEREST HUB: Based on primary tag or niche
  const interestSlug = `interest-${slugify(traits.tags[0] || niche)}`;
  let interestRoom = await findRoomBySlug(interestSlug);
  
  if (!interestRoom) {
    interestRoom = await createRoom({
      name: `${traits.tags[0] || niche} Enthusiasts`,
      slug: interestSlug,
      type: 'interest',
      description: `A community for people passionate about ${traits.tags[0] || niche}`,
    });
  }
  
  // 2. VIBE LOUNGE: Based on archetype
  const vibeSlug = `vibe-${slugify(traits.archetype)}`;
  let vibeRoom = await findRoomBySlug(vibeSlug);
  
  if (!vibeRoom) {
    vibeRoom = await createRoom({
      name: `The ${traits.archetype}s`,
      slug: vibeSlug,
      type: 'vibe',
      description: getArchetypeDescription(traits.archetype),
    });
  }
  
  // 3. Add user to both rooms
  await addMemberToRoom(interestRoom.id, userId);
  await addMemberToRoom(vibeRoom.id, userId);
  
  return { interestRoom, vibeRoom };
}

export async function getUserRooms(userId: string): Promise<Room[]> {
  const { data, error } = await supabase
    .from('room_members')
    .select('rooms(*)')
    .eq('user_id', userId);
  
  if (error) throw error;
  
  return (data || [])
    .map((rm: any) => rm.rooms)
    .filter(Boolean) as Room[];
}
