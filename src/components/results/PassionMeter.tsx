import { motion } from 'framer-motion';

interface PassionMeterProps {
  score: number;
}

export function PassionMeter({ score }: PassionMeterProps) {
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-muted-foreground">Passion Score</span>
        <span className="text-lg font-bold gradient-text-passion">{score}/100</span>
      </div>
      
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full passion-meter rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
