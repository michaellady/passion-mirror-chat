import { motion } from 'framer-motion';

export function FloatingOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="floating-orb w-96 h-96 bg-primary"
        initial={{ x: -200, y: -100 }}
        animate={{ 
          x: [-200, -150, -200],
          y: [-100, -50, -100],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        style={{ left: '10%', top: '20%' }}
      />
      <motion.div
        className="floating-orb w-80 h-80 bg-secondary"
        initial={{ x: 100, y: 50 }}
        animate={{ 
          x: [100, 150, 100],
          y: [50, 100, 50],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        style={{ right: '15%', top: '30%' }}
      />
      <motion.div
        className="floating-orb w-64 h-64 bg-accent"
        initial={{ x: 0, y: 0 }}
        animate={{ 
          x: [0, 50, 0],
          y: [0, -30, 0],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{ left: '50%', bottom: '20%' }}
      />
    </div>
  );
}
