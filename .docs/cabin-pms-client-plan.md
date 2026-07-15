# Cabin / Apartment PMS — Project Brief

**Bring this file into the new repo and start from Phase 1.**  
**Last updated:** July 2026

---

## 1. Status (locked)

| Item | Decision |
|------|----------|
| Product path | **Custom PMS (Approach B)** |
| OTA strategy (now) | **B2** — keep their iCal; improve ops with ping + PMS |
| OTAs live | **Booking.com · Airbnb · Agoda** |
| Client sync today | **Confirmed: native iCal** (OTA↔OTA), no paid CM |
| Channel Manager | **Later (B1)** if volume / double-books / scale needs real-time |
| Website booking | Planned — triggers **B2b** (PMS as iCal hub) |

```text
B) Custom PMS
   └── B2a (Phase 1)  → ops PMS + email/WhatsApp ping + quick confirm
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
- Guests, reports, staff roles
- Later: **own website booking**
- Guest details (iCal does not bring reliable guest/payment data) → **email ping + quick confirm**

---

## 4. Architecture roadmap

### Phase 1 — B2a (build first)

```text
Airbnb ◄──iCal──► Booking.com ◄──iCal──► Agoda     (leave as-is)
         │
    booking emails
         ▼
  Custom PMS  ←── WhatsApp/Telegram ping
  (ops truth)     quick-confirm draft reservation
  check-in, reports, staff
```

### Phase 2 — B2b (when website booking ships)

```text
Airbnb / Booking / Agoda  ──export──►  PMS imports (timer + Sync now)
                                            │
                       website / walk-in ───┤
                                            ▼
                                     PMS = calendar truth
                                            │
                                     PMS export .ics / unit
                                            ▼
                              each OTA imports PMS feed
                         (drop peer OTA↔OTA links when stable)
```

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
| Import OTA `.ics` on a timer (5–15 min) | **Yes** | Keep PMS calendar fresh |
| Button **Sync now** (pull into PMS) | **Yes** | |
| Export PMS `.ics` per unit | **Yes** | For OTAs + website era |
| Instant update PMS export on website book | **Yes** | OTAs still pull on *their* schedule |
| Email → WhatsApp ping → quick confirm UI | **Yes** | Core Phase 1 UX |
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
2. **Reservations** — create/edit; sources: `manual`, `website` (later), `booking_com`, `airbnb`, `agoda`.  
3. **Check-in / check-out** workflow + statuses.  
4. **Reports** — occupancy, arrivals/departures, basic revenue by source.  
5. **Staff auth** + roles (admin / front desk).  
6. **OTA email ingest** (forward to inbox) → parse best-effort → **WhatsApp/Telegram** notify.  
7. **Quick confirm** screen (GitHub-PR style): pre-filled draft → human Confirm → save to PMS.  
8. Optional checklist: “Refresh Airbnb / Agoda if urgent.”

### Nice soon (still Phase 1.x)

- Import OTA iCal URLs into PMS (read-only blocks / draft bookings).  
- PMS **Sync now** + cron pull.  
- Audit log of sync / confirms.

### Explicitly out of Phase 1

- Channel Manager / Channex.  
- Scraping OTA extranets / remote Import now bots.  
- Full dynamic pricing.  
- Replacing their OTA↔OTA iCal mesh on day one.

### Phase 2 (website)

- Public booking engine on company site → writes PMS.  
- PMS export `.ics` per unit → OTAs import PMS.  
- Migrate from mesh → hub when stable.

---

## 9. Suggested UX: ping → confirm

```text
OTA booking email
    → parser (draft fields)
    → WhatsApp: "New Booking.com — Open in PMS"
    → Staff opens pre-filled reservation
    → Confirm → PMS source of truth
    → (Optional) Staff refreshes other OTAs if last-minute
```

iCal may already block other OTAs on delay; ping is for **ops data + speed**, not replacing iCal.

---

## 10. Do / don’t

| Do | Don’t |
|----|--------|
| Keep their working iCal in Phase 1 | Rip OTA sync before PMS is trusted |
| PMS = ops + website source of truth | Promise zero double-booking with iCal only |
| Warn about hours delay | Promise remote OTA Import now from PMS |
| Plan B2b hub for website | Build extranet scrapers for client |
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
- [ ] Who receives OTA emails today (addresses to forward)  
- [ ] WhatsApp Business vs Telegram for staff pings  
- [ ] Website booking timeline  
- [ ] Double-book history / how often last-minute bookings  
- [ ] Languages (EN / ID) for staff UI  

---

## 13. Build order (start here)

1. Auth + units + calendar + manual reservations  
2. Check-in / check-out + daily ops views  
3. Basic reports  
4. Email ingest + notify + quick-confirm  
5. iCal import into PMS + Sync now  
6. Website booking + iCal export hub (Phase 2)  
7. Evaluate CM only if needed (Phase 3)

---

## 14. One-paragraph pitch (client)

> Kami bangun PMS untuk check-in, kalender, laporan, dan nanti booking di website. Sync Booking / Airbnb / Agoda yang sudah jalan via iCal tetap dipakai. PMS menambah notifikasi + konfirmasi cepat saat ada booking OTA. iCal tidak real-time (delay hitungan jam, risiko double booking kecil tetap ada). Kalau nanti butuh sync harga/real-time, baru pasang Channel Manager.

---

*Research basis: Booking.com / Airbnb / Agoda partner docs & tutorials; host blogs; iCal pull model. Hacks to remote-click Import now exist but are not recommended for production.*
