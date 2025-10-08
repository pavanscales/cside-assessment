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

function signal(
  id: string,
  name: string,
  suspicious: boolean,
  weight: number,
  details?: string
): SignalResult {
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
  const suspect = wd || "webdriver" in navigator
  return signal("webdriver", "navigator.webdriver present", suspect, 3, `value=${String(wd)}`)
}

export function detectHeadlessUA(): SignalResult {
  const ua = UA().toLowerCase()
  const patterns = [
    "headlesschrome", "puppeteer", "playwright", "selenium",
    "phantom", "electron", "bot", "crawler", "spider",
    "slurp", "percy", "headless"
  ]
  const hit = patterns.some(p => ua.includes(p))
  return signal("ua-headless", "User-Agent hints at automation", hit, 2, hit ? `UA=${ua}` : undefined)
}

export function detectAutomationGlobals(): SignalResult {
  const g = window as any
  const suspects = [
    "callPhantom", "__nightmare", "__driver_evaluate",
    "__selenium_unwrapped", "__phantomas", "__PLAYWRIGHT_GLOBAL__",
    "Puppeteer", "__puppeteer_evaluate"
  ]
  const found = suspects.filter(k => k in g)
  return signal("automation-globals", "Common automation globals present", found.length > 0, 3, found.length ? `found=${found.join(",")}` : undefined)
}

export function detectFunctionTampering(): SignalResult {
  try {
    const pluginsItem = typeof (navigator as any).plugins?.item === "function"
    const mimeItem = typeof (navigator as any).mimeTypes?.item === "function"
    const suspect = !pluginsItem || !mimeItem || pluginsItem.toString().includes("native code") === false
    return signal("fn-tamper", "Navigator functions tampered", suspect, 1.5, `plugins.item=${String(pluginsItem)}, mime.item=${String(mimeItem)}`)
  } catch {
    return signal("fn-tamper", "Navigator tamper check failed", true, 1.5)
  }
}

export function detectPluginsAnomaly(): SignalResult {
  const len = (navigator as MaybeNavigator).plugins?.length ?? 0
  const suspect = len === 0 && !isIOS()
  const weight = isIOS() ? 0.5 : 1.5
  return signal("plugins", "No browser plugins detected", suspect, weight, `plugins.length=${len}`)
}

export function detectLanguagesAnomaly(): SignalResult {
  const langs = ((navigator as MaybeNavigator).languages || []).filter(Boolean)
  const suspect = langs.length === 0 || langs.some(l => l.length < 2)
  return signal("languages", "Empty or short navigator.languages", suspect, 1.5, `languages=${langs.join(",")}`)
}

function getWebGLInfo(): { vendor?: string, renderer?: string, extCount?: number } {
  try {
    const canvas = document.createElement("canvas")
    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null
    if (!gl) return {}
    const ext = gl.getExtension("WEBGL_debug_renderer_info")
    const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : ""
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ""
    return { vendor, renderer, extCount: gl.getSupportedExtensions()?.length ?? 0 }
  } catch { return {} }
}

export function detectWebGLBlacklist(): SignalResult {
  const { vendor = "", renderer = "", extCount = 0 } = getWebGLInfo()
  const r = `${vendor} ${renderer}`.toLowerCase()
  const blacklist = ["swiftshader", "llvmpipe", "mesa", "software rasterizer", "virtualbox", "vmware", "parallels"]
  const hit = blacklist.some(b => r.includes(b)) || extCount < 20
  return signal("webgl", "WebGL vendor/renderer looks virtualized", hit, 2.5, `${vendor} | ${renderer}, ext=${extCount}`)
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
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone } catch {}
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
  return signal("permissions-api", "navigator.permissions missing", !("permissions" in navigator), 1)
}

export function detectWebRTC(): SignalResult {
  return signal("webrtc", "WebRTC not available", !("RTCPeerConnection" in window), 1)
}

export function detectPerformanceNowDrift(): SignalResult {
  const start = performance.now()
  const delay = 50
  const t0 = Date.now()
  while (Date.now() - t0 < delay) {}
  const delta = performance.now() - start
  return signal("perf-drift", "Performance.now drift anomaly", Math.abs(delta - delay) > 5, 2, `delta≈${delta.toFixed(2)}ms`)
}

export function detectCanvasFingerprint(): SignalResult {
  try {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) return signal("canvas", "Canvas unavailable", true, 2)
    ctx.textBaseline = "top"
    ctx.font = "14px 'Arial'"
    ctx.fillText("bot-check", 2, 2)
    const data = canvas.toDataURL()
    const hash = Array.from(data).reduce((a,c)=> (a + c.charCodeAt(0)) % 9973, 0)
    return signal("canvas-fp", "Canvas fingerprint entropy", hash<1000 || hash>9000, 1.5, `hash=${hash}`)
  } catch { return signal("canvas-fp", "Canvas failed", true, 2) }
}

export function detectMediaDevices(): SignalResult {
  const hasMedia = !!(navigator.mediaDevices?.enumerateDevices)
  return signal("media-devices", "Media devices available", !hasMedia, 1)
}

export function detectFontEnumeration(): SignalResult {
  try {
    const el = document.createElement("span")
    el.style.fontFamily = "Arial, 'Times New Roman', monospace"
    el.innerText = "font-check"
    document.body.appendChild(el)
    const w = el.offsetWidth
    document.body.removeChild(el)
    return signal("font-probe", "Font metric anomaly", !w || w < 10, 0.5, `width=${w}`)
  } catch { return signal("font-probe", "Font probe failed", true, 0.5) }
}

export function detectAudioContext(): SignalResult {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AC) return signal("audio", "AudioContext missing", true, 0.5)
    const ctx = new AC()
    const allowed = typeof ctx.createAnalyser === "function"
    ctx.close?.()
    return signal("audio", "AudioContext feature check", !allowed, 0.5)
  } catch { return signal("audio", "AudioContext error", true, 0.5) }
}


export async function startActivityProbe(ms = 5000): Promise<SignalResult[]> {
  let moves=0, clicks=0, keys=0, scrolls=0, lastPos={x:-1,y:-1}, tinyMoves=0
  const intervals:number[]=[]; let lastT=0

  const record = (pos?:{x:number,y:number})=>{
    const t = performance.now()
    if(lastT) intervals.push(t-lastT)
    lastT=t
    if(pos && lastPos.x>=0){
      const dx=Math.abs(pos.x-lastPos.x)
      const dy=Math.abs(pos.y-lastPos.y)
      if(dx<=1 && dy<=1) tinyMoves++
      lastPos=pos
    }
  }

  const onMove=(e:PointerEvent)=>{moves++; record({x:e.clientX,y:e.clientY})}
  const onClick=()=>{clicks++; record()}
  const onKey=()=>{keys++; record()}
  const onScroll=()=>{scrolls++; record()}

  window.addEventListener("pointermove", onMove)
  window.addEventListener("click", onClick)
  window.addEventListener("keydown", onKey)
  window.addEventListener("scroll", onScroll)

  await new Promise(r=>setTimeout(r, ms))

  window.removeEventListener("pointermove", onMove)
  window.removeEventListener("click", onClick)
  window.removeEventListener("keydown", onKey)
  window.removeEventListener("scroll", onScroll)

  const mean = intervals.length>0 ? intervals.reduce((a,b)=>a+b,0)/intervals.length : 0
  const variance = intervals.length>1 ? intervals.reduce((acc,v)=>acc+(v-mean)**2,0)/(intervals.length-1) : 0
  const sum = intervals.reduce((a,b)=>a+b,0)
  const probs = intervals.map(i=>i/(sum||1))
  const entropy = -probs.reduce((a,p)=>a+(p*Math.log2(p||1)),0)
  const noInput = moves+clicks+keys+scrolls === 0
  const tooRegular = variance<5 && entropy<2
  const impossibleSpeed = intervals.some(i=>i<8)
  const excessiveTinyMoves = tinyMoves>Math.max(10,Math.floor(moves*0.5))

  return [
    signal("probe-no-input", `No input during ${Math.round(ms/1000)}s`, noInput, 3, `moves=${moves}, clicks=${clicks}, keys=${keys}, scrolls=${scrolls}`),
    signal("probe-regularity", "Low entropy in input timing", tooRegular, 1.5, `n=${intervals.length}, var=${variance.toFixed(1)}, H=${entropy.toFixed(2)}`),
    signal("probe-impossible-speed", "Impossible input speed detected", impossibleSpeed, 2, `minInterval=${Math.min(...(intervals.length?intervals:[Infinity]))}`),
    signal("probe-jitter", "Too many tiny pointer movements", excessiveTinyMoves, 1.5, `tinyMoves=${tinyMoves}, moves=${moves}`)
  ]
}

export async function detectFocusBlurPatterns(ms=3000): Promise<SignalResult> {
  let lostFocus=false
  window.addEventListener("blur",()=>lostFocus=true)
  await new Promise(r=>setTimeout(r, ms))
  return signal("focus-blur","Did user lose focus?",lostFocus,0.5)
}

export async function detectResizeEvents(ms=3000): Promise<SignalResult> {
  let resized=false
  window.addEventListener("resize",()=>resized=true)
  await new Promise(r=>setTimeout(r, ms))
  return signal("resize","Did user resize window?",resized,0.5)
}

export async function detectTouchGestures(ms=3000): Promise<SignalResult> {
  let pinch=false
  window.addEventListener("gesturestart",()=>pinch=true)
  await new Promise(r=>setTimeout(r, ms))
  return signal("touch-gestures","User performed touch gestures?",pinch,1)
}


export function summarize(results: SignalResult[]): Summary {
  const score = results.reduce((a,s)=>a+(s.suspicious?s.weight:0),0)
  const max = results.reduce((a,s)=>a+s.weight,0)
  const ratio = max>0 ? score/max : 0
  const level = ratio>=0.7 ? "high" : ratio>=0.4 ? "medium" : "low"
  return { score:+score.toFixed(1), max:+max.toFixed(1), level }
}

export function runStaticDetections(): SignalResult[] {
  return [
    detectWebdriver(), detectHeadlessUA(), detectAutomationGlobals(), detectFunctionTampering(),
    detectPluginsAnomaly(), detectLanguagesAnomaly(), detectWebGLBlacklist(), detectTouchMismatch(),
    detectTimezoneAvailable(), detectScreenResolution(), detectDeviceSpecs(), detectChromeApp(),
    detectPermissionsAPI(), detectWebRTC(), detectMediaDevices(), detectPerformanceNowDrift(),
    detectCanvasFingerprint(), detectFontEnumeration(), detectAudioContext()
  ]
}

export async function runAllDetections(ms=5000): Promise<{results:SignalResult[], summary:Summary}> {
  const staticResults = runStaticDetections()
  const dynamicResults = await startActivityProbe(ms)
  const behavioralResults = await Promise.all([
    detectFocusBlurPatterns(ms), detectResizeEvents(ms), detectTouchGestures(ms)
  ])
  const all = [...staticResults, ...dynamicResults, ...behavioralResults]
  const summary = summarize(all)
  try { (window as any).__BOT_DETECTION_OUTPUT__ = { summary, results: all, ts: Date.now() } } catch {}
  return { results: all, summary }
}
