import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Room, Message, Profile } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface ChatRoomProps {
  room: Room;
  userId: string;
  deepHooks?: string[];
}

export function ChatRoom({ room, userId, deepHooks = [] }: ChatRoomProps) {
  const [messages, setMessages] = useState<(Message & { profile?: Profile })[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Fetch existing messages
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', room.id)
        .order('created_at', { ascending: true });
      
      if (data) {
        setMessages(data as Message[]);
        
        // Fetch profiles for message authors
        const userIds = [...new Set(data.map(m => m.user_id))];
        if (userIds.length > 0) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .in('id', userIds);
          
          if (profileData) {
            const profileMap: Record<string, Profile> = {};
            profileData.forEach(p => {
              profileMap[p.id] = p as Profile;
            });
            setProfiles(profileMap);
          }
        }
      }
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${room.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          
          // Fetch profile if not cached
          if (!profiles[newMsg.user_id]) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', newMsg.user_id)
              .single();
            
            if (profileData) {
              setProfiles(prev => ({ ...prev, [newMsg.user_id]: profileData as Profile }));
            }
          }
          
          setMessages(prev => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const { error } = await supabase
      .from('messages')
      .insert({
        room_id: room.id,
        user_id: userId,
        content: newMessage.trim(),
      });

    if (!error) {
      setNewMessage('');
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col glass-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-lg">{room.name}</h2>
            <p className="text-sm text-muted-foreground">{room.description}</p>
          </div>
          <span className="tag-chip text-xs">
            {room.type === 'interest' ? 'Interest Hub' : 'Vibe Lounge'}
          </span>
        </div>
      </div>

      {/* Conversation starters */}
      {deepHooks.length > 0 && (
        <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Conversation Starters</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {deepHooks.slice(0, 3).map((hook, i) => (
              <button
                key={i}
                onClick={() => setNewMessage(hook)}
                className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                {hook}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence mode="popLayout">
          {messages.map((message) => {
            const profile = profiles[message.user_id];
            const isOwn = message.user_id === userId;
            
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className={`flex-1 max-w-[70%] ${isOwn ? 'text-right' : ''}`}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {profile?.display_name || 'User'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div
                    className={`inline-block px-4 py-2 rounded-2xl ${
                      isOwn
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted rounded-bl-sm'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/50">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="btn-primary-glow"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
