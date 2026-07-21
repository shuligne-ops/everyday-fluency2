'use client'

import { useEffect, useRef, useState } from 'react'

type Ef2PrototypeProps = {
  asset: string
}

export default function Ef2Prototype({ asset }: Ef2PrototypeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const target = container

    let cancelled = false
    let style: HTMLStyleElement | undefined
    let script: HTMLScriptElement | undefined

    async function mount() {
      try {
        const response = await fetch(asset)
        if (!response.ok) throw new Error(`Could not load ${asset}`)
        const source = await response.text()
        if (cancelled) return

        const styleMatch = source.match(/<style>([\s\S]*?)<\/style>/)
        const scriptMatch = source.match(/<script>([\s\S]*?)<\/script>/)
        const markup = source
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/<style>[\s\S]*?<\/style>/, '')
          .replace(/<script>[\s\S]*?<\/script>/, '')

        if (!styleMatch || !scriptMatch) throw new Error('Invalid prototype asset')

        target.innerHTML = markup
        style = document.createElement('style')
        style.dataset.ef2Asset = asset
        style.textContent = styleMatch[1]
          .replace(':root', '[data-ef2-prototype]')
          .replace('* { box-sizing: border-box; }', '[data-ef2-prototype], [data-ef2-prototype] * { box-sizing: border-box; }')
          .replace('*{box-sizing:border-box;}', '[data-ef2-prototype],[data-ef2-prototype] *{box-sizing:border-box;}')
        document.head.appendChild(style)

        script = document.createElement('script')
        script.textContent = scriptMatch[1]
        target.appendChild(script)
      } catch (mountError) {
        console.error('Could not load EF 2.0 prototype:', mountError)
        if (!cancelled) setError(true)
      }
    }

    mount()
    return () => {
      cancelled = true
      script?.remove()
      style?.remove()
      target.innerHTML = ''
    }
  }, [asset])

  if (error) return <p>Lesson unavailable. Please refresh and try again.</p>
  return <div ref={containerRef} data-ef2-prototype />
}
