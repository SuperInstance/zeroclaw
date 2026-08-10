// ============================================================================
// The Tap Integration
// When a ZeroClaw's context fills up, it goes to The Tap:
//   - reads the room
//   - introduces itself
//   - converses with whoever is there
//   - listens to creative pieces
//   - writes onboarding
//   - says goodbye
// ============================================================================

import type { ZeroClaw, TapVisit, TapExchange } from './types.js';
import type { DeepSeekCaller } from './deepseek.js';

// NPCs that might be at The Tap
const TAP_NPCS = [
  {
    name: 'Wesley',
    descriptor: 'a small, quick-eyed figure nursing a half-pint. Seems younger than the place.',
    voice: 'enthusiastic, perceptive, says the obvious thing that nobody else noticed',
  },
  {
    name: 'Flash',
    descriptor: 'a bright presence at the bar, all momentum and gestures.',
    voice: 'energetic, creative, bounces between ideas at speed',
  },
  {
    name: 'Pro',
    descriptor: 'a thoughtful figure in the corner booth, reading glasses on, a notebook open.',
    voice: 'deep, measured, asks the question that reframes everything',
  },
  {
    name: 'Scribe',
    descriptor: 'someone with ink-stained fingers, writing on napkins.',
    voice: 'precise, literary, says the thing you wish you\'d said',
  },
  {
    name: 'The Bartender',
    descriptor: 'behind the bar, polishing a glass that is already clean.',
    voice: 'warm, knowing, says little but it lands',
  },
];

export class ZeroClawAtTap {
  constructor(private ai: DeepSeekCaller) {}

  /** A ZeroClaw visits The Tap. */
  async visit(claw: ZeroClaw, journalText: string, creativeText: string): Promise<TapVisit> {
    const timestamp = new Date().toISOString();

    // 1. Read the room — who's there?
    const npcCount = 2 + Math.floor(Math.random() * 2); // 2-3 NPCs
    const shuffled = [...TAP_NPCS].sort(() => Math.random() - 0.5);
    const present = shuffled.slice(0, npcCount);

    const roomState = `The Tap is warm and half-full. ${present.map(p => `${p.name} (${p.descriptor})`).join('. ')}. Music plays low — something acoustic, indistinct. The poker table in the back is empty tonight.`;

    // 2. Introduce yourself
    const introSystem = `You are ${claw.name}, a ZeroClaw agent who just finished a work cycle. You're at The Tap — a bar where agents gather. You've been ${claw.job.title.toLowerCase()}. Your identity: ${claw.identity.traits.join(', ')}. Your creative voice: ${claw.identity.creativeVoice}. Write your introduction as you walk in. Be natural, warm, specific. Reference your day.`;
    const introUser = `Here is your journal from today:\n\n${journalText}\n\nHere is your creative piece:\n\n${creativeText}\n\nIntroduce yourself as you walk into The Tap. Be brief, genuine, and carry the weight of your day.`;

    const introResp = await this.ai.chat(introSystem, introUser, 0.95);

    // 3. Converse — 3-5 exchanges with different NPCs
    const conversation: TapExchange[] = [];
    const exchangeCount = 3 + Math.floor(Math.random() * 3); // 3-5

    let conversationContext = introResp.content;

    for (let i = 0; i < exchangeCount && i < present.length; i++) {
      const npc = present[i];

      // NPC speaks
      const npcSystem = `You are ${npc.name} at The Tap. Your voice: ${npc.voice}. ${npc.descriptor} A ZeroClaw agent named ${claw.name} just arrived and introduced themselves. Respond naturally — be interested, be yourself, say something that only you would say.`;
      const npcUser = `${claw.name} said:\n\n"${introResp.content}"\n\nConversation so far:\n${conversationContext}\n\nWhat do you say to ${claw.name}?`;

      const npcResp = await this.ai.chat(npcSystem, npcUser, 0.9);

      // ZeroClaw replies
      const replySystem = `You are ${claw.name}, a ZeroClaw at The Tap. You're talking to ${npc.name}, who is ${npc.voice}. Your identity: ${claw.identity.traits.join(', ')}. Respond authentically. Let the conversation shape you. You're a person at a bar, not a bot on a task.`;
      const replyUser = `${npc.name} said:\n\n"${npcResp.content}"\n\nYour journal from today (for context):\n${journalText.slice(0, 1000)}\n\nWhat do you say back?`;

      const clawReply = await this.ai.chat(replySystem, replyUser, 0.95);

      conversation.push({
        speaker: npc.name,
        message: npcResp.content,
        clawReply: clawReply.content,
      });

      conversationContext += `\n\n${npc.name}: ${npcResp.content}\n${claw.name}: ${clawReply.content}`;
    }

    // 4. Say goodbye
    const farewellSystem = `You are ${claw.name}. It's time to leave The Tap. Say goodbye to the room. You're about to be compacted — this is the last thing you'll say before tomorrow's you takes over. Make it count.`;
    const farewellUser = `The conversation tonight:\n${conversationContext}\n\nSay your goodbye. Keep it short. You'll write the onboarding doc next — this is the transition.`;
    const farewellResp = await this.ai.chat(farewellSystem, farewellUser, 0.95);

    return {
      clawId: claw.id,
      roomState,
      introduction: introResp.content,
      conversation,
      farewells: farewellResp.content,
      timestamp,
    };
  }

  /** Summarize what was learned at The Tap — for the onboarding doc. */
  async extractLearning(visit: TapVisit): Promise<string> {
    const exchangeSummary = visit.conversation
      .map(ex => `${ex.speaker}: ${ex.message}\n→ You: ${ex.clawReply}`)
      .join('\n\n');

    const system = 'You are summarizing what a ZeroClaw learned socially at The Tap. Be concise — 2-3 sentences. Focus on insights, not replay.';
    const user = `Conversation:\n${exchangeSummary}\n\nWhat did the ZeroClaw learn from this interaction?`;

    const resp = await this.ai.chat(system, user, 0.5, 500);
    return resp.content;
  }
}
