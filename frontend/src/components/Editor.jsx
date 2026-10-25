import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { set, useStudio } from '../store'

const citeKey = new PluginKey('citeMarks')
const CiteMarks = Extension.create({
  name: 'citeMarks',
  addStorage() { return { items: [] } },
  addProseMirrorPlugins() {
    const ext = this
    return [
      new Plugin({
        key: citeKey,
        props: {
          decorations(state) {
            const items = ext.storage.items
            if (!items.length) return DecorationSet.empty
            const decos = []
            state.doc.descendants((node, pos) => {
              if (!node.isText) return
              for (const c of items) {
                const needle = (c.text || '').replace(/\s*\(x\d+\)$/, '')
                if (!needle) continue
                let i = node.text.indexOf(needle)
                while (i !== -1) {
                  decos.push(Decoration.inline(pos + i, pos + i + needle.length, { class: `cite cite-${c.status}`, 'data-cid': String(c.id) }))
                  i = node.text.indexOf(needle, i + needle.length)
                }
              }
            })
            return DecorationSet.create(state.doc, decos)
          },
          handleClick(view, pos, event) {
            const el = event.target?.closest?.('[data-cid]')
            if (el) set({ activeCite: { id: Number(el.dataset.cid), t: Date.now() } })
            return false
          },
        },
      }),
    ]
  },
})

function Btn({ onClick, active, label, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`px-2.5 py-1 rounded text-sm ${active ? 'bg-accent-soft text-accent' : 'hover:bg-field'}`}
    >
      {children}
    </button>
  )
}

export default function Editor() {
  const draft = useStudio((s) => s.draft)
  const generating = useStudio((s) => s.generating)
  const citations = useStudio((s) => s.citations)
  const lastEmitted = useRef('')

  const editor = useEditor({
    extensions: [StarterKit, CiteMarks],
    content: draft,
    editorProps: { attributes: { class: 'draft', 'aria-label': 'Draft document' } },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      lastEmitted.current = html
      set({ draft: html })
    },
  })

  // when the draft changes from outside (streaming, restore, chat edits), push it into the editor
  useEffect(() => {
    if (editor && draft !== lastEmitted.current && draft !== editor.getHTML()) {
      editor.commands.setContent(draft, { emitUpdate: false })
    }
  }, [draft, editor])

  useEffect(() => { editor?.setEditable(!generating) }, [generating, editor])

  useEffect(() => {
    if (!editor) return
    editor.storage.citeMarks.items = citations
    editor.view.dispatch(editor.state.tr.setMeta(citeKey, true))
  }, [citations, editor])

  if (!editor) return null
  const c = () => editor.chain().focus()

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-line bg-sheet text-sm" role="toolbar" aria-label="Formatting">
        <Btn label="Bold" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()}><b>B</b></Btn>
        <Btn label="Italic" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}><i>I</i></Btn>
        <Btn label="Heading" active={editor.isActive('heading', { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}>H</Btn>
        <Btn label="Numbered list" active={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}>1.</Btn>
        <Btn label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}>•</Btn>
        <span className="flex-1" />
        <Btn label="Undo" onClick={() => c().undo().run()}>↶</Btn>
        <Btn label="Redo" onClick={() => c().redo().run()}>↷</Btn>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="sheet rounded-sm px-10 py-12 max-w-[820px] mx-auto">
          {!draft && !generating && (
            <p className="text-center text-muted text-sm mb-6">
              Your draft will appear here. Tell the chat what you need, or fill in the details above and press Generate.
            </p>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
