import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadarChart } from './RadarChart';
import { PassionMeter } from './PassionMeter';
import { TraitAnalysis } from '@/lib/types';

interface PassionCardProps {
  displayName: string;
  niche: string;
  traits: TraitAnalysis;
  onContinue: () => void;
}

export function PassionCard({ displayName, niche, traits, onContinue }: PassionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      className="glass-card-elevated overflow-hidden max-w-lg mx-auto"
    >
      {/* Header */}
      <div className="p-6 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg">@{displayName}</h3>
            <p className="text-sm text-muted-foreground">"{niche}"</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="p-6 space-y-6">
        {/* Radar Chart */}
        <div className="py-4">
          <RadarChart big5={traits.big5} />
        </div>

        {/* Passion Meter */}
        <PassionMeter score={traits.passionScore} />

        {/* Archetype */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-center"
        >
          <p className="text-sm text-muted-foreground mb-2">Archetype</p>
          <div className="inline-flex items-center gap-2 archetype-badge">
            <Sparkles className="w-4 h-4" />
            <span>{traits.archetype}</span>
          </div>
        </motion.div>

        {/* Tags */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <p className="text-sm text-muted-foreground mb-3">Micro-Tags</p>
          <div className="flex flex-wrap gap-2">
            {traits.tags.map((tag, i) => (
              <motion.span
                key={tag}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9 + i * 0.1 }}
                className="tag-chip"
              >
                {tag}
              </motion.span>
            ))}
          </div>
        </motion.div>

        {/* Deep Hooks */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <p className="text-sm text-muted-foreground mb-3">"Ask me about..."</p>
          <ul className="space-y-2">
            {traits.deepHooks.map((hook, i) => (
              <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                {hook}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* CTA */}
      <div className="p-6 pt-0">
        <Button
          onClick={onContinue}
          className="w-full h-12 btn-primary-glow font-semibold"
        >
          Enter Your Communities
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  );
}
