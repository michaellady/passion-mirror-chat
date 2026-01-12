import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FloatingOrbs } from '@/components/ui/FloatingOrbs';
import { PassionCard } from '@/components/results/PassionCard';
import { auth } from '@/lib/auth';
import { api } from '@/lib/api';
import { TraitAnalysis, Profile } from '@/lib/types';
import { Loader2 } from 'lucide-react';

const Results = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [traits, setTraits] = useState<TraitAnalysis | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await auth.getSession();
      if (!session) { navigate('/'); return; }

      const [profileRes, traitsRes] = await Promise.all([
        api.getProfile(session.user.id),
        api.getTraits(session.user.id),
      ]);

      if (profileRes.data) setProfile(profileRes.data as Profile);
      if (traitsRes.data) {
        const t = traitsRes.data;
        setTraits({
          big5: t.big5 as TraitAnalysis['big5'],
          passionScore: t.passion_score,
          archetype: t.archetype as TraitAnalysis['archetype'],
          tags: t.tags || [],
          deepHooks: t.deep_hooks || [],
        });
      }
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

  if (!profile || !traits) return null;

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <FloatingOrbs />
      <div className="relative z-10">
        <PassionCard
          displayName={profile.display_name}
          niche={profile.niche_interest}
          traits={traits}
          onContinue={() => navigate('/rooms')}
        />
      </div>
    </div>
  );
};

export default Results;
