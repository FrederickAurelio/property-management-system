# Cabin / Apartment PMS — Project Brief

**Bring this file into the new repo and start from Phase 1.**  
**Last updated:** July 2026

---

## 1. Status (locked)

| Item | Decision |
|------|----------|
| Product path | **Custom PMS (Approach B)** |
| OTA strategy (now) | **B2** — iCal; PMS imports each OTA + staff enrich guest/money |
| OTAs live | **Booking.com · Airbnb · Agoda** |
| OTA topology (prod target) | **Hub** — each OTA imports PMS export only; drop peer OTA↔OTA links when PMS trusted (see [`reservations-design.md`](reservations-design.md) §9) |
| Client bootstrap | Was **OTA↔OTA mesh** (no CM); migrate to hub — not required on day one |
| Channel Manager | **Later (B1)** if volume / double-books / scale needs real-time |
| Website booking | Phase 2 — **requires** hub; start hub migration earlier if desk echo noise hurts |
| Email ingest | **Out** — unreliable; not Phase 1 |

```text
B) Custom PMS
   └── B2a (Phase 1)  → ops PMS + iCal import + staff enrich (no email parser)
   └── B2b (Phase 2)  → website booking + PMS iCal hub
   └── B1  (Phase 3+) → optional paid Channel Manager API
```

---

## 2. Terms

| Term | Meaning |
|------|---------|
| **PMS** | Property Management System — ops brain: units, calendar, guests, check-in/out, reports. **Source of truth for operations.** |
| **OTA** | Online Travel Agency — Booking.com, Airbnb, Agoda. |
| **CM** | Channel Manager — paid real-time API sync to OTAs (not used now). |
| **iCal** | Free `.ics` calendar URL sync. Dates only. Pull-based, delayed. **What client uses now.** |
| **Hub** | PMS export `.ics` per unit → each OTA imports **only** that; PMS imports each OTA export. Prod target. |
| **Mesh** | OTAs also import each other’s `.ics` (peer links). Bootstrap only — causes echo stubs in PMS. |
| **Booking engine** | Book flow on **their website**, writing into the same PMS. |

---

## 3. Client reality

- ~cabins/apartments (confirm exact unit count).
- No PMS today → check-in / reports / staff ops are the pain.
- OTAs already cross-block dates via **iCal** (setup once; feels automatic).
- Prices are **not** synced by iCal (manual per OTA).
- Double-booking still possible during iCal delay window (hours, not usually a full day).

### What custom PMS still must solve

Even with working OTA iCal:

- Central calendar + reservations for **ops**
- Check-in / check-out
- Guests, reports, staff roles, money/DP on the reservation
- Later: **own website booking**
- Guest details (iCal does not bring reliable guest/payment data) → **staff enrich** from OTA extranet / guest contact when needed (`UNCONFIRMED` queue)

---

## 4. Architecture roadmap

### Phase 1 — B2a (build first)

```text
Bootstrap (client may still have):
  Airbnb ◄──iCal──► Booking.com ◄──iCal──► Agoda     ← remove peer links when hub verified

Always:
  each OTA export ──► PMS imports (cron + Sync all)
         ▼
  Custom PMS (ops truth)
  iCal → UNCONFIRMED stub → staff enrich guest + $
  check-in, reports, money/DP, staff
```

**Prod migration (when PMS trusted):** paste PMS export on all OTAs → verify blocks → drop peer OTA↔OTA imports per unit. Detail: [`reservations-design.md`](reservations-design.md) §9 “OTA topology”.

### Phase 2 — B2b (website booking + hub required)

```text
Airbnb / Booking / Agoda  ──export──►  PMS imports (timer + Sync now)
                                            │
                       website / walk-in ───┤
                                            ▼
                                     PMS = calendar truth
                                            │
                                     PMS export .ics / unit
                                            ▼
                              each OTA imports PMS feed only (hub)
```

Hub is **required** before public website book (walk-in + web + OTA share one export). Prefer hub in Phase 1 prod even without website — cleaner desk, one stub per booking.

### Phase 3 — B1 (optional)

Paid CM (e.g. Channex ~Rp 2–3 jt/mo class for ~100 VR units) for **real-time** rates + availability. Only when iCal delay / scale hurts.

---

## 5. iCal — how it works (beginner)

### Concept

- Each listing has an **export URL** (busy dates).
- Other sites **import** that URL and **pull** it on a timer.
- **Not push, not real-time.** After one-time paste, day-to-day feels automatic.

| Platform | Feature | Auto pull (approx) | Manual refresh |
|----------|---------|--------------------|----------------|
| Booking.com | Sync calendars | ~ every **2 hours** | **Import now** |
| Airbnb | Connect calendars | ~ every **3 hours** | **Refresh** |
| Agoda | Calendar connections | several× / day | Refresh connections |

### One-unit mesh setup (what client already did)

1. Copy export from Airbnb, Booking, Agoda.  
2. Booking imports Airbnb + Agoda.  
3. Airbnb imports Booking + Agoda.  
4. Agoda imports Booking + Airbnb.  
5. Never paste again unless URL breaks.

### Delay & double booking

```text
10:00  Booked on Booking.com
10:05  Airbnb still open          ← risk window
10:20  Second guest could book Airbnb
13:00  Airbnb pulls iCal and blocks (too late)
```

Delay is usually **hours** (~2–6h typical), not always 1 day. **Yes, double booking can happen.**

Staff can speed catch-up: open Airbnb/Agoda → **Refresh / Import now** (no re-paste).

---

## 6. What PMS can / cannot do with iCal

| Capability | Build? | Notes |
|------------|--------|-------|
| Import OTA `.ics` on a timer (5–15 min) | **Yes** | Keep PMS calendar fresh; create `UNCONFIRMED` |
| Button **Sync now** (pull into PMS) | **Yes** | |
| Export PMS `.ics` per unit | **Yes** | For OTAs + website era (Phase 2 hub) |
| Instant update PMS export on website book | **Yes** | OTAs still pull on *their* schedule |
| Staff enrich guest + money on iCal stubs | **Yes** | Core ops UX (“Needs details”) |
| Email → WhatsApp ping → quick confirm UI | **No** | Opted out — fragile / unreliable |
| Remotely trigger OTA **Import now / Refresh** | **No (official)** | No public API |
| Browser bot / scrape to click Import now | Hack only | **Do not ship** — fragile, ToS, login risk |
| Real-time push rates+avail to all OTAs | Needs **CM** | Phase 3 |

**Rule:** PMS “Sync all” = refresh **our** copy of calendars. It does **not** force OTAs to pull us instantly.

---

## 7. Inventory model (DB)

Hotel rooms vs apartments are **not** two databases. Same idea: bookable resource + date ranges.

Prefer **unique unit** model (fits cabins + iCal):

```text
property
  └── unit_type (optional grouping)
        └── unit (Cabin 01, 02, …)   ← one calendar each
              └── reservations / blocks
```

- Allotment (“Deluxe × 20”) can be added later if needed.  
- Ask once: guest picks **specific cabin** or only **type**?

---

## 8. Phase 1 product scope (MVP)

### Must have

1. **Units** CRUD + calendar view (busy/free).  
2. **Reservations** — create/edit; sources: `manual`, `website` (later), `booking_com`, `airbnb`, `agoda`; money/DP summary.  
3. **Check-in / check-out** workflow + statuses.  
4. **Reports** — occupancy, arrivals/departures, basic revenue by source.  
5. **Staff auth** + roles (admin / front desk).  
6. **iCal import** into PMS → `UNCONFIRMED` stubs + **Sync now** + staff enrich queue.  
7. Optional checklist: “Refresh Airbnb / Agoda if urgent” (manual in OTA UI).

### Explicitly out of Phase 1

- **OTA email ingest** / WhatsApp ping / quick-confirm parser.  
- Channel Manager / Channex.  
- Scraping OTA extranets / remote Import now bots.  
- Full dynamic pricing.  
- Dropping peer OTA↔OTA mesh before PMS export is verified on all channels.

### Phase 2 (website)

- Public booking engine on company site → writes PMS (`apps/web`: Vite + React; prerender/SSG for SEO pages; CDN in front of public origin).  
- PMS export `.ics` per unit → OTAs import PMS.  
- **Hub topology** before website go-live; migrate mesh → hub when PMS trusted (can be Phase 1 prod).  
- Guest cancel / change-date / refund self-serve only after client policy is locked.

---

## 9. Suggested UX: iCal → enrich

```text
OTA booking
    → PMS pulls that OTA export .ics (timer / Sync all)
    → Reservation UNCONFIRMED on unit calendar
    → Staff “Needs details” → guest + total/paid → Confirm
    → PMS export blocks other OTAs (on their poll delay)
    → (Optional) Staff refreshes OTA import if last-minute
```

Peer OTA↔OTA mesh (if still present) can echo extra stubs — migrate to hub when PMS trusted.

iCal owns **availability** in PMS. Staff owns **guest + money** when the OTA feed is blank.

---

## 10. Do / don’t

| Do | Don’t |
|----|--------|
| Keep iCal in Phase 1; migrate mesh → **hub** when PMS trusted | Drop peer OTA↔OTA before PMS export works on all OTAs |
| PMS = ops + calendar export truth | Promise zero double-booking with iCal only |
| Warn about hours delay; manual OTA Refresh when urgent | Promise remote OTA Import now from PMS |
| Hub before website; hub early if echo stubs annoy desk | Build extranet scrapers for client |
| Prices stay manual per OTA until CM | Claim iCal syncs prices |

---

## 11. Commercial / CM notes (for later)

| Option | ~ cost | When |
|--------|--------|------|
| Stay on iCal | Rp 0 | Phase 1–2 |
| Local CM (Hybridbooking etc.) | ~Rp 1.2–1.6 jt/mo | If they abandon custom sync |
| Channex VR WhiteLabel | ~$180 ≈ Rp 2.9 jt/mo (100 units @ $0.50 + platform) | Custom PMS needs API CM |

Hotel vs unit billing: unique cabins often billed **per unit** on CM platforms.

---

## 12. Open questions (confirm while building)

- [ ] Exact unit count & naming  
- [ ] Guest books specific unit vs type only  
- [ ] Website booking timeline  
- [ ] Double-book history / how often last-minute bookings  
- [ ] Languages (EN / ID) for staff UI  

---

## 13. Build order (start here)

1. Auth + units + calendar + manual reservations (+ money/DP)  
2. Check-in / check-out + daily ops views  
3. Basic reports  
4. iCal import into PMS + Sync now + enrich queue  
5. Website booking + iCal export hub (Phase 2)  
6. Evaluate CM only if needed (Phase 3)

---

## 14. One-paragraph pitch (client)

> Kami bangun PMS untuk check-in, kalender, laporan, uang/DP, dan nanti booking di website. Sync Booking / Airbnb / Agoda yang sudah jalan via iCal tetap dipakai; PMS juga menarik iCal ke kalender internal (stub → staf lengkapi data tamu). iCal tidak real-time (delay hitungan jam, risiko double booking kecil tetap ada). Tidak ada parser email OTA. Kalau nanti butuh sync harga/real-time, baru pasang Channel Manager.

---

*Research basis: Booking.com / Airbnb / Agoda partner docs & tutorials; host blogs; iCal pull model. Hacks to remote-click Import now exist but are not recommended for production.*
