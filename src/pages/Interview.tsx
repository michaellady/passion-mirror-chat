import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FloatingOrbs } from '@/components/ui/FloatingOrbs';
import { InterviewStart } from '@/components/interview/InterviewStart';
import { InterviewWaiting } from '@/components/interview/InterviewWaiting';
import { supabase } from '@/integrations/supabase/client';
import { analyzeTranscript } from '@/lib/analysis';
import { assignUserToClusters } from '@/lib/clustering';
import { toast } from 'sonner';

const Interview = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const niche = searchParams.get('niche') || 'your passion';
  const [stage, setStage] = useState<'start' | 'waiting'>('start');
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/auth?niche=' + encodeURIComponent(niche));
      else setUserId(session.user.id);
    });
  }, [navigate, niche]);

  const handleStart = async () => {
    if (!userId) return;
    
    try {
      // Call edge function to start Nimrobo session
      const { data, error } = await supabase.functions.invoke('start-interview', {
        body: { niche }
      });

      if (error) throw error;

      if (data?.session_url) {
        setSessionUrl(data.session_url);
        // Open Nimrobo session in new tab
        window.open(data.session_url, '_blank');
      }
      
      setStage('waiting');
    } catch (error) {
      console.error('Failed to start interview:', error);
      toast.error('Failed to start interview. Using demo mode.');
      // Fallback to demo mode
      setStage('waiting');
    }
  };

  const handleComplete = async () => {
    if (!userId) return;
    
    // Demo: Generate sample transcript and analyze
    const demoTranscript = `I absolutely love ${niche}! It's fascinating how deep you can go. I remember when I first discovered this passion - it was incredible. I've been exploring and building my knowledge ever since. The community is amazing and I love sharing with others who understand.`;
    
    const traits = analyzeTranscript(demoTranscript, niche);
    
    // Save traits to database
    await supabase.from('traits').upsert([{
      user_id: userId,
      big5: JSON.parse(JSON.stringify(traits.big5)),
      passion_score: traits.passionScore,
      archetype: traits.archetype,
      tags: traits.tags,
      deep_hooks: traits.deepHooks,
    }], { onConflict: 'user_id' });

    // Assign to clusters
    await assignUserToClusters(userId, traits, niche);
    
    navigate('/results');
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <FloatingOrbs />
      <div className="relative z-10 w-full">
        {stage === 'start' && <InterviewStart niche={niche} onStart={handleStart} />}
        {stage === 'waiting' && (
          <InterviewWaiting 
            onComplete={handleComplete} 
            voiceLink={sessionUrl || undefined}
          />
        )}
      </div>
    </div>
  );
};

export default Interview;
