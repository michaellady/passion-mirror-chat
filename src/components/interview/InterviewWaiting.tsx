import { motion } from 'framer-motion';
import { Loader2, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InterviewWaitingProps {
  voiceLink?: string;
  onDemoComplete: () => void;
  pollingStatus?: string;
  isPolling?: boolean;
}

export function InterviewWaiting({ voiceLink, onDemoComplete, pollingStatus, isPolling }: InterviewWaitingProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass-card-elevated p-8 md:p-12 max-w-2xl mx-auto text-center"
    >
      {/* Animated voice visualization */}
      <div className="relative w-32 h-32 mx-auto mb-8">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border-2 border-primary/30"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.4,
              ease: 'easeInOut',
            }}
          />
        ))}
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      </div>

      <h2 className="text-2xl font-display font-bold mb-4">
        Take your time... we'll be here when you're done
      </h2>

      <p className="text-muted-foreground mb-4">
        Your interview is happening in the other tab. When you're finished, we'll automatically
        process your conversation and reveal your passion profile.
      </p>

      {/* Polling status indicator */}
      {isPolling && pollingStatus && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 text-sm text-primary mb-6"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{pollingStatus}</span>
        </motion.div>
      )}

      {voiceLink && (
        <div className="flex flex-col gap-3 mb-6">
          <Button
            asChild
            size="lg"
            className="text-base"
          >
            <a href={voiceLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-5 h-5 mr-2" />
              Open Interview
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            Click to open your voice interview in a new tab
          </p>
        </div>
      )}

      {/* Demo mode button */}
      <div className="border-t border-border/50 pt-6 mt-6">
        <p className="text-sm text-muted-foreground mb-3">
          Don't have a microphone? Skip with sample data
        </p>
        <Button
          variant="secondary"
          onClick={onDemoComplete}
        >
          Skip with Demo Data
        </Button>
      </div>
    </motion.div>
  );
}
