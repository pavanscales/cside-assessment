
export type SignalResult = {
  id: string
  name: string
  suspicious: boolean
  weight: number
  details?: string
}

export type Summary = {
  score: number
  max: number
  level: "low" | "medium" | "high"
}

const UA = () => (typeof navigator !== "undefined" ? navigator.userAgent : "")
const isIOS = () => /iP(hone|ad|od)/i.test(UA())
const isMobileUA = () => /(Android|iPhone|iPad|Mobile)/i.test(UA())

function signal(id: string, name: string, suspicious: boolean, weight: number, details?: string): SignalResult {
  return { id, name, suspicious, weight, details }
}

type MaybeNavigator = Navigator & {
  webdriver?: boolean
  deviceMemory?: number
  maxTouchPoints?: number
  languages?: string[]
  plugins?: PluginArray | { length: number }
  permissions?: unknown
}

type MaybeWindow = Window & {
  chrome?: { app?: { isInstalled?: boolean } }
}


export function detectWebdriver(): SignalResult {
  const wd = (navigator as MaybeNavigator).webdriver === true
  return signal("webdriver", "navigator.webdriver is true", wd, 3, `value=${String((navigator as MaybeNavigator).webdriver)}`)
}

export function detectHeadlessUA(): SignalResult {
  const ua = UA().toLowerCase()
  const patterns = [
    "headlesschrome",
    "puppeteer",
    "playwright",
    "selenium",
    "phantom",
    "electron",
    "bot",
    "crawler",
    "spider",
    "slurp",
    "percy",
  ]
  const hit = patterns.some((p) => ua.includes(p))
  return signal("ua-headless", "User-Agent hints at automation", hit, 2, hit ? `UA=${ua}` : undefined)
}

export function detectPluginsAnomaly(): SignalResult {
  const len = (navigator as MaybeNavigator).plugins ? (navigator as MaybeNavigator).plugins!.length : 0
  const suspect = len === 0 && !isIOS()
  const weight = isIOS() ? 0.5 : 1.5
  return signal("plugins", "No browser plugins detected", suspect, weight, `plugins.length=${len}`)
}

export function detectLanguagesAnomaly(): SignalResult {
  const langs = ((navigator as MaybeNavigator).languages || []).filter(Boolean)
  const suspect = langs.length === 0
  return signal("languages", "Empty navigator.languages", suspect, 1.5, `languages.length=${langs.length}`)
}

function getWebGLInfo(): { vendor?: string; renderer?: string } {
  try {
    const canvas = document.createElement("canvas")
    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null
    if (!gl) return {}
    const UNMASKED_VENDOR_WEBGL = 0x9245 // 37413? (common constant 0x9245)
    const UNMASKED_RENDERER_WEBGL = 0x9246 // 37414? (common constant 0x9246)
    const ext = gl.getExtension("WEBGL_debug_renderer_info")
    if (!ext) return {}
    const vendorRaw = gl.getParameter(UNMASKED_VENDOR_WEBGL as number)
    const rendererRaw = gl.getParameter(UNMASKED_RENDERER_WEBGL as number)
    const vendor = typeof vendorRaw === "string" ? vendorRaw : String(vendorRaw || "")
    const renderer = typeof rendererRaw === "string" ? rendererRaw : String(rendererRaw || "")
    return { vendor, renderer }
  } catch {
    return {}
  }
}

export function detectWebGLBlacklist(): SignalResult {
  const { vendor = "", renderer = "" } = getWebGLInfo()
  const r = `${vendor} ${renderer}`.toLowerCase()
  const blacklist = ["swiftshader", "llvmpipe", "mesa", "software rasterizer", "virtualbox", "vmware", "parallels"]
  const hit = blacklist.some((b) => r.includes(b))
  return signal("webgl", "WebGL vendor/renderer looks virtualized", hit, 2.5, r.trim() ? `${vendor} | ${renderer}` : "n/a")
}

export function detectTouchMismatch(): SignalResult {
  const maxTouch = (navigator as MaybeNavigator).maxTouchPoints ?? 0
  const suspect = isMobileUA() && maxTouch === 0
  const mild = !isMobileUA() && maxTouch >= 5
  const weight = suspect ? 2 : mild ? 1 : 0
  return signal("touch", "UA vs maxTouchPoints mismatch", suspect || mild, weight, `maxTouchPoints=${maxTouch}`)
}

export function detectTimezoneAvailable(): SignalResult {
  let tz: string | undefined
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    tz = undefined
  }
  const suspect = !tz || typeof tz !== "string" || tz.length < 3
  return signal("timezone", "Timezone unavailable", suspect, 1, `timeZone=${tz || "n/a"}`)
}

export function detectScreenResolution(): SignalResult {
  const w = window.screen.width
  const h = window.screen.height
  const suspect = w < 300 || h < 200 || w > 7680 || h > 4320
  return signal("screen", "Unlikely screen resolution", suspect, 1, `width=${w}, height=${h}`)
}

export function detectDeviceSpecs(): SignalResult {
  const cores = navigator.hardwareConcurrency ?? 1
  const memory = (navigator as MaybeNavigator).deviceMemory ?? 1
  const suspect = cores <= 1 || memory <= 1
  return signal("device-specs", "Low device cores/memory", suspect, 1, `cores=${cores}, memory=${memory}GB`)
}

export function detectChromeApp(): SignalResult {
  const installed = (window as MaybeWindow).chrome?.app?.isInstalled
  const suspect = installed === false
  return signal("chrome-app", "Chrome app detection", suspect, 1, `isInstalled=${String(installed ?? "n/a")}`)
}

export function detectPermissionsAPI(): SignalResult {
  const suspect = !("permissions" in navigator)
  return signal("permissions-api", "navigator.permissions missing", suspect, 1)
}

export function detectWebRTC(): SignalResult {
  const hasWebRTC = "RTCPeerConnection" in window
  const suspect = !hasWebRTC
  return signal("webrtc", "WebRTC not available", suspect, 1)
}


export async function startActivityProbe(ms = 5000): Promise<SignalResult[]> {
  const start = performance.now()
  let moves = 0,
    clicks = 0,
    keys = 0,
    scrolls = 0
  let lastT = 0
  const intervals: number[] = []

  function recordInterval() {
    const t = performance.now()
    if (lastT) intervals.push(t - lastT)
    lastT = t
  }

  const onMove = () => {
    moves++
    recordInterval()
  }
  const onClick = () => {
    clicks++
    recordInterval()
  }
  const onKey = () => {
    keys++
    recordInterval()
  }
  const onScroll = () => {
    scrolls++
    recordInterval()
  }

  window.addEventListener("pointermove", onMove)
  window.addEventListener("click", onClick)
  window.addEventListener("keydown", onKey)
  window.addEventListener("scroll", onScroll)

  await new Promise((r) => setTimeout(r, ms))

  window.removeEventListener("pointermove", onMove)
  window.removeEventListener("click", onClick)
  window.removeEventListener("keydown", onKey)
  window.removeEventListener("scroll", onScroll)

  let varianceAccumulator = 0
  if (intervals.length > 1) {
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length
    varianceAccumulator = intervals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (intervals.length - 1)
  }

  const noInteraction = moves + clicks + keys + scrolls === 0
  const veryRegular = intervals.length >= 5 && varianceAccumulator < 5

  return [
    signal(
      "probe-no-input",
      `No input during ${Math.round((performance.now() - start) / 1000)}s`,
      noInteraction,
      3,
      `moves=${moves}, clicks=${clicks}, keys=${keys}, scrolls=${scrolls}`
    ),
    signal(
      "probe-regularity",
      "Highly regular input timing",
      veryRegular,
      1.5,
      intervals.length ? `n=${intervals.length}, variance≈${varianceAccumulator.toFixed(2)}` : "n=0"
    ),
  ]
}


export function detectFocusBlurPatterns(): SignalResult {
  let lostFocus = false
  window.addEventListener("blur", () => {
    lostFocus = true
  })
  return signal("focus-blur", "Did the user lose focus?", lostFocus, 0.5)
}

export function detectResizeEvents(): SignalResult {
  let resized = false
  window.addEventListener("resize", () => {
    resized = true
  })
  return signal("resize", "User resized window?", resized, 0.5)
}

export function detectTouchGestures(): SignalResult {
  let pinchZoom = false
  window.addEventListener("gesturestart", () => {
    pinchZoom = true
  })
  return signal("touch-gestures", "User performed touch gestures?", pinchZoom, 1)
}


export function summarize(results: SignalResult[]): Summary {
  const score = results.reduce((acc, s) => acc + (s.suspicious ? s.weight : 0), 0)
  const max = results.reduce((acc, s) => acc + s.weight, 0)
  let level: Summary["level"] = "low"
  if (score >= 8) level = "high"
  else if (score >= 4) level = "medium"
  return { score: Number(score.toFixed(1)), max: Number(max.toFixed(1)), level }
}

export function runStaticDetections(): SignalResult[] {
  return [
    detectWebdriver(),
    detectHeadlessUA(),
    detectPluginsAnomaly(),
    detectLanguagesAnomaly(),
    detectWebGLBlacklist(),
    detectTouchMismatch(),
    detectTimezoneAvailable(),
    detectScreenResolution(),
    detectDeviceSpecs(),
    detectChromeApp(),
    detectPermissionsAPI(),
    detectWebRTC(),
  ]
}

export async function runAllDetections(ms = 5000): Promise<{ results: SignalResult[]; summary: Summary }> {
  const staticResults = runStaticDetections()
  const dynamicResults = await startActivityProbe(ms)
  const behavioralResults = [detectFocusBlurPatterns(), detectResizeEvents(), detectTouchGestures()]
  const all = [...staticResults, ...dynamicResults, ...behavioralResults]
  const summary = summarize(all)
  return { results: all, summary }
}
