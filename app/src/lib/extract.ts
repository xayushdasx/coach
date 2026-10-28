import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth/mammoth.browser'
import { transcribe } from './ai'
import type { SourceDoc } from './types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export const ACCEPT = '.pdf,.docx,.txt,.md,.csv,.json,.mp3,.wav,.m4a,.webm,.ogg,.mp4,.mov'

// Turn an uploaded file into plain text for the extractor (P1).
export async function fileToSource(file: File): Promise<Omit<SourceDoc, 'id' | 'addedAt'>> {
  const name = file.name
  const ext = name.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'pdf') {
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent()
      pages.push(content.items.map((it: any) => it.str).join(' '))
    }
    return { name, kind: 'pdf', text: pages.join('\n\n') }
  }

  if (ext === 'docx') {
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return { name, kind: 'docx', text: value }
  }

  if (file.type.startsWith('audio/') || file.type.startsWith('video/') || ['mp3', 'wav', 'm4a', 'webm', 'ogg', 'mp4', 'mov'].includes(ext)) {
    const text = await transcribe(file)
    return { name, kind: file.type.startsWith('video/') || ['mp4', 'mov'].includes(ext) ? 'video' : 'audio', text }
  }

  return { name, kind: 'text', text: await file.text() }
}
