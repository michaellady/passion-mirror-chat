import { Archetype, Big5, TraitAnalysis } from './types';

// Calculate passion score based on linguistic markers
export function calculatePassionScore(transcript: string): number {
  let score = 50;
  
  const enthusiasmMarkers = ['love', 'obsessed', 'fascinating', 'amazing', 'incredible', 'awesome', 'passionate', 'exciting'];
  const detailMarkers = ['specific', 'exactly', 'precisely', 'particular', 'actually', 'technically'];
  const storyMarkers = ['remember when', 'this one time', 'story', 'happened', 'experience'];
  
  const lowerTranscript = transcript.toLowerCase();
  
  // Count enthusiasm markers
  enthusiasmMarkers.forEach(marker => {
    const count = (lowerTranscript.match(new RegExp(marker, 'gi')) || []).length;
    score += count * 3;
  });
  
  // Count exclamation marks
  const exclamations = (transcript.match(/!/g) || []).length;
  score += Math.min(exclamations * 2, 15);
  
  // Count detail markers
  detailMarkers.forEach(marker => {
    const count = (lowerTranscript.match(new RegExp(marker, 'gi')) || []).length;
    score += count * 2;
  });
  
  // Count story markers
  storyMarkers.forEach(marker => {
    const count = (lowerTranscript.match(new RegExp(marker, 'gi')) || []).length;
    score += count * 4;
  });
  
  // Longer responses indicate more engagement
  const wordCount = transcript.split(/\s+/).length;
  score += Math.min(wordCount / 20, 15);
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

// Estimate Big 5 personality traits from transcript
export function estimateBig5(transcript: string): Big5 {
  const lowerTranscript = transcript.toLowerCase();
  
  // Openness indicators
  const opennessWords = ['curious', 'creative', 'imagine', 'explore', 'discover', 'new', 'different', 'unique'];
  const openness = 50 + opennessWords.reduce((acc, word) =>
    acc + (lowerTranscript.match(new RegExp(word, 'gi')) || []).length * 5, 0);

  // Conscientiousness indicators
  const conscientiousnessWords = ['careful', 'organized', 'detail', 'plan', 'practice', 'learn', 'study', 'research'];
  const conscientiousness = 50 + conscientiousnessWords.reduce((acc, word) =>
    acc + (lowerTranscript.match(new RegExp(word, 'gi')) || []).length * 5, 0);

  // Extraversion indicators
  const extraversionWords = ['people', 'friends', 'community', 'share', 'together', 'social', 'group', 'meet'];
  const extraversion = 50 + extraversionWords.reduce((acc, word) =>
    acc + (lowerTranscript.match(new RegExp(word, 'gi')) || []).length * 5, 0);

  // Agreeableness indicators
  const agreeablenessWords = ['help', 'care', 'kind', 'support', 'understand', 'appreciate', 'grateful', 'love'];
  const agreeableness = 50 + agreeablenessWords.reduce((acc, word) =>
    acc + (lowerTranscript.match(new RegExp(word, 'gi')) || []).length * 5, 0);

  // Neuroticism indicators (inverse scoring)
  const neuroticismWords = ['worry', 'stress', 'anxious', 'nervous', 'afraid', 'scared'];
  const neuroticism = 30 + neuroticismWords.reduce((acc, word) =>
    acc + (lowerTranscript.match(new RegExp(word, 'gi')) || []).length * 8, 0);
  
  return {
    openness: Math.min(100, Math.max(0, openness)),
    conscientiousness: Math.min(100, Math.max(0, conscientiousness)),
    extraversion: Math.min(100, Math.max(0, extraversion)),
    agreeableness: Math.min(100, Math.max(0, agreeableness)),
    neuroticism: Math.min(100, Math.max(0, neuroticism)),
  };
}

// Classify archetype based on Big5 and transcript
export function classifyArchetype(transcript: string, big5: Big5): Archetype {
  const lowerTranscript = transcript.toLowerCase();
  
  const storytellingWords = ['story', 'tell', 'narrative', 'remember', 'once', 'happened'];
  const buildingWords = ['build', 'create', 'make', 'craft', 'design', 'construct'];
  const exploringWords = ['discover', 'explore', 'wonder', 'curious', 'question', 'find'];
  const connectingWords = ['share', 'together', 'community', 'friends', 'people', 'connect'];
  const analyzingWords = ['analyze', 'think', 'consider', 'understand', 'research', 'study'];
  
  const scores = {
    storytelling: storytellingWords.reduce((acc, word) => 
      acc + (lowerTranscript.match(new RegExp(word, 'gi')) || []).length, 0),
    building: buildingWords.reduce((acc, word) => 
      acc + (lowerTranscript.match(new RegExp(word, 'gi')) || []).length, 0),
    exploring: exploringWords.reduce((acc, word) => 
      acc + (lowerTranscript.match(new RegExp(word, 'gi')) || []).length, 0),
    connecting: connectingWords.reduce((acc, word) => 
      acc + (lowerTranscript.match(new RegExp(word, 'gi')) || []).length, 0),
    analyzing: analyzingWords.reduce((acc, word) => 
      acc + (lowerTranscript.match(new RegExp(word, 'gi')) || []).length, 0),
  };
  
  // Combine with Big5 traits
  const combinedScores = {
    'Storyteller': scores.storytelling * 2 + (big5.extraversion > 60 ? 5 : 0),
    'Quiet Builder': scores.building * 2 + (big5.conscientiousness > 60 ? 5 : 0) + (big5.extraversion < 50 ? 3 : 0),
    'Curious Explorer': scores.exploring * 2 + (big5.openness > 60 ? 5 : 0),
    'Warm Connector': scores.connecting * 2 + (big5.agreeableness > 60 ? 5 : 0) + (big5.extraversion > 50 ? 3 : 0),
    'Calm Analyst': scores.analyzing * 2 + (big5.conscientiousness > 50 ? 3 : 0) + (big5.neuroticism < 40 ? 3 : 0),
  };
  
  const sorted = Object.entries(combinedScores).sort((a, b) => b[1] - a[1]);
  return sorted[0][0] as Archetype;
}

// Extract micro-culture tags from transcript
export function extractTags(transcript: string, niche: string): string[] {
  const words = transcript.toLowerCase().split(/\s+/);
  const nicheWords = niche.toLowerCase().split(/\s+/);
  
  // Find specific nouns and phrases that go beyond the base niche
  const potentialTags: Map<string, number> = new Map();
  
  // Look for multi-word phrases
  for (let i = 0; i < words.length - 1; i++) {
    const twoWord = `${words[i]} ${words[i + 1]}`;
    const threeWord = i < words.length - 2 ? `${words[i]} ${words[i + 1]} ${words[i + 2]}` : null;
    
    // Skip common words and the base niche itself
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 'do', 'does', 'did', 'i', 'you', 'we', 'they', 'it', 'this', 'that', 'really', 'just', 'very', 'about', 'like', 'when', 'what', 'how', 'why', 'where', 'who'];
    
    if (!nicheWords.includes(words[i]) && !commonWords.includes(words[i]) && words[i].length > 3) {
      potentialTags.set(words[i], (potentialTags.get(words[i]) || 0) + 1);
    }
    
    if (!commonWords.includes(words[i]) && !commonWords.includes(words[i + 1])) {
      potentialTags.set(twoWord, (potentialTags.get(twoWord) || 0) + 2);
    }
    
    if (threeWord && !commonWords.includes(words[i]) && !commonWords.includes(words[i + 2])) {
      potentialTags.set(threeWord, (potentialTags.get(threeWord) || 0) + 3);
    }
  }
  
  // Sort by frequency and take top 5
  const sorted = Array.from(potentialTags.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
  
  // Ensure we have at least 3 tags
  if (sorted.length < 3) {
    sorted.push(niche);
    sorted.push('Enthusiast');
    sorted.push('Deep Diver');
  }
  
  return sorted.slice(0, 5);
}

// Generate conversation starter questions
export function generateDeepHooks(transcript: string, tags: string[], niche: string): string[] {
  const hooks: string[] = [];
  
  // Template-based generation
  if (tags.length > 0) {
    hooks.push(`What's the story behind your interest in ${tags[0].toLowerCase()}?`);
  }
  
  if (tags.length > 1) {
    hooks.push(`How did you first discover ${tags[1].toLowerCase()}?`);
  }
  
  hooks.push(`If you could spend an entire day pursuing ${niche}, what would you do?`);
  
  // Look for specific mentions in transcript
  const experienceMatch = transcript.match(/remember when|this one time|experience/i);
  if (experienceMatch) {
    hooks.push(`Tell me more about your favorite ${niche} experience!`);
  }
  
  return hooks.slice(0, 3);
}

// Main analysis function
export function analyzeTranscript(transcript: string, niche: string): TraitAnalysis {
  const passionScore = calculatePassionScore(transcript);
  const big5 = estimateBig5(transcript);
  const archetype = classifyArchetype(transcript, big5);
  const tags = extractTags(transcript, niche);
  const deepHooks = generateDeepHooks(transcript, tags, niche);
  
  return {
    big5,
    passionScore,
    archetype,
    tags,
    deepHooks,
  };
}
