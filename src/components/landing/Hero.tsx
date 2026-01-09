import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Users, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Hero() {
  const [niche, setNiche] = useState('');
  const navigate = useNavigate();

  const handleStart = () => {
    if (niche.trim()) {
      navigate(`/auth?niche=${encodeURIComponent(niche.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleStart();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center max-w-3xl mx-auto"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-2 glass-card mb-8"
        >
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm text-muted-foreground">Find your micro-community</span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-5xl md:text-7xl font-display font-bold mb-6 leading-tight"
        >
          Connect through your{' '}
          <span className="gradient-text-primary">weirdest</span>{' '}
          <span className="gradient-text-passion">obsessions</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-xl text-muted-foreground mb-12 max-w-xl mx-auto"
        >
          Voice interview. Personality mirror. Niche communities.
          Find people who <em>actually</em> get it.
        </motion.p>

        {/* Niche input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto mb-12"
        >
          <Input
            type="text"
            placeholder="vintage synthesizers, rare succulents, speedcubing..."
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 h-14 px-6 text-lg bg-muted/50 border-border/50 focus:border-primary placeholder:text-muted-foreground/60"
          />
          <Button
            onClick={handleStart}
            disabled={!niche.trim()}
            className="h-14 px-8 btn-primary-glow font-semibold text-lg"
          >
            Start Interview
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>

        {/* Feature highlights */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary" />
            <span>5-min voice interview</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-secondary" />
            <span>Passion analysis</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            <span>Auto-matched communities</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
