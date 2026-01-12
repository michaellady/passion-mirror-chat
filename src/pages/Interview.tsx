import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FloatingOrbs } from '@/components/ui/FloatingOrbs';
import { InterviewStart } from '@/components/interview/InterviewStart';
import { InterviewWaiting } from '@/components/interview/InterviewWaiting';
import { auth } from '@/lib/auth';
import { api } from '@/lib/api';
import { analyzeTranscript } from '@/lib/analysis';
import { assignUserToClusters } from '@/lib/clustering';
import { toast } from 'sonner';

const POLL_INTERVAL = 5000; // 5 seconds

const Interview = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const niche = searchParams.get('niche') || 'your passion';
  const [stage, setStage] = useState<'start' | 'waiting'>('start');
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<string>('');

  useEffect(() => {
    auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/auth?niche=' + encodeURIComponent(niche));
      else setUserId(session.user.id);
    });
  }, [navigate, niche]);

  const processTranscript = useCallback(async (rawTranscript: string) => {
    if (!userId) return;
    
    // Parse the transcript - it might be JSON from Nimrobo
    let textTranscript = rawTranscript;
    try {
      const parsed = JSON.parse(rawTranscript);
      // Extract just the user messages from the conversation
      if (parsed.messages && Array.isArray(parsed.messages)) {
        textTranscript = parsed.messages
          .filter((m: { role: string; content: string }) => m.role === 'user')
          .map((m: { content: string }) => m.content)
          .join(' ');
      } else if (Array.isArray(parsed)) {
        textTranscript = parsed
          .filter((m: { role: string; content: string }) => m.role === 'user')
          .map((m: { content: string }) => m.content)
          .join(' ');
      }
    } catch {
      // Not JSON, use as-is
      console.log('Transcript is plain text');
    }
    
    console.log('Processing transcript:', textTranscript.slice(0, 200));
    
    const traits = analyzeTranscript(textTranscript, niche);
    console.log('Analyzed traits:', traits);

    const { error: traitsError } = await api.upsertTraits({
      big5: traits.big5,
      passion_score: traits.passionScore,
      archetype: traits.archetype,
      tags: traits.tags,
      deep_hooks: traits.deepHooks,
    });

    if (traitsError) {
      console.error('Failed to save traits:', traitsError);
      toast.error('Failed to save results');
      return;
    }

    try {
      await assignUserToClusters(userId, traits, niche);
    } catch (clusterError) {
      console.error('Clustering error (non-fatal):', clusterError);
    }

    // Update session status to analyzed
    await api.updateSession({ status: 'analyzed' });

    navigate('/results');
  }, [userId, niche, navigate]);

  const checkInterviewStatus = useCallback(async () => {
    try {
      const { data, error } = await api.checkInterviewStatus();

      if (error) {
        console.error('Status check error:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Failed to check status:', err);
      return null;
    }
  }, []);

  // Polling effect
  useEffect(() => {
    if (!isPolling || stage !== 'waiting') return;

    const pollForCompletion = async () => {
      const result = await checkInterviewStatus();
      
      if (!result) {
        setPollingStatus('Checking...');
        return;
      }

      if (result.status === 'pending') {
        setPollingStatus('Waiting for you to start the interview...');
      } else if (result.status === 'active') {
        setPollingStatus('Interview in progress...');
      } else if (result.status === 'completed' && result.transcript) {
        setPollingStatus('Interview complete! Analyzing your responses...');
        setIsPolling(false);
        toast.success('Interview completed! Processing your results...');
        await processTranscript(result.transcript);
      } else if (result.status === 'failed') {
        setPollingStatus('Something went wrong. Please try again.');
        setIsPolling(false);
        toast.error('Interview session failed. Please try again.');
      }
    };

    // Initial check
    pollForCompletion();

    // Set up interval
    const intervalId = setInterval(pollForCompletion, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isPolling, stage, checkInterviewStatus, processTranscript]);

  const handleStart = async () => {
    if (!userId) return;

    try {
      const { data, error } = await api.startInterview(niche);

      if (error) throw error;

      if (data?.session_url) {
        setSessionUrl(data.session_url);
        setIsPolling(true);

        // Move to waiting stage first, then let the user click to open
        // This is more reliable across browsers (Brave, Safari, etc.)
        setStage('waiting');

        // Try to open automatically, but don't rely on it
        // Some browsers block window.open after async calls
        const newWindow = window.open(data.session_url, '_blank', 'noopener,noreferrer');
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          // Popup was blocked - user will need to click the button
          toast.info('Click "Open Interview" to start your session');
        }
      } else {
        setStage('waiting');
      }
    } catch (error) {
      console.error('Failed to start interview:', error);
      toast.error('Failed to start interview. Using demo mode.');
      setStage('waiting');
    }
  };

  const handleDemoComplete = async () => {
    if (!userId) return;
    
    const demoTranscript = `I absolutely love ${niche}! It's fascinating how deep you can go. I remember when I first discovered this passion - it was incredible. I've been exploring and building my knowledge ever since. The community is amazing and I love sharing with others who understand. What really excites me is how there's always something new to learn. I've spent countless hours diving into the details, and every time I think I've seen it all, something surprises me. My favorite part is connecting with other enthusiasts who share this passion.`;
    
    await processTranscript(demoTranscript);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <FloatingOrbs />
      <div className="relative z-10 w-full">
        {stage === 'start' && <InterviewStart niche={niche} onStart={handleStart} />}
        {stage === 'waiting' && (
          <InterviewWaiting 
            onDemoComplete={handleDemoComplete}
            voiceLink={sessionUrl || undefined}
            pollingStatus={pollingStatus}
            isPolling={isPolling}
          />
        )}
      </div>
    </div>
  );
};

export default Interview;
