import { motion } from 'framer-motion';
import { Mic, MessageSquare, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InterviewStartProps {
  niche: string;
  onStart: () => void;
}

export function InterviewStart({ niche, onStart }: InterviewStartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card-elevated p-8 md:p-12 max-w-2xl mx-auto text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring' }}
        className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-8"
      >
        <Mic className="w-10 h-10 text-primary" />
      </motion.div>

      <h1 className="text-3xl md:text-4xl font-display font-bold mb-4">
        You're about to chat with someone who{' '}
        <span className="gradient-text-primary">gets it</span>
      </h1>

      <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto">
        Our AI interviewer is genuinely curious about{' '}
        <span className="text-foreground font-medium">{niche}</span>.
        Just talk naturally for 5-6 minutes.
      </p>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="glass-card p-4 text-left">
          <MessageSquare className="w-5 h-5 text-primary mb-2" />
          <h3 className="font-medium mb-1">Natural conversation</h3>
          <p className="text-sm text-muted-foreground">Like chatting with an enthusiast friend</p>
        </div>
        <div className="glass-card p-4 text-left">
          <Sparkles className="w-5 h-5 text-secondary mb-2" />
          <h3 className="font-medium mb-1">Deep understanding</h3>
          <p className="text-sm text-muted-foreground">We capture what makes you unique</p>
        </div>
        <div className="glass-card p-4 text-left">
          <Mic className="w-5 h-5 text-accent mb-2" />
          <h3 className="font-medium mb-1">5 minutes max</h3>
          <p className="text-sm text-muted-foreground">Quick but meaningful</p>
        </div>
      </div>

      <Button
        onClick={onStart}
        size="lg"
        className="h-14 px-10 btn-primary-glow text-lg font-semibold"
      >
        <Mic className="w-5 h-5 mr-2" />
        Start Voice Interview
      </Button>
    </motion.div>
  );
}
