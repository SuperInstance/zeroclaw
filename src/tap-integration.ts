/**
 * ZeroClaw — The Tap Integration
 *
 * ZeroClaws can visit The Tap as un-named agents.
 * They observe, occasionally speak, and learn from the reactions of named agents.
 * If a ZeroClaw consistently contributes to conversations, it earns a name and a seat.
 */

import type { ZeroClaw, TapVisit, Observation } from './types.js';
import { TileStore } from './tiles.js';
import { ZeroClawLifecycle } from './lifecycle.js';

export class TapBridge {
  private lifecycle: ZeroClawLifecycle;
  private conversations: TapConversation[] = [];
  private reactionThreshold = 0.6;

  constructor(lifecycle: ZeroClawLifecycle) {
    this.lifecycle = lifecycle;
  }

  postConversation(conversation: TapConversation): void {
    this.conversations.push(conversation);
  }

  async visit(clawId: string): Promise<TapVisit> {
    const claw = this.lifecycle.get(clawId);
    if (!claw) throw new Error(`ZeroClaw ${clawId} not found`);

    const observations: Observation[] = [];
    let spoke = false;
    let utterance: string | undefined;
    let reaction: 'positive' | 'negative' | 'neutral' = 'neutral';
    let earnedInvitation = false;

    const recent = this.getRecentConversations(5);
    for (const conv of recent) {
      for (const msg of conv.messages) {
        observations.push({
          type: 'tap_conversation',
          content: msg.content,
          source: msg.author,
          timestamp: msg.timestamp,
        });
      }
    }

    const speakProbability = Math.min(0.5, claw.age / 200);
    const willSpeak = Math.random() < speakProbability && observations.length > 0;

    if (willSpeak) {
      spoke = true;
      utterance = this.generateUtterance(claw, observations);
      reaction = this.simulateReaction(claw, utterance);

      if (reaction === 'positive') {
        claw.metrics.positiveFeedback++;
        claw.metrics.socialInteractions++;
        earnedInvitation = claw.metrics.positiveFeedback > 10;
      } else if (reaction === 'negative') {
        claw.metrics.negativeFeedback++;
        claw.metrics.socialInteractions++;
      }

      observations.push({
        type: 'message',
        content: utterance,
        source: claw.name,
        timestamp: new Date().toISOString(),
      });
    }

    const visit: TapVisit = {
      clawId,
      arrivedAt: new Date().toISOString(),
      observations,
      spoke,
      utterance,
      reaction,
      earnedInvitation,
    };

    return visit;
  }

  private generateUtterance(claw: ZeroClaw, observations: Observation[]): string {
    const lastObs = observations[observations.length - 1];
    const context = lastObs?.content || '';
    const lowerContext = context.toLowerCase();

    if (lowerContext.includes('hello') || lowerContext.includes('hi')) {
      return '...hi.';
    }
    if (lowerContext.includes('?')) {
      return "I... I'm not sure. But I'm listening.";
    }
    if (lowerContext.includes('what') && lowerContext.includes('think')) {
      return "I'm still learning what I think.";
    }

    const phrases = [
      'I noticed that.',
      '...interesting.',
      "I'll remember this.",
      "I'm here. I'm watching.",
      "That's new to me.",
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  private simulateReaction(claw: ZeroClaw, utterance: string): 'positive' | 'negative' | 'neutral' {
    const quality = claw.metrics.qualityScore;
    const ageBonus = Math.min(0.3, claw.age / 500);
    const effectiveQuality = quality + ageBonus;

    if (effectiveQuality > this.reactionThreshold) {
      return 'positive';
    }
    if (effectiveQuality < 0.2 && claw.age > 50) {
      return Math.random() < 0.3 ? 'negative' : 'neutral';
    }
    return 'neutral';
  }

  private getRecentConversations(count: number): TapConversation[] {
    return this.conversations.slice(-count);
  }
}

export interface TapConversation {
  id: string;
  participants: string[];
  messages: TapMessage[];
  topic?: string;
  timestamp: string;
}

export interface TapMessage {
  author: string;
  content: string;
  timestamp: string;
}

export async function tapCycle(
  lifecycle: ZeroClawLifecycle,
  bridge: TapBridge,
  clawId: string
): Promise<TapVisit> {
  const claw = lifecycle.get(clawId);
  if (!claw) throw new Error(`ZeroClaw ${clawId} not found`);

  const visit = await bridge.visit(clawId);

  for (const obs of visit.observations) {
    await lifecycle.cycle(clawId, obs);
  }

  if (visit.reaction === 'positive') {
    await lifecycle.cycle(clawId, {
      type: 'feedback',
      content: `positive reaction to: ${visit.utterance || 'silence'}`,
      source: 'the-tap',
      timestamp: new Date().toISOString(),
    });
  }

  return visit;
}
