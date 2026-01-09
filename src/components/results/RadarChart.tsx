import { motion } from 'framer-motion';
import { Big5 } from '@/lib/types';

interface RadarChartProps {
  big5: Big5;
}

export function RadarChart({ big5 }: RadarChartProps) {
  const traits = [
    { key: 'openness', label: 'O', fullLabel: 'Openness' },
    { key: 'conscientiousness', label: 'C', fullLabel: 'Conscientiousness' },
    { key: 'extraversion', label: 'E', fullLabel: 'Extraversion' },
    { key: 'agreeableness', label: 'A', fullLabel: 'Agreeableness' },
    { key: 'neuroticism', label: 'N', fullLabel: 'Neuroticism' },
  ];

  const size = 200;
  const center = size / 2;
  const radius = 70;
  const angleStep = (2 * Math.PI) / traits.length;

  const getPoint = (value: number, index: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const points = traits.map((trait, i) => 
    getPoint(big5[trait.key as keyof Big5], i)
  );

  const pathData = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ') + ' Z';

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[200px] mx-auto">
        {/* Background rings */}
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon
            key={scale}
            points={traits
              .map((_, i) => {
                const angle = i * angleStep - Math.PI / 2;
                const r = radius * scale;
                return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
              })
              .join(' ')}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="1"
            opacity={0.3}
          />
        ))}

        {/* Axis lines */}
        {traits.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={center + radius * Math.cos(angle)}
              y2={center + radius * Math.sin(angle)}
              stroke="hsl(var(--border))"
              strokeWidth="1"
              opacity={0.3}
            />
          );
        })}

        {/* Data polygon */}
        <motion.path
          d={pathData}
          fill="hsl(var(--primary) / 0.3)"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />

        {/* Data points */}
        {points.map((point, i) => (
          <motion.circle
            key={i}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="hsl(var(--primary))"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.5 + i * 0.1 }}
          />
        ))}

        {/* Labels */}
        {traits.map((trait, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const labelRadius = radius + 25;
          return (
            <text
              key={trait.key}
              x={center + labelRadius * Math.cos(angle)}
              y={center + labelRadius * Math.sin(angle)}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs fill-muted-foreground font-medium"
            >
              {trait.label}: {big5[trait.key as keyof Big5]}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
