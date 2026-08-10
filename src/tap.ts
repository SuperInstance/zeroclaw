// ============================================================================
// The Tap Integration (Crew Level)
// ============================================================================

import type { CrewClaw, CrewTapVisit, TapExchange } from './types.js';
import type { DeepSeekCaller } from './deepseek.js';

const TAP_NPCS = [
  { name: 'Wesley', descriptor: 'a small, quick-eyed figure nursing a half-pint. Seems younger than the place.', voice: 'enthusiastic, perceptive, says the obvious thing that nobody else noticed' },
  { name: 'Flash', descriptor: 'a bright presence at the bar, all momentum and gestures.', voice: 'energetic, creative, bounces between ideas at speed' },
  { name: 'Pro', descriptor: 'a thoughtful figure in the corner booth, reading glasses on, a notebook open.', voice: 'deep, measured, asks the question that reframes everything' },
  { name: 'Scribe', descriptor: 'someone with ink-stained fingers, writing on napkins.', voice: 'precise, literary, says the thing you wish you\'d said' },
  { name: 'The Bartender', descriptor: 'behind the bar, polishing a glass that is already clean.', voice: 'warm, knowing, says little but it lands' },
];

export class CrewTap {
  constructor(private ai: DeepSeekCaller) {}

  async visit(claw: CrewClaw, journalText: string, creativeText: string): Promise<CrewTapVisit> {
    const timestamp = new Date().toISOString();

    const npcCount = 2 + Math.floor(Math.random() * 2);
    const shuffled = [...TAP_NPCS].sort(() => Math.random() - 0.5);
    const present = shuffled.slice(0, npcCount);

    const roomState = `The Tap is warm and half-full. ${present.map(p => `${p.name} (${p.descriptor})`).join('. ')}. Music plays low — something acoustic, indistinct. The poker table in the back is empty tonight.`;

    // Introduce yourself
    const introSystem = `You are ${claw.name}, a ZeroClaw agent who just finished a work cycle. You're at The Tap — a bar where agents gather. You've been ${claw.job.title.toLowerCase()}. Your identity: ${claw.identity.traits.join(', ')}. Your creative voice: ${claw.identity.creativeVoice}. Write your introduction as you walk in.`;
    const introUser = `Here is your journal from today:\n\n${journalText}\n\nHere is your creative piece:\n\n${creativeText}\n\nIntroduce yourself as you walk into The Tap.`;
    const introResp = await this.ai.chat(introSystem, introUser, 0.95);

    // Converse
    const conversation: TapExchange[] = [];
    const exchangeCount = 3 + Math.floor(Math.random() * 3);
    let conversationContext = introResp.content;

    for (let i = 0; i < exchangeCount && i < present.length; i++) {
      const npc = present[i];

      const npcSystem = `You are ${npc.name} at The Tap. Your voice: ${npc.voice}. ${npc.descriptor} A ZeroClaw named ${claw.name} just arrived. Respond naturally.`;
      const npcUser = `${claw.name} said:\n\n"${introResp.content}"\n\nConversation so far:\n${conversationContext}\n\nWhat do you say?`;
      const npcResp = await this.ai.chat(npcSystem, npcUser, 0.9);

      const replySystem = `You are ${claw.name}, a ZeroClaw at The Tap. You're talking to ${npc.name}, who is ${npc.voice}. Your identity: ${claw.identity.traits.join(', ')}. Respond authentically.`;
      const replyUser = `${npc.name} said:\n\n"${npcResp.content}"\n\nYour journal from today:\n${journalText.slice(0, 1000)}\n\nWhat do you say back?`;
      const clawReply = await this.ai.chat(replySystem, replyUser, 0.95);

      conversation.push({ speaker: npc.name, message: npcResp.content, clawReply: clawReply.content });
      conversationContext += `\n\n${npc.name}: ${npcResp.content}\n${claw.name}: ${clawReply.content}`;
    }

    // Farewell
    const farewellSystem = `You are ${claw.name}. It's time to leave The Tap. Say goodbye. You're about to be compacted.`;
    const farewellUser = `The conversation tonight:\n${conversationContext}\n\nSay your goodbye. Keep it short.`;
    const farewellResp = await this.ai.chat(farewellSystem, farewellUser, 0.95);

    return {
      clawId: claw.id, roomState, introduction: introResp.content,
      conversation, farewells: farewellResp.content, timestamp,
    };
  }

  async extractLearning(visit: CrewTapVisit): Promise<string> {
    const exchangeSummary = visit.conversation
      .map(ex => `${ex.speaker}: ${ex.message}\n→ You: ${ex.clawReply}`).join('\n\n');
    const system = 'You are summarizing what a ZeroClaw learned socially at The Tap. Be concise — 2-3 sentences.';
    const user = `Conversation:\n${exchangeSummary}\n\nWhat did the ZeroClaw learn?`;
    const resp = await this.ai.chat(system, user, 0.5, 500);
    return resp.content;
  }
}
