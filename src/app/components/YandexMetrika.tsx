'use client'

import { Suspense, useEffect } from 'react'
import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'

function MetrikaTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const id = process.env.NEXT_PUBLIC_YM_ID

  useEffect(() => {
    if (!id || !window.ym) return
    try {
      const query = searchParams.toString()
      window.ym(Number(id), 'hit', `${pathname}${query ? `?${query}` : ''}`)
    } catch {
      // Аналитика не должна влиять на SPA-навигацию.
    }
  }, [id, pathname, searchParams])

  return null
}

export default function YandexMetrika() {
  const id = process.env.NEXT_PUBLIC_YM_ID
  if (!id) return null

  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">
        {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${id},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true,defer:true});`}
      </Script>
      <Suspense fallback={null}><MetrikaTracker /></Suspense>
      <noscript><div><img src={`https://mc.yandex.ru/watch/${id}`} style={{ position: 'absolute', left: -9999 }} alt="" /></div></noscript>
    </>
  )
}
