import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getState, setState, uid, useStore } from '../lib/store'
import { ACCEPT, fileToSource } from '../lib/extract'
import { SAMPLE_COMPANY } from '../lib/sample'
import { runExtractor } from '../prompts/p1-extractor'
import { runEditorial } from '../prompts/p2-editorial'
import type { CompanyInput } from '../lib/types'
import { Busy, ErrorNote, PageHead } from '../components/ui'

const SECTIONS: { title: string; fields: { key: keyof CompanyInput; label: string; hint: string; rows?: number }[] }[] = [
  {
    title: 'Company & product',
    fields: [
      { key: 'companyName', label: 'Company name', hint: '', rows: 1 },
      { key: 'overview', label: 'What the company does', hint: 'Who you serve, size, markets.' },
      { key: 'product', label: 'Product', hint: 'What it does, key features, integrations, results customers get.', rows: 5 },
      { key: 'pricing', label: 'Pricing & contract terms', hint: 'Plans, prices, billing, implementation fees, trials or pilots.' },
    ],
  },
  {
    title: 'How you sell',
    fields: [
      { key: 'salesMotion', label: 'Sales motion', hint: 'Inbound or outbound, call or video, call length, deal size, sales cycle, who is involved.' },
      { key: 'callObjective', label: 'Goal of the call reps will practise', hint: 'What a successful call ends with, e.g. a booked demo with the CFO.' },
      { key: 'buyers', label: 'Who you sell to', hint: 'Roles, company types, what they struggle with.' },
      { key: 'methodology', label: 'Sales methodology', hint: 'MEDDIC, SPIN, BANT, Challenger, your own — and how reps should apply it.' },
      { key: 'script', label: 'Call structure or script', hint: 'Optional. The steps a good call follows.' },
    ],
  },
  {
    title: 'Objections & competition',
    fields: [
      { key: 'objections', label: 'Common objections and approved responses', hint: 'One per line: objection → how to handle it.', rows: 6 },
      { key: 'competitors', label: 'Competitors and how you win', hint: '' },
      { key: 'proofPoints', label: 'Approved proof points', hint: 'Case studies, statistics, ratings reps are allowed to quote.' },
    ],
  },
  {
    title: 'Rules',
    fields: [
      { key: 'neverSay', label: 'Reps must never say', hint: 'Promises, claims or discounts that are not allowed. These become compliance checks.' },
      { key: 'mustSay', label: 'Reps must always say', hint: 'Required disclosures.' },
      { key: 'discountRules', label: 'Discount rules', hint: 'Who can discount, how much, in exchange for what.' },
      { key: 'languages', label: 'Call language', hint: 'e.g. English, Hindi, Hinglish.', rows: 1 },
      { key: 'priorities', label: 'What managers care about most', hint: 'Used to weight the scorecard.' },
    ],
  },
]

export default function Company() {
  const nav = useNavigate()
  const company = useStore((s) => s.company)
  const sources = useStore((s) => s.sources)
  const knowledge = useStore((s) => s.knowledge)
  const editorial = useStore((s) => s.editorial)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [busy, setBusy] = useState<'extract' | 'brief' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof CompanyInput, v: string) => setState((s) => ({ company: { ...s.company, [key]: v } }))
  const filled = Object.values(company).filter((v) => v.trim()).length

  async function onFiles(files: FileList | null) {
    if (!files) return
    setError(null)
    for (const f of Array.from(files)) {
      setUploading(f.name)
      try {
        const src = await fileToSource(f)
        if (!src.text.trim()) throw new Error('No text could be read from it.')
        setState((s) => ({ sources: [...s.sources, { ...src, id: uid('s_'), addedAt: Date.now() }] }))
      } catch (e) {
        setError(`Could not read ${f.name}: ${(e as Error).message}`)
      }
    }
    setUploading(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function extract() {
    setBusy('extract')
    setError(null)
    try {
      const k = await runExtractor(getState().company, getState().sources)
      setState({ knowledge: k })
    } catch (e) {
      setError(`Extraction failed: ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  async function writeBrief() {
    if (!knowledge) return
    setBusy('brief')
    setError(null)
    try {
      const ed = await runEditorial(knowledge, getState().editorial?.version ?? 0)
      setState((s) => ({ editorial: ed, editorialHistory: [...s.editorialHistory, ed] }))
      nav('/brief')
    } catch (e) {
      setError(`Writing the sales brief failed: ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="page">
      <PageHead
        title="Company"
        sub="Tell the coach what you sell and how. Fill in what you can and upload anything useful: pitch decks, playbooks, FAQs, recordings of good calls. The coach extracts it into structured knowledge you can check."
        actions={
          filled === 0 && (
            <button className="btn" onClick={() => setState({ company: SAMPLE_COMPANY })}>
              Fill with sample B2B SaaS company
            </button>
          )
        }
      />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 320px', alignItems: 'start' }}>
        <div className="stack" style={{ gap: 16 }}>
          {SECTIONS.map((sec) => (
            <section key={sec.title} className="card">
              <div className="card-head"><h2>{sec.title}</h2></div>
              <div className="card-pad stack" style={{ gap: 14 }}>
                {sec.fields.map((f) => (
                  <label key={f.key} className="field">
                    <span className="field-label">{f.label}</span>
                    {f.hint && <span className="field-hint">{f.hint}</span>}
                    {f.rows === 1 ? (
                      <input type="text" value={company[f.key]} onChange={(e) => set(f.key, e.target.value)} />
                    ) : (
                      <textarea rows={f.rows ?? 3} value={company[f.key]} onChange={(e) => set(f.key, e.target.value)} />
                    )}
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="stack" style={{ gap: 16, position: 'sticky', top: 72, maxHeight: 'calc(100vh - 88px)', overflowY: 'auto' }}>
          <section className="card">
            <div className="card-head"><h2>Uploads</h2><span className="badge mono">{sources.length}</span></div>
            <div className="card-pad stack">
              <p className="small muted">PDF, Word, text, or audio/video recordings of real calls (transcribed automatically).</p>
              <input ref={fileRef} type="file" multiple accept={ACCEPT} hidden onChange={(e) => onFiles(e.target.files)} />
              <button className="btn" disabled={!!uploading} onClick={() => fileRef.current?.click()}>
                <Busy on={!!uploading}>{uploading ? `Reading ${uploading}` : 'Add files'}</Busy>
              </button>
              {sources.length > 0 && (
                <ul className="clean">
                  {sources.map((s) => (
                    <li key={s.id} className="row-between small">
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>
                        {s.name} <span className="faint">· {s.kind} · {Math.round(s.text.length / 1000)}k chars</span>
                      </span>
                      <button className="btn ghost sm" onClick={() => setState((st) => ({ sources: st.sources.filter((x) => x.id !== s.id) }))}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-pad stack">
              <h3>Extract knowledge</h3>
              <p className="small muted">Reads the form and uploads and builds a structured record. Gaps and contradictions are flagged for you.</p>
              <button className="btn primary" disabled={!!busy || (filled === 0 && sources.length === 0)} onClick={extract}>
                <Busy on={busy === 'extract'}>{busy === 'extract' ? 'Extracting…' : knowledge ? 'Extract again' : 'Extract knowledge'}</Busy>
              </button>
              <ErrorNote error={error} />
              {knowledge && (
                <>
                  <div className="divider" />
                  <div className="small">
                    <b>{knowledge.company.name}</b> · {knowledge.salesMotion.type} · {knowledge.products.length} product(s) · {knowledge.objections.length} objections · {knowledge.buyers.length} buyer types
                  </div>
                  {knowledge.conflicts.length > 0 && (
                    <div className="notice warn">
                      <b>Contradictions</b>
                      <ul className="ticks">{knowledge.conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul>
                    </div>
                  )}
                  {knowledge.gaps.length > 0 && (
                    <div className="notice info">
                      <b>Missing information</b>
                      <ul className="ticks">{knowledge.gaps.map((c, i) => <li key={i}>{c}</li>)}</ul>
                    </div>
                  )}
                  <button className="btn primary" disabled={!!busy} onClick={writeBrief}>
                    <Busy on={busy === 'brief'}>{busy === 'brief' ? 'Writing the sales brief…' : editorial ? 'Write a new sales brief' : 'Write the sales brief'}</Busy>
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
