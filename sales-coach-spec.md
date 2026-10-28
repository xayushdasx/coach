# Sales Coach — Design Spec (v0)

Scope for v0: **Sales Coach** (Customer Support Coach reuses the same pipeline later).
Running example used throughout: an EdTech company selling a ₹1.2L, 6-month Data Science program over phone/video calls.

---

## 1. The big picture

```
Company admin uploads info
        │
        ▼
[1] Ingestion & Extraction ──► structured Company Knowledge (JSON)
        │
        ▼
[2] Editorial ("Sales Brief") ──► admin reviews & approves  ◄── human in the loop
        │
        ▼
[3] Scenario & Persona Generator ──► library of buyer personas + scenarios
        │
        ▼
[4] Learn / Quiz  (product + process knowledge)
        │
        ▼
[5] Voice Simulation  (AI plays the buyer, trainee sells)
        │
        ▼
[6] Evaluation  (metrics from audio/transcript + LLM judge with rubric)
        │
        ▼
[7] Report  (trainee report + manager dashboard + next drill)
```

Each numbered box is one **prompt pipeline stage**. Output of each stage is stored and versioned, so the buyer
simulation and the judge always point to a specific approved Editorial version.

---

## 2. The sales lifecycle → what gets tested

Every stage below = one section of the rubric. Not every company uses every stage (a one-call EdTech close skips
"Demo" and "Multi-stakeholder"; an enterprise SaaS deal uses all). The Editorial decides which stages are active
and their weights.

### Stage 0 — Pre-call preparation
What a good rep does before dialing: reads the lead info, forms a hypothesis, plans questions.
- Did they use the lead info given (name, background, source of lead, past interactions)?
- Did they have a call objective (book demo / close / qualify out)?
- **How to test:** before the simulated call, show a lead card and ask "What's your plan for this call?" (30-sec
  voice or text answer). Score the plan, then check if they followed it.

### Stage 1 — Opening & rapport (first 30–60 sec)
- Introduction: name, company, reason for call — clear and confident
- Permission / time check ("Is this a good time for 10 minutes?")
- Personalization (referencing what the lead did — downloaded brochure, attended webinar)
- Agenda setting ("I'll ask a few questions, then share if the program fits")
- Rapport without being fake; energy and tone
- **Fail signals:** launching into the pitch in the first minute, sounding scripted, no reason for the call.

### Stage 2 — Discovery / needs analysis (the most important stage, usually most weight)
- **Current situation:** what they do now (job, education, salary band, skills)
- **Goal / desired state:** switch to data science, promotion, salary jump
- **Pain / gap:** why they can't get there today
- **Motivation & urgency:** why now? what happens if they don't act?
- **Past attempts:** tried YouTube / other courses? why didn't it work?
- **Decision process:** who else decides (parents, spouse, manager, L&D head), how they decide
- **Budget & financing:** can they pay, need EMI / loan / company sponsorship
- **Timeline:** when do they want to start
- Question quality: open vs closed, follow-up depth ("tell me more…"), not interrogating
- Active listening: summarizing back what the buyer said
- **Qualification frameworks to support:** BANT, MEDDIC/MEDDPICC (B2B), SPIN, or the company's own. The
  Editorial picks one.
- **Key mechanic:** the buyer persona has *hidden facts* (real pain, real budget, hidden objection, real decision
  maker). The judge checks **which hidden facts the trainee uncovered**. This is objective and very coachable.

### Stage 3 — Pitch / value presentation
- Pitch tailored to what was discovered (not a generic brochure recital)
- Maps features → buyer's specific pain ("you said weekends only — our live classes are Sat/Sun")
- Clarity and structure; no jargon dump
- Social proof: relevant success stories, placement stats (only *approved* ones)
- Differentiation vs alternatives (free YouTube, competitors, doing nothing)
- Checking for understanding / buy-in during the pitch ("Does that sound like what you need?")

### Stage 4 — Demo / walkthrough (B2B or demo-led sales only)
- Shows only what matters to this buyer
- Story-led, not feature tour
- Handles "can it do X?" honestly

### Stage 5 — Objection handling
Test against the company's real objection list plus the universal ones:
- **Price:** "Too expensive" / "Competitor is cheaper"
- **Time:** "I don't have time with my job"
- **Trust:** "Is this legit? Will I really get a job?"
- **Authority:** "I need to ask my parents / spouse / manager"
- **Stall:** "Send me details on WhatsApp, I'll think about it"
- **Need:** "I can learn this free on YouTube"
- **Competitor:** "X is offering the same"
- **Timing:** "Maybe next batch"
- **Past bad experience:** "I bought a course before and never finished"
- Scored on: acknowledging/empathizing → clarifying the *real* objection (the stated one is often not the real
  one) → responding with relevant value/evidence → confirming it's resolved
- **Fail signals:** arguing, getting defensive, immediately discounting, ignoring it, false promises.

### Stage 6 — Pricing & negotiation
- Value established *before* price is revealed
- Price presented confidently (no apologizing)
- Discount discipline: only offers what's allowed, trades a discount for something (commitment today, upfront payment)
- Explains EMI / financing options correctly
- Doesn't negotiate against themselves

### Stage 7 — Closing
- Trial closes along the way ("If we solve the timing issue, would you be ready to start?")
- Explicitly asks for the commitment (many reps never ask)
- Urgency that's real and approved (batch start date, seat limit), not fake pressure
- Handles the final hesitation
- **Outcome options:** closed / committed next step / qualified out correctly / lost

### Stage 8 — Next steps & follow-up
- Clear, specific next step (date, time, who, what) — not "I'll call you sometime"
- Involves the decision maker if needed ("Can we do a call with your father on Sunday?")
- Recaps what was agreed
- **Follow-up message test:** after the call, trainee writes the WhatsApp/email follow-up. Scored separately.

### Stage 9 — Post-call admin
- CRM notes: trainee writes call notes / fills fields (stage, budget, objection, next step)
- Judge compares notes to what actually happened in the call → accuracy and completeness

### Stage 10 — Post-sale (later modules)
- Onboarding handoff, upsell/cross-sell, asking for referrals, renewal conversations

### Cross-cutting skills (scored across the whole call)
> **Not scored, by design:** empathy, tone, confidence, conviction. They can't be judged reliably, so the coach
> doesn't pretend to. Everything scored must be either a measured metric or an observable behaviour backed by a
> transcript quote.

| Skill | How it's measured |
|---|---|
| Talk-to-listen ratio | audio/transcript metric (good reps ≈ 40–55% talk) |
| Longest monologue | metric (> 90 sec = flag) |
| Questions asked | count + open/closed split |
| Interruptions | metric from speaker overlap |
| Pace (words per minute) | metric |
| Filler words ("umm", "basically", "actually") | metric |
| Clarity of explanation | judge, evidence-based only: jargon used without explaining, rambling answers, answering a different question than asked |
| Call control | Did the rep lead the conversation or get dragged around? |
| Product knowledge accuracy | judge checks every claim against the Editorial knowledge |
| **Compliance** | hard rules: no guaranteed-job claims, no fake discounts, no misquoted prices, disclose terms. Any violation = red flag, can auto-fail regardless of score |
| Methodology adherence | followed the company's script/framework steps |
| Language fit | e.g. switches to Hinglish if buyer does |

### Separate knowledge tests (non-call)
- Product quiz: features, curriculum, pricing, EMI, refund policy, batch dates
- Competitor quiz
- Objection quiz: "Buyer says X — what do you say?" (voice or text)
- Policy/compliance quiz

---

## 3. Stage-by-stage pipeline design

### [1] Company onboarding (admin input)
Structured form + free uploads. Form keeps quality high; uploads add depth.

**Form fields**
- Company overview: what you do, mission, size
- Product(s): name, what it is, who it's for, features, outcomes, pricing, financing/EMI, refund policy
- Sales motion: B2C / B2B, inbound / outbound, phone / video, typical call length, one-call close vs multi-call,
  avg deal size, sales cycle length
- Ideal customer profile + 2–5 buyer types (e.g. "fresher", "working professional switching career", "parent")
- Methodology: SPIN / BANT / MEDDIC / Challenger / our own / none
- Call structure / script (if any)
- Top objections + approved responses
- Competitors + how we win
- Approved proof points: placement stats, testimonials, case studies
- **Compliance: things reps must NEVER say**, things they MUST say
- Discount rules: what can be offered, by whom, with what conditions
- Language(s) of calls
- What "good" looks like: what managers care about most (used for rubric weights)

**Uploads:** pitch decks, PDFs, website URL, YouTube/training videos, recordings of best calls, scripts, FAQs.

### [2] Ingestion & extraction
- PDFs/docs → text; videos/audio → transcription; URLs → scrape
- **Extraction prompt:** turns raw text into the structured Company Knowledge JSON (same schema as the form)
- Merge with form data; flag conflicts ("deck says ₹1.2L, form says ₹1.1L") and gaps ("no objection list
  provided — we'll generate common ones, please review")
- From best-call recordings: extract the real talk track, common objections, winning phrases

### [3] Editorial ("Sales Brief")
A human-readable document generated from the knowledge. **The admin must review and approve it** — everything
downstream depends on it.

Sections:
1. Company & product summary
2. Target customer & buyer personas (who, pains, goals, typical objections)
3. Sales motion & call objective (what a successful call ends with)
4. Expected call flow — the active lifecycle stages for this company and what "good" looks like at each
5. Discovery checklist — the facts a rep must uncover
6. Value proposition & approved proof points
7. Objection library — objection → real cause → approved response pattern
8. Pricing, discounts & negotiation rules
9. Compliance rules — never-say / must-say
10. Rubric — stages, weights, pass marks (editable by admin)
11. Glossary / product facts the judge uses as ground truth

Stored as both readable doc (for admin) and JSON (for the next prompts).

### [4] Scenario & persona generator
From the Editorial, generate many buyer personas so trainees don't memorize one buyer.

Each persona has:
- **Visible profile** (shown on the lead card): name, age, job, lead source
- **Hidden truth** (only the AI buyer knows): real goal, real pain, real budget, decision maker, hidden objection,
  urgency level, past experience, what would make them buy
- **Personality:** talkative / skeptical / busy / analytical / emotional / price-focused / polite-but-noncommittal
- **Difficulty:** Easy (warm, few objections) → Medium → Hard (skeptical, 3–4 objections, hidden decision maker)
  → Expert (hostile, comparing competitors, wants guarantee — compliance trap)
- **Objection script:** which objections they raise, when, and what resolves each
- **Win condition:** what the rep must do for this persona to buy / agree to next step
- **Language/style:** English / Hinglish, formal/casual

Example (EdTech, Hard):
> Visible: Rohit, 27, QA engineer in Pune, downloaded brochure 2 days ago.
> Hidden: wants a 40% salary hike; tried a cheaper course and dropped out; wife handles finances and must agree;
> can afford only via EMI; real objection is fear of not finishing again. Will ask "do you guarantee a job?"
> (rep must NOT promise). Buys if: rep uncovers the dropout history, addresses it with mentorship/accountability,
> offers EMI, and proposes a joint call with the wife.

### [5] Training modes (progressive)
1. **Learn** — AI teaches the Editorial in short lessons (text/voice), with examples
2. **Quiz** — knowledge tests (section 2, "separate knowledge tests")
3. **Stage drills** — short, focused sims: "Opening only", "Discovery only", **"Objection gauntlet"** (buyer fires
   5 objections back to back), "Closing only"
4. **Full call simulation** — the whole call, end to end
5. **Back-to-back sessions** — several full calls in a row with different personas (like a real calling shift)
6. **Certification exam** — fixed set of hard personas, no hints, pass mark set by admin → "ready for real calls"
7. *(Later)* **Real call review** — upload real calls, scored with the same rubric

Optional **coach-whisper mode** for beginners: hints during the call ("You haven't asked about budget yet").

### [6] Voice simulation — the buyer agent
**System prompt built from:** Editorial + persona (visible + hidden) + behaviour rules.

Behaviour rules for the AI buyer:
- Stay in character; never reveal you're AI or coach the rep
- **Don't volunteer hidden facts** — reveal only when the rep asks a good relevant question (a weak question gets
  a vague answer, a good follow-up gets the real answer)
- Track an internal **trust/interest level** (0–10) that rises with good discovery/empathy and falls with pushiness,
  irrelevant pitching, interruptions, wrong facts
- Raise objections at natural moments per the persona's objection script
- The stated objection may hide the real one
- End the call realistically: buy / agree to next step / "I'll think about it" / hang up if trust drops too low
- Natural speech: short turns, fillers, can interrupt, can go off-topic
- Time limit per call type

The buyer agent also logs (hidden) state events: `trust_change`, `fact_revealed`, `objection_raised`,
`objection_resolved`. These feed the judge — very useful objective signals.

**Voice stack (to decide):** STT → LLM → TTS pipeline, or a realtime speech-to-speech model. Needs low latency
(< ~1s), interruption/barge-in support, Indian accents + Hinglish.

### [7] Evaluation
Two layers:

**a) Deterministic metrics** (from transcript + timestamps): talk ratio, longest monologue, # questions,
open/closed questions, interruptions, WPM, filler words, call duration, time-to-first-question, time-to-price.

**b) LLM judge** (separate prompt from the buyer, never the same agent):
- Input: transcript, buyer hidden truth, buyer state events, Editorial, rubric
- Scores each active stage 1–5 against **anchored descriptions** (what a 1, 3, 5 look like) — anchors make
  scores consistent
- Every score must cite **evidence quotes** with timestamps
- Discovery checklist: which hidden facts were uncovered (yes/partial/no)
- Objections: raised → handled well / weakly / not handled
- Compliance check against never-say / must-say list → violations listed
- Product fact check against Editorial ground truth
- Outcome: closed / next step / lost, and *was the outcome deserved*
- For the 3 weakest moments: **rewrite** — "you said X, a stronger response would be Y"

Consistency tips: low temperature, structured JSON output, optionally run judge twice and flag big disagreements.

### [8] Report
**Trainee report (per call)**
- Overall score + pass/fail + outcome
- Stage-wise score bars (Opening, Discovery, Pitch, Objections, Negotiation, Close, Next steps)
- Discovery coverage: facts found vs missed ("You never learned that his wife decides")
- Objection table: each objection → how handled → score
- Compliance flags (red, at the top if any)
- Key metrics vs target (talk ratio, monologue, questions)
- Top 3 strengths, top 3 improvements — each with transcript quote
- "Better response" rewrites for weakest moments
- Recommended next drill ("Do the Objection gauntlet: price + authority")
- Trust graph across the call (from buyer state events) — shows exactly where they lost the buyer

**Back-to-back session report:** trends across calls, consistent weaknesses, improvement over the session.

**Manager dashboard:** team leaderboard, per-stage heatmap (whole team weak at closing?), certification status /
readiness, time-to-ready for new hires, most-failed objections.

---

## 4. Default rubric (EdTech one-call close example — admin can edit)

| Stage | Weight |
|---|---|
| Opening & rapport | 10% |
| Discovery | 25% |
| Pitch / value | 15% |
| Objection handling | 20% |
| Pricing & negotiation | 10% |
| Closing | 10% |
| Next steps | 5% |
| Communication (metrics + clarity, cross-cutting) | 5% |
| Compliance | gate: any critical violation = fail |

B2B SaaS would add Demo, Multi-stakeholder and Qualification (MEDDIC) and shift weight toward Discovery.

---

## 5. Prompt chain summary

| # | Prompt | Input | Output |
|---|---|---|---|
| P1 | Extractor | raw uploads + form | Company Knowledge JSON + gaps/conflicts |
| P2 | Editorial writer | Company Knowledge | Sales Brief (doc + JSON), rubric draft |
| P3 | Persona generator | Editorial, difficulty, count | persona JSON (visible + hidden + objection script) |
| P4 | Lesson/quiz generator | Editorial | lessons, quiz questions with answers |
| P5 | Buyer agent (live voice) | Editorial + persona + behaviour rules | conversation + state events |
| P6 | Judge | transcript + metrics + persona hidden truth + events + rubric | scored JSON with evidence |
| P7 | Report writer | judge JSON (+ past sessions) | trainee report + next drill |

---

## 6. Stack (v0)

- React app (`app/`); the Vite dev server proxies AI calls and adds API keys from `app/.env.local`.
- Thinking (P1–P7): Gemini `gemini-3.1-flash-lite` (free tier; Gemini 2.5 models are closed to new keys).
- Buyer voice: Sarvam `bulbul:v4-flash` (₹10 per 10K characters).
- Trainee voice → text: Sarvam `saaras:v4` (~₹29 per hour of audio).
- Model outputs are normalised (missing fields filled) because small models sometimes drop sections.
- Turn-taking: mic + voice-activity detection in the browser; timings per turn are recorded locally and feed the
  metrics (talk ratio, monologue, pace, interruptions).
- Storage: browser localStorage (one workspace per browser) — move to a backend later.
- Every judge output appears in the report — nothing is computed and hidden.

## 7. Open decisions

1. **First market:** B2C phone sales (EdTech, insurance, real estate) or B2B SaaS? B2C one-call close is simpler to
   build and score — suggested first.
2. **Languages:** English only, or Hinglish from day one? (Huge for Indian EdTech/BPO.)
3. **Voice stack:** realtime speech-to-speech vs STT+LLM+TTS (cost vs latency vs Hinglish quality).
4. **Editorial approval:** mandatory admin sign-off before trainees can use it? (Recommended: yes.)
5. **Certification:** does a manager have to sign off, or is passing the exam enough?
6. **Real call ingestion** (Gong/Zoom/Exotel/dialer) — v1 or later?
