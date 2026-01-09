export type Archetype = 'Quiet Builder' | 'Curious Explorer' | 'Warm Connector' | 'Storyteller' | 'Calm Analyst';

export interface Big5 {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export interface TraitAnalysis {
  big5: Big5;
  passionScore: number;
  archetype: Archetype;
  tags: string[];
  deepHooks: string[];
}

export interface Profile {
  id: string;
  display_name: string;
  niche_interest: string;
  avatar_url?: string;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  nimrobo_session_id?: string;
  nimrobo_link?: string;
  status: 'pending' | 'active' | 'completed' | 'analyzed' | 'failed';
  transcript?: string;
  created_at: string;
  completed_at?: string;
}

export interface Traits {
  user_id: string;
  big5: Big5;
  passion_score: number;
  archetype: Archetype;
  tags: string[];
  deep_hooks: string[];
  updated_at: string;
}

export interface Room {
  id: string;
  name: string;
  slug: string;
  type: 'interest' | 'vibe';
  description?: string;
  created_at: string;
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  joined_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
}
