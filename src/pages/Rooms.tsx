import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoomSidebar } from '@/components/rooms/RoomSidebar';
import { ChatRoom } from '@/components/rooms/ChatRoom';
import { auth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Room } from '@/lib/types';
import { Loader2, MessageSquare } from 'lucide-react';

const Rooms = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [deepHooks, setDeepHooks] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await auth.getSession();
      if (!session) { navigate('/'); return; }

      setUserId(session.user.id);
      const { data: userRooms } = await api.getUserRooms();
      if (userRooms) {
        setRooms(userRooms);
        if (userRooms.length > 0) setSelectedRoom(userRooms[0]);
      }

      // Get deep hooks from user traits
      const { data: traitsData } = await api.getTraits(session.user.id);
      if (traitsData?.deep_hooks) setDeepHooks(traitsData.deep_hooks);

      setLoading(false);
    };
    fetchData();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex p-4 gap-4">
      <RoomSidebar rooms={rooms} selectedRoom={selectedRoom} onSelectRoom={setSelectedRoom} />
      <div className="flex-1">
        {selectedRoom && userId ? (
          <ChatRoom room={selectedRoom} userId={userId} deepHooks={deepHooks} />
        ) : (
          <div className="h-full glass-card flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a room to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Rooms;
