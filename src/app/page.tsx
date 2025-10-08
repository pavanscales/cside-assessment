"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "../app/lib/utils"
import {
  runStaticDetections,
  startActivityProbe,
  summarize,
  type SignalResult,
  type Summary,
} from "../app/lib/botDetector"

function StatusBadge({ summary }: { summary: Summary | null }) {
  const label = !summary
    ? "Awaiting"
    : summary.level === "low"
      ? "Human"
      : summary.level === "medium"
        ? "Suspicious"
        : "Automated"

  const tone = !summary
    ? "bg-gray-700 text-gray-300"
    : summary.level === "low"
      ? "bg-gray-800 text-gray-50"
      : summary.level === "medium"
        ? "bg-yellow-800 text-yellow-200"
        : "bg-red-900 text-red-200"

  const confidence = summary ? Math.round((summary.score / summary.max) * 100) : 0

  return (
    <div className="flex flex-col items-end">
      <span
        className={cn(
          "inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full shadow-sm ring-1 ring-gray-600/30 transition-colors duration-200 ease-in-out",
          tone
        )}
        aria-live="polite"
      >
        {label}
      </span>
      <div className="w-24 h-1 mt-1 rounded-full bg-gray-600/30">
        <div
          className={cn(
            "h-1 rounded-full transition-all duration-300",
            summary?.level === "low"
              ? "bg-emerald-400"
              : summary?.level === "medium"
              ? "bg-yellow-400"
              : "bg-red-400"
          )}
          style={{ width: `${confidence}%` }}
        />
      </div>
    </div>
  )
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block w-2 h-2 rounded-full mr-2 align-middle",
        ok ? "bg-emerald-400" : "bg-red-500"
      )}
    />
  )
}

function CheckItem({ s }: { s: SignalResult }) {
  return (
    <div className="flex items-start justify-between rounded-md border border-border/60 bg-secondary/40 p-3">
      <div className="flex items-start gap-2">
        <Dot ok={!s.suspicious} />
        <div>
          <div className="font-medium text-pretty">{s.name}</div>
          {s.details && (
            <div className="text-sm text-muted-foreground text-pretty">{s.details}</div>
          )}
        </div>
      </div>
      <div className="text-xs text-muted-foreground tabular-nums">weight {s.weight}</div>
    </div>
  )
}

function useBehavioralSignals() {
  const [lostFocus, setLostFocus] = useState(false)
  const [resized, setResized] = useState(false)
  const [pinchZoom, setPinchZoom] = useState(false)

  useEffect(() => {
    const onBlur = () => setLostFocus(true)
    const onResize = () => setResized(true)
    const onGesture = () => setPinchZoom(true)

    window.addEventListener("blur", onBlur)
    window.addEventListener("resize", onResize)
    window.addEventListener("gesturestart", onGesture)

    return () => {
      window.removeEventListener("blur", onBlur)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("gesturestart", onGesture)
    }
  }, [])

  return useMemo(
    () => [
      { id: "behavioral-focus-blur", name: "Did the user lose focus?", suspicious: lostFocus, weight: 0.5 },
      { id: "behavioral-resize", name: "User resized window?", suspicious: resized, weight: 0.5 },
      { id: "behavioral-touch-gestures", name: "User performed touch gestures?", suspicious: pinchZoom, weight: 1 },
    ],
    [lostFocus, resized, pinchZoom]
  )
}

function useMicroSignals() {
  const [fastMouse, setFastMouse] = useState(false)
  const [linearMouse, setLinearMouse] = useState(false)
  const [fastTyping, setFastTyping] = useState(false)
  const [scrollPatterns, setScrollPatterns] = useState(false)
  const [hoverDuration, setHoverDuration] = useState(false)

  useEffect(() => {
    let lastX = 0
    let lastY = 0
    let lastTime = Date.now()
    let lastKeyTime = Date.now()
    let lastScrollTime = Date.now()
    let hoverStart: number | null = null

    const onMouseMove = (e: MouseEvent) => {
      const now = Date.now()
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      const dt = now - lastTime

      const speed = dt > 0 ? Math.sqrt(dx * dx + dy * dy) / dt : 0
      if (speed > 1) setFastMouse(true)

      const linear = Math.abs(dy / (dx || 1)) < 0.05
      if (linear) setLinearMouse(true)

      if (dx === 0 && dy === 0 && dt > 1000) setFastMouse(false)

      lastX = e.clientX
      lastY = e.clientY
      lastTime = now
    }

    const onKeyDown = () => {
      const now = Date.now()
      if (now - lastKeyTime < 30) setFastTyping(true)
      lastKeyTime = now
    }

    const onScroll = () => {
      const now = Date.now()
      if (now - lastScrollTime < 50) setScrollPatterns(true)
      lastScrollTime = now
    }

    const onMouseOver = () => {
      hoverStart = Date.now()
    }

    const onMouseOut = () => {
      if (hoverStart) {
        const duration = Date.now() - hoverStart
        if (duration > 2000) setHoverDuration(true)
        hoverStart = null
      }
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("scroll", onScroll)
    window.addEventListener("mouseover", onMouseOver)
    window.addEventListener("mouseout", onMouseOut)

    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("mouseover", onMouseOver)
      window.removeEventListener("mouseout", onMouseOut)
    }
  }, [])

  return useMemo(
    () => [
      { id: "micro-fast-mouse", name: "Mouse moved unnaturally fast?", suspicious: fastMouse, weight: 1 },
      { id: "micro-linear-mouse", name: "Mouse moved in straight lines?", suspicious: linearMouse, weight: 0.8 },
      { id: "micro-fast-typing", name: "Typing too fast?", suspicious: fastTyping, weight: 1 },
      { id: "micro-scroll-patterns", name: "Scroll pattern abnormal?", suspicious: scrollPatterns, weight: 0.5 },
      { id: "micro-hover-duration", name: "Hovered too long on elements?", suspicious: hoverDuration, weight: 0.5 },
    ],
    [fastMouse, linearMouse, fastTyping, scrollPatterns, hoverDuration]
  )
}

export default function Page() {
  const behavioralSignals = useBehavioralSignals()
  const microSignals = useMicroSignals()

  const [staticSignals, setStaticSignals] = useState<SignalResult[]>([])
  const [probeSignals, setProbeSignals] = useState<SignalResult[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [probing, setProbing] = useState(false)
  const [copyStatus, setCopyStatus] = useState("")

  useEffect(() => {
    const staticResults = runStaticDetections()
    setStaticSignals(staticResults)
  }, [])

  const allSignals = useMemo(
    () => [...staticSignals, ...behavioralSignals, ...microSignals, ...probeSignals],
    [staticSignals, behavioralSignals, microSignals, probeSignals]
  )

  useEffect(() => {
    const deviceFactor = /iP(hone|ad|od)/i.test(navigator.userAgent)
      ? 0.7
      : /Android|Mobile/i.test(navigator.userAgent)
        ? 0.85
        : 1

    const weightedSignals = allSignals.map((s) => ({ ...s, weight: s.weight * deviceFactor }))
    setSummary(summarize(weightedSignals))
  }, [allSignals])

  const json = useMemo(() => JSON.stringify({ summary, signals: allSignals }, null, 2), [summary, allSignals])

  async function handleProbe() {
    setProbing(true)
    try {
      const probeResults = await startActivityProbe(7000)
      const ts = Date.now()
      const uniqueProbes = probeResults.map((s, i) => ({
        ...s,
        id: `${s.id}-probe-${i}-${ts}`,
      }))
      setProbeSignals(uniqueProbes)
    } finally {
      setProbing(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(json)
      setCopyStatus("Copied!")
      setTimeout(() => setCopyStatus(""), 2000)
    } catch {
      setCopyStatus("Failed to copy")
      setTimeout(() => setCopyStatus(""), 2000)
    }
  }

  return (
    <main className="min-h-dvh px-6 py-10 md:py-14">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Client-Side Demo</p>
            <h1 className="text-balance text-3xl md:text-4xl font-semibold">
              Automation vs Human Detection
            </h1>
          </div>
          <StatusBadge summary={summary} />
        </header>

        <section className="rounded-xl border border-border/60 bg-card/30 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Risk score: <span className="font-mono">{summary?.score ?? 0}</span> /{" "}
              <span className="font-mono">{summary?.max ?? 0}</span> (Confidence:{" "}
              {summary ? Math.round((summary.score / summary.max) * 100) : 0}%)
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleProbe}
                disabled={probing}
                className={cn(
                  "rounded-md px-3 py-2 text-sm ring-1 transition-colors",
                  probing
                    ? "bg-muted text-muted-foreground ring-muted-foreground/20 cursor-not-allowed"
                    : "bg-primary text-primary-foreground ring-primary/30 hover:bg-primary/90"
                )}
              >
                {probing ? "Probing… (7s)" : "Run 5-7s activity check"}
              </button>

              <button
                onClick={handleCopy}
                className="relative rounded-md px-3 py-2 text-sm ring-1 bg-secondary hover:bg-secondary/80 transition-colors"
              >
                Copy JSON
                {copyStatus && (
                  <span className="absolute -top-6 right-0 text-xs text-emerald-400">{copyStatus}</span>
                )}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {allSignals.map((s) => (
              <CheckItem key={s.id} s={s} />
            ))}
          </div>

          <details className="mt-6 rounded-md border border-border/60 bg-secondary/30 p-4">
            <summary className="cursor-pointer text-sm font-medium">How this works</summary>
            <div className="mt-3 text-sm text-muted-foreground space-y-2">
              <p>
                This page runs only in your browser. It inspects multiple signals (no third‑party services) and
                scores suspicion. The activity probe waits 5-7s for natural mouse/keyboard variation.
              </p>
              <p>
                Final status is heuristic, not a verdict. Automated tools can spoof or bypass many checks, and
                some real users may be flagged depending on device, privacy settings, or environment.
              </p>
            </div>
          </details>
        </section>

        <section className="rounded-xl border border-border/60 bg-card/30 p-5 md:p-6">
          <h2 className="text-lg font-semibold mb-3">Diagnostics JSON</h2>
          <pre className="overflow-auto rounded-lg bg-secondary/30 p-4 text-xs leading-relaxed">{json}</pre>
        </section>
      </div>
    </main>
  )
}
