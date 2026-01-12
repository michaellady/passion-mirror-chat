import { api } from './api';
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
  const { data } = await api.getRoomBySlug(slug);
  return data;
}

async function createRoom(room: Omit<Room, 'id' | 'created_at'>): Promise<Room> {
  const { data, error } = await api.createRoom(room);
  if (error || !data) throw error || new Error('Failed to create room');
  return data;
}

async function addMemberToRoom(roomId: string): Promise<void> {
  const { error } = await api.joinRoom(roomId);
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

  // 3. Add user to both rooms (userId is from auth context, API knows the user)
  await addMemberToRoom(interestRoom.id);
  await addMemberToRoom(vibeRoom.id);

  return { interestRoom, vibeRoom };
}
