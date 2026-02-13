import { describe, it, expect } from 'vitest';

// Test the mock agent logic in isolation
function summarize(text: string, maxPoints: number) {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return sentences.slice(0, maxPoints).map((s) => s.trim());
}

function sentimentAnalysis(text: string) {
  const positiveWords = ['good', 'great', 'excellent', 'happy', 'love', 'wonderful', 'amazing'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible'];
  const lower = text.toLowerCase();
  const posCount = positiveWords.filter((w) => lower.includes(w)).length;
  const negCount = negativeWords.filter((w) => lower.includes(w)).length;

  if (posCount > negCount) return { label: 'positive', score: Math.min(0.5 + posCount * 0.1, 0.99) };
  if (negCount > posCount) return { label: 'negative', score: Math.min(0.5 + negCount * 0.1, 0.99) };
  return { label: 'neutral', score: 0.5 };
}

describe('Mock Agent: Summarize', () => {
  it('should extract sentences as summary points', () => {
    const text = 'First sentence. Second sentence. Third sentence.';
    const result = summarize(text, 2);
    expect(result).toEqual(['First sentence', 'Second sentence']);
  });

  it('should handle empty text', () => {
    const result = summarize('', 3);
    expect(result).toEqual([]);
  });

  it('should respect max_points limit', () => {
    const text = 'One. Two. Three. Four. Five.';
    const result = summarize(text, 3);
    expect(result.length).toBe(3);
  });
});

describe('Mock Agent: Sentiment', () => {
  it('should detect positive sentiment', () => {
    const result = sentimentAnalysis('This is a great and wonderful product');
    expect(result.label).toBe('positive');
    expect(result.score).toBeGreaterThan(0.5);
  });

  it('should detect negative sentiment', () => {
    const result = sentimentAnalysis('This is terrible and horrible');
    expect(result.label).toBe('negative');
    expect(result.score).toBeGreaterThan(0.5);
  });

  it('should detect neutral sentiment', () => {
    const result = sentimentAnalysis('The sky is blue');
    expect(result.label).toBe('neutral');
    expect(result.score).toBe(0.5);
  });
});
