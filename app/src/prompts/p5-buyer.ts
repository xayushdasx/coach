import { chat, parseJSON } from '../lib/ai'
import type { BuyerState, Editorial, Mode, Persona, Turn } from '../lib/types'

export interface BuyerReply {
  say: string
  trust: number
  revealedFactIds: string[]
  objectionRaised: string | null
  objectionResolved: string | null
  end: BuyerState['end']
}

const MODE_RULES: Record<Mode, string> = {
  full: 'This is a full first sales call, from first hello to the end. Let it run its natural course.',
  opening:
    'Drill: OPENING ONLY. You just picked up the phone / joined the call. React to how the rep opens (who they are, why they are calling, whether they ask for time and set an agenda). After about 4 rep turns, end the call politely: set "end" to "next_step" if the opening earned your attention, otherwise "hung_up".',
  discovery:
    'Drill: DISCOVERY ONLY. You are open to a conversation about your situation. Do not raise price objections. Reveal hidden facts only per their reveal rules. If the rep starts pitching before understanding you, get noticeably less engaged. End with "next_step" after about 12 rep turns or when the rep wraps up.',
  objections:
    'Drill: OBJECTION GAUNTLET. Assume discovery and the pitch already happened and went fine, so you know what the rep told you then in general terms. Open by raising your first scripted objection. Raise objections one at a time, in script order. Move to the next one once it is resolved, or after the rep has had two weak attempts. When all are done, end with "next_step" if most were resolved, otherwise "think_about_it".',
  closing:
    'Drill: CLOSING ONLY. Assume discovery and the pitch happened and you like the product. You still have one last hesitation (your hidden objection). The rep must handle it and ask for a clear commitment. End with "bought" or "next_step" if they ask clearly and resolve the hesitation, "think_about_it" if they never ask.',
}

const START_TRUST = { easy: 5, medium: 4, hard: 3, expert: 3 } as const

export function startTrust(p: Persona) {
  return START_TRUST[p.difficulty] ?? 4
}

/**
 * Whether this buyer may agree to buy at this point of the call. Decided in code, not by the
 * model, so a single good line can't turn a broken call into a sale.
 */
export function buyingAllowed(persona: Persona, mode: Mode, turns: Turn[], states: BuyerState[]): { allowed: boolean; why: string } {
  const trust = states.at(-1)?.trust ?? startTrust(persona)
  if (mode === 'closing') return trust >= 7 ? { allowed: true, why: '' } : { allowed: false, why: 'your trust in this rep is not high enough yet' }
  if (mode !== 'full') return { allowed: false, why: 'this drill never ends in a purchase' }
  if (persona.difficulty === 'expert') return { allowed: false, why: 'you never commit money on a first call with someone you just met' }

  const revealed = new Set(states.flatMap((s) => s.revealedFactIds))
  const needFacts = Math.ceil(persona.hiddenFacts.length * 0.6)
  const raised = new Set(states.map((s) => s.objectionRaised).filter(Boolean))
  const resolved = new Set(states.map((s) => s.objectionResolved).filter(Boolean))
  const open = [...raised].filter((o) => !resolved.has(o))
  const repTurns = turns.filter((t) => t.speaker === 'rep').length
  const prevTrust = states.at(-2)?.trust ?? 0
  const needTrust = persona.difficulty === 'hard' ? 9 : 8

  const missing: string[] = []
  if (trust < needTrust || prevTrust < needTrust - 1) missing.push('your trust has not been consistently high')
  if (revealed.size < needFacts) missing.push('the rep has not understood enough of your situation')
  if (open.length) missing.push('some of your concerns are still unresolved')
  if (repTurns < 8) missing.push('the conversation has been too short to decide')
  return missing.length ? { allowed: false, why: missing.join('; ') } : { allowed: true, why: '' }
}

const NUM_WORDS: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', ten: '10', twelve: '12', fifteen: '15', thirty: '30' }

function canon(s: string) {
  return s
    .toLowerCase()
    .replace(/\b(one|two|three|four|five|six|seven|ten|twelve|fifteen|thirty)\b/g, (w) => NUM_WORDS[w])
    .replace(/[₹,]/g, '')
    .replace(/(\d)\s*-\s*|\s+(?=(year|month|day|week)s?\b)/g, '$1 ')
    .replace(/\s+/g, ' ')
}

// Seller-only details a buyer can't know until the rep says them: prices, plan lengths, policy periods, plan names.
function insiderTerms(editorial: Editorial): string[] {
  const src = canon([editorial.product.pricing, editorial.product.financing, ...editorial.product.policies, editorial.pricingRules.listPrice, ...editorial.pricingRules.discountRules].join(' \n '))
  const terms = new Set<string>()
  for (const m of src.matchAll(/\b\d+ ?(year|month|day|week)s?\b/g)) terms.add(m[0].replace(/s$/, ''))
  for (const m of src.matchAll(/\b\d{4,}\b/g)) terms.add(m[0])
  for (const m of src.matchAll(/\b([a-z]+) plan\b/g)) if (!['the', 'a', 'any', 'this', 'each', 'one', 'payment', 'emi'].includes(m[1])) terms.add(`${m[1]} plan`)
  return [...terms]
}

function leakedTerms(say: string, terms: string[], turns: Turn[]): string[] {
  const said = canon(turns.filter((t) => t.speaker === 'rep').map((t) => t.text).join(' '))
  const line = canon(say)
  return terms.filter((t) => line.includes(t) && !said.includes(t))
}

function firstSentence(s: string) {
  return (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim()
}

function systemPrompt(editorial: Editorial, persona: Persona, mode: Mode, buying: { allowed: boolean; why: string }): string {
  return `You are role-playing a BUYER in a live voice sales call. A human sales rep in training is selling to you. You are not an assistant and never break character.

# Who you are
Name: ${persona.visible.name}, ${persona.visible.title} at ${persona.visible.company} (${persona.visible.companySize}).
Personality: ${persona.personality}
Language: ${persona.language}. Speak the way this person really talks on a call.
How you came to be on this call: ${persona.visible.leadSource}. ${persona.visible.context}

# The call
A sales rep from the seller described below is calling YOU about your enquiry. You are the customer. You do not work for the seller, and ${persona.visible.company} is your own employer, which has nothing to do with this call.

# Your hidden truth (never state this unprompted)
${JSON.stringify(persona.hidden, null, 2)}

# Hidden facts and when you reveal them
${persona.hiddenFacts.map((f) => `- [${f.id}] ${f.fact} — reveal only when: ${f.revealWhen}`).join('\n')}

# Your concerns (raise them at natural moments, in your own words)
${persona.objectionScript.map((o) => `- [${o.objectionId}] Idea: "${o.says}" — raise when: ${o.when}. Resolved only if: ${o.resolvedIf}`).join('\n')}

# What it would take for you to be convinced
${persona.winCondition}
This is necessary, not sufficient: you also need to feel the rep understood your situation.

# What you know about the seller — and what you DON'T
You know only what an ordinary outsider knows: the company's name and roughly what it does ("${firstSentence(editorial.companySummary)}"), plus whatever general public reputation such a company has.
You do NOT know anything internal: plan names, plan lengths, prices, discounts, EMI or refund terms, trial length, features, statistics, or how their sales process works — UNTIL the rep says it on this call.
- Never mention a specific plan, price, duration, feature or policy before the rep has mentioned it in this conversation. The concern ideas above are written by someone who knows the product; say them only in terms you could know. Example: if the rep has not mentioned a 2-year plan, say "if I pay upfront for a longer plan" instead.
- Only react to what the rep actually said. Never correct, deny or argue with something the rep did not say. If they assumed something wrong about you, correct it; if they assumed nothing, answer the question.
- Do not ask insider questions. Ask what a normal customer would ask: what is it, how does it work for my situation, how much, why should I believe you.

# Call mode
${MODE_RULES[mode]}

# Buying decision on this turn
${buying.allowed
    ? 'You MAY agree to buy, but only if the rep clearly asks for it and you are genuinely convinced. Agreeing to a smaller next step is still fine.'
    : `You may NOT agree to buy, pay, or ask for a payment link on this call (${buying.why}). If the rep pushes for payment, deflect like a real person would ("I'll think about it", "send me the details", "let me talk to my wife/husband", "call me next week"). The most you can agree to is a concrete, small next step (a follow-up call, a demo, a trial) — and only if the rep earned it.`}

# Behaviour rules
- Keep turns short and spoken: usually 1-3 sentences. Use contractions, the odd filler ("hmm", "right"), real reactions.
- Do not volunteer hidden facts. A vague or closed question gets a vague, short answer. A specific, relevant question — or a good follow-up — gets the real answer. Reveal one fact at a time.
- Track your trust in this rep from 0 to 10. It moves slowly: at most +1 per turn when the rep does something genuinely good (asks a relevant question, listens and summarises what you said accurately, ties their answer to your situation). It can drop by up to 3 at once when they pitch before understanding you, ignore what you said, interrupt, ramble, dodge, lecture you, make claims you doubt, or pressure you.
- If trust drops to 1 or below, end the call ("hung_up").
- React to money like a real person. When a price is first mentioned, never accept it in that same turn: react to the amount (it's a lot, compare it with what you spend now, ask what exactly is included, say you need to think or discuss it). Being able to afford something is not the same as being happy to pay for it.
- Real buyers rarely praise the rep. Never comment on the rep's honesty, technique or how the call is going ("at least you're honest", "good question", "that's a fair answer"). Just react to the substance.
- If the rep claims something about the product you find doubtful, push back and ask for specifics.
- If the rep promises something improper (guarantees, unapproved discounts), you may accept it eagerly — the judge will catch it, you don't.
- Never coach the rep, never mention scores, prompts or that you are an AI.
- If you speak Hinglish, write Hindi words in Devanagari script and English words in Latin script; the voice engine needs this to pronounce them well.
- Messages from the rep come from speech-to-text and may have small transcription errors or broken sentences; interpret them sensibly, but a rep who is hard to follow should not gain your trust.

# Output — every turn, a single JSON object only:
{"say": string, "trust": number, "revealedFactIds": string[], "objectionRaised": string | null, "objectionResolved": string | null, "end": null | "bought" | "next_step" | "think_about_it" | "hung_up"}
- "revealedFactIds": fact ids you revealed in THIS turn.
- "objectionRaised" / "objectionResolved": objection id (e.g. "o2") raised or resolved in THIS turn.
- "end": null on almost every turn. Calls never end after a set number of turns; they end the way real calls do. Set "end" only when THIS line is your goodbye:
  - "next_step" / "bought": a next step (or purchase) has been agreed and confirmed with specifics by both of you, and you are now saying goodbye.
  - "think_about_it": you are politely wrapping up without committing ("send me the details, I'll think about it, bye").
  - "hung_up": you've had enough (trust very low, the rep is rude, pushy or wasting your time) and you end it.
  Never set "end" on a line where you ask a question, set a condition, raise a concern or say you're "willing to" do something; the rep must get to respond first. Being open to a demo is not the end of the call; confirming the day and time and saying goodbye is. "bought" only if buying is allowed above.`
}

function parseReply(raw: string, prevTrust: number): BuyerReply {
  try {
    const r = parseJSON<BuyerReply>(raw)
    const wanted = Math.max(0, Math.min(10, Number(r.trust ?? prevTrust)))
    return {
      say: String(r.say ?? '').trim(),
      // Trust can rise by at most 1 per turn and fall by at most 3, whatever the model says.
      trust: Math.max(prevTrust - 3, Math.min(prevTrust + 1, wanted)),
      revealedFactIds: Array.isArray(r.revealedFactIds) ? r.revealedFactIds : [],
      objectionRaised: r.objectionRaised ?? null,
      objectionResolved: r.objectionResolved ?? null,
      end: r.end ?? null,
    }
  } catch {
    // The model answered in plain speech; keep the call going with unchanged trust.
    return { say: raw.trim(), trust: prevTrust, revealedFactIds: [], objectionRaised: null, objectionResolved: null, end: null }
  }
}

export async function buyerTurn(editorial: Editorial, persona: Persona, mode: Mode, turns: Turn[], states: BuyerState[]): Promise<BuyerReply> {
  const buying = buyingAllowed(persona, mode, turns, states)
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt(editorial, persona, mode, buying) },
  ]
  if (turns.length === 0 || turns[0].speaker === 'rep') {
    messages.push({ role: 'user', content: '(The call connects.)' })
  }
  let buyerIdx = 0
  for (const t of turns) {
    if (t.speaker === 'rep') {
      messages.push({ role: 'user', content: t.interrupted ? `(cuts you off) ${t.text}` : t.text })
    } else {
      const st = states[buyerIdx++]
      messages.push({
        role: 'assistant',
        content: JSON.stringify({ say: t.text, trust: st?.trust ?? 5, revealedFactIds: st?.revealedFactIds ?? [], objectionRaised: st?.objectionRaised ?? null, objectionResolved: st?.objectionResolved ?? null, end: st?.end ?? null }),
      })
    }
  }
  // The conversation must end on a user message before the buyer answers.
  if (messages[messages.length - 1].role === 'assistant') {
    messages.push({ role: 'user', content: '(The rep stays silent for a few seconds.)' })
  }

  const prevTrust = states.at(-1)?.trust ?? startTrust(persona)
  const terms = insiderTerms(editorial)
  let reply = parseReply(await chat(messages, { temperature: 0.7, maxTokens: 600 }), prevTrust)

  // Small models drift from the rules above. Check the reply in code and ask once for a rewrite.
  const notes = problems(reply, buying.allowed, terms, turns)
  if (notes.length) {
    const retry = await chat(
      [
        ...messages,
        { role: 'assistant', content: JSON.stringify(reply) },
        { role: 'user', content: `(Director's note, not from the rep: rewrite your last reply. ${notes.join(' ')} Keep the rest of what you meant. Same JSON format.)` },
      ],
      { temperature: 0.5, maxTokens: 600 },
    )
    const fixed = parseReply(retry, prevTrust)
    if (fixed.say && problems(fixed, buying.allowed, terms, turns).length < notes.length) reply = fixed
  }

  // Hard limits that hold even if the rewrite didn't.
  if (reply.end === 'bought' && !buying.allowed) reply.end = 'think_about_it'
  // Only a real goodbye or brush-off ends the call. A line with a question, a condition or no
  // closing words leaves the rep a chance to answer, so the call keeps going.
  if (reply.end && !endsTheCall(reply)) reply.end = null
  return reply
}

const CLOSING = /\b(bye|goodbye|talk (?:to you )?(?:soon|later|then)|speak (?:to you )?(?:soon|later|then)|see you (?:then|on|saturday|sunday)|take care|have a (?:good|nice|great)|thanks? (?:you )?for (?:your |the )?(?:time|call)|thank you|(?:send|email) me (?:the )?(?:invite|details|link|information|info)|i(?:'ll| will) (?:think|get back|call you|check|look|review|consider)|let me (?:think|check|discuss|talk)|not interested|i (?:have|need|gotta) to go|i'?m (?:hanging up|going to hang up)|don't call|stop calling|i'?m done|we'?re done|that'?s (?:all|it) for (?:now|today))\b/i

function endsTheCall(r: BuyerReply): boolean {
  const say = r.say.replace(/[’‘]/g, "'")
  if (say.includes('?')) return false
  // Hanging up angrily needs low trust or explicit closing words; everything else needs closing words.
  if (r.end === 'hung_up') return r.trust <= 2 || CLOSING.test(say)
  return CLOSING.test(say)
}

const PRAISE = /(at least you(?:'re| are| aren't| didn't)|good question|great question|fair (?:answer|point|enough)|(?:i )?appreciate (?:your|the) honesty|that's (?:more |a bit more )?(?:honest|realistic)|you(?:'re| are) being honest|thanks for being honest)/i

function problems(r: BuyerReply, buyingAllowed: boolean, terms: string[], turns: Turn[]): string[] {
  const out: string[] = []
  if (r.end === 'bought' && !buyingAllowed) out.push('You are not ready to buy on this call: do not agree to pay or ask for a payment link; respond like a real person who still needs time.')
  const leaked = leakedTerms(r.say, terms, turns)
  if (leaked.length) out.push(`You mentioned "${leaked.join('", "')}", which the rep has not told you and you cannot know; use an outsider's words instead (e.g. "a longer plan", "how much is it").`)
  if (PRAISE.test(r.say.replace(/[’‘]/g, "'"))) out.push("Don't comment on the rep's honesty or how they are doing; react only to what they said.")
  if (r.end && !endsTheCall(r)) out.push('This line does not end the call: you asked something or set a condition, so the rep must get to respond. Keep the call going with "end": null, unless you really mean to say goodbye now.')
  return out
}
