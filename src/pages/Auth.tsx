import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { FloatingOrbs } from '@/components/ui/FloatingOrbs';
import { AuthForm } from '@/components/auth/AuthForm';
import { auth } from '@/lib/auth';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const niche = searchParams.get('niche') || 'your passion';

  useEffect(() => {
    const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate('/interview?niche=' + encodeURIComponent(niche));
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, niche]);

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <FloatingOrbs />
      <AuthForm niche={niche} onSuccess={() => navigate('/interview?niche=' + encodeURIComponent(niche))} />
    </div>
  );
};

export default Auth;
