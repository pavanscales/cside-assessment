# Client-Side Human vs Bot Detection

## Overview
This repository contains a **client-side script** that detects whether the current browser session is likely **automated** or **human-driven**.  
It runs entirely in the browser and does **not** rely on third-party bot detection services.

**Live Demo:** [https://cside-assesment.vercel.app/](https://cside-assesment.vercel.app/)

---

## Detections Implemented

### Static Detections
- `navigator.webdriver` check
- User-Agent inspection for headless/automation hints
- Browser plugin anomalies
- Language settings anomalies
- WebGL vendor/renderer blacklist
- Touch support vs User-Agent mismatch
- Timezone availability
- Screen resolution sanity check
- Device specs (CPU cores, memory)
- Chrome app detection
- Permissions API presence
- WebRTC availability

### Behavioral Signals
- Focus/blur patterns
- Window resize events
- Touch gestures

### Activity Probe
- Monitors mouse movements, clicks, keyboard inputs, and scroll events for 5 seconds
- Analyzes timing variance to detect overly regular behavior

---

## Summary and Risk Levels
Signals are aggregated into a **risk score** and mapped to status levels:

| Level         | Suspicion |
|---------------|-----------|
| Human         | Low       |
| Suspicious    | Medium    |
| Automated     | High      |

---

## Expected False Positives
- Users with **restricted browsers** or strict privacy settings
- Users with **unusual interaction patterns** (very slow or very fast inputs)
- Mobile or touch devices with **unconventional configurations**

---

## Repository Contents
- `app/page.tsx` – Demo page with UI and status badge
- `app/lib/botDetector.ts` – Detection script implementing all signals
- `README.md` – Project overview and instructions

---

## Usage
Simply open the **demo page** in a browser and the script will automatically evaluate whether the session is human or automated.  

Results are displayed on the **status badge** and can also be inspected via the browser console.
