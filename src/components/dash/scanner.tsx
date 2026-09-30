'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Camera, CameraOff, Flashlight, FlashlightOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Short confirmation beep (Web Audio, no sound file needed).
export function beep(ok = true) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = ok ? 1320 : 220
    o.type = ok ? 'sine' : 'square'
    g.gain.setValueAtTime(0.12, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ok ? 0.12 : 0.3))
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.3)
    navigator.vibrate?.(ok ? 40 : [60, 40, 60])
  } catch {}
}

// Camera barcode scanner (EAN-13, Code 128, QR…). Uses the rear camera, offers the
// torch where the phone supports it (dim shop lighting), and ignores repeat reads of
// the same code for 1.5 s so one item isn't added twice.
export function CameraScanner({ onScan, className }: { onScan: (code: string) => void; className?: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const [on, setOn] = useState(false)
  const [state, setState] = useState<'idle' | 'starting' | 'live' | 'error'>('idle')
  const [torch, setTorch] = useState<boolean | null>(null)
  const [flash, setFlash] = useState(0)
  const last = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const cb = useRef(onScan)
  useEffect(() => {
    cb.current = onScan
  }, [onScan])

  useEffect(() => {
    if (!on) return
    let controls: { stop: () => void } | null = null
    let cancelled = false
    setState('starting')
    ;(async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const { DecodeHintType, BarcodeFormat } = await import('@zxing/library')
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.CODE_128, BarcodeFormat.UPC_A, BarcodeFormat.QR_CODE])
        hints.set(DecodeHintType.TRY_HARDER, true)
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 })
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          video.current!,
          (result) => {
            if (!result) return
            const code = result.getText()
            const now = Date.now()
            if (code === last.current.code && now - last.current.at < 1500) return
            last.current = { code, at: now }
            setFlash((f) => f + 1)
            cb.current(code)
          },
        )
        if (cancelled) return controls.stop()
        const track = (video.current?.srcObject as MediaStream | null)?.getVideoTracks()[0]
        const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined
        setTorch(caps?.torch ? false : null)
        setState('live')
      } catch {
        setState('error')
      }
    })()
    return () => {
      cancelled = true
      controls?.stop()
      setTorch(null)
    }
  }, [on])

  const toggleTorch = async () => {
    const track = (video.current?.srcObject as MediaStream | null)?.getVideoTracks()[0]
    if (!track || torch == null) return
    await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }).catch(() => undefined)
    setTorch(!torch)
  }

  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-ink', className)}>
      {on ? (
        <>
          <video ref={video} className="h-full w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="relative h-[42%] w-[78%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_999px_rgb(0_0_0/0.35)]">
              <motion.div className="absolute inset-x-3 h-0.5 rounded-full bg-clay shadow-[0_0_12px_#b4532a]" animate={{ top: ['8%', '92%', '8%'] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
            </div>
          </div>
          {flash > 0 && <motion.div key={flash} className="pointer-events-none absolute inset-0 bg-success/40" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.4 }} />}
          {state === 'starting' && <div className="absolute inset-0 grid place-items-center text-white"><Loader2 className="size-6 animate-spin" /></div>}
          <div className="absolute right-2 bottom-2 flex gap-2">
            {torch != null && (
              <button onClick={toggleTorch} className="grid size-11 place-items-center rounded-full bg-white/90 text-ink" aria-label={torch ? 'Torch off' : 'Torch on'}>
                {torch ? <FlashlightOff className="size-5" /> : <Flashlight className="size-5" />}
              </button>
            )}
            <button onClick={() => setOn(false)} className="grid size-11 place-items-center rounded-full bg-white/90 text-ink" aria-label="Stop camera"><CameraOff className="size-5" /></button>
          </div>
        </>
      ) : (
        <button onClick={() => setOn(true)} className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 text-paper">
          <Camera className="size-8" />
          <span className="font-bold">Tap to scan with camera</span>
          <span className="text-xs text-paper/60">Or use a barcode scanner / type below</span>
        </button>
      )}
      {state === 'error' && on && (
        <p className="absolute inset-x-0 bottom-0 bg-danger p-2 text-center text-xs text-white">Camera unavailable — allow camera access in your browser settings, or type the code.</p>
      )}
    </div>
  )
}
