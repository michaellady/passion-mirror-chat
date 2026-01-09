import { motion } from 'framer-motion';
import { Hash, Sparkles, Users } from 'lucide-react';
import { Room } from '@/lib/types';
import { cn } from '@/lib/utils';

interface RoomSidebarProps {
  rooms: Room[];
  selectedRoom: Room | null;
  onSelectRoom: (room: Room) => void;
  memberCounts?: Record<string, number>;
}

export function RoomSidebar({ rooms, selectedRoom, onSelectRoom, memberCounts = {} }: RoomSidebarProps) {
  const interestRooms = rooms.filter(r => r.type === 'interest');
  const vibeRooms = rooms.filter(r => r.type === 'vibe');

  const RoomItem = ({ room }: { room: Room }) => (
    <motion.button
      whileHover={{ x: 4 }}
      onClick={() => onSelectRoom(room)}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
        selectedRoom?.id === room.id
          ? 'bg-primary/20 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {room.type === 'interest' ? (
        <Hash className="w-4 h-4 flex-shrink-0" />
      ) : (
        <Sparkles className="w-4 h-4 flex-shrink-0" />
      )}
      <span className="truncate flex-1 text-sm font-medium">{room.name}</span>
      {memberCounts[room.id] && (
        <span className="text-xs text-muted-foreground">{memberCounts[room.id]}</span>
      )}
    </motion.button>
  );

  return (
    <div className="w-64 glass-card p-4 flex flex-col gap-6 h-full">
      <div>
        <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Your Rooms
        </h2>
      </div>

      {interestRooms.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
            Interest Hubs
          </h3>
          <div className="space-y-1">
            {interestRooms.map(room => (
              <RoomItem key={room.id} room={room} />
            ))}
          </div>
        </div>
      )}

      {vibeRooms.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
            Vibe Lounges
          </h3>
          <div className="space-y-1">
            {vibeRooms.map(room => (
              <RoomItem key={room.id} room={room} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
