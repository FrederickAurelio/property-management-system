# Inventory & reservation tables (prod design)

**Status:** locked design for Prisma / API / PMS.  
**Wire types:** `@cabin/api-contract` (`StaffProperty` / `StaffUnitType` / `StaffUnit`).  
**Display helpers:** [`inventory-types.ts`](../apps/pms/src/pages/properties/inventory-types.ts).  
**Scope:** multi-property inventory + reservation-ready unit calendars.  
**Product context:** [`.docs/cabin-pms-client-plan.md`](../.docs/cabin-pms-client-plan.md)

---

## 1. Goal

Model real apartments the way ops and OTAs work:

- Many **properties**
- Each property has several **unit types** (shared specs: size, beds, amenities, rack rate)
- Each type has many **units** (physical apartments — one calendar each)
- **Reservations / blocks** attach to a **unit**, never only to a type

```text
Property 1 ── * UnitType 1 ── * Unit 1 ── * Reservation
                                    └── * CalendarBlock
```

Booking.com “Deluxe Studio / 18 m² / amenities” = **UnitType**.  
“Room 1208 / floor 12 / maintenance” = **Unit**.  
“Guest stays 25–26 Jul on unit 1208” = **Reservation**.

---

## 2. Entity map

| Table | Job | FE uses for | BE uses for |
|-------|-----|-------------|-------------|
| `Property` | Place / site | Property switcher, settings, maps | Scope all inventory |
| `UnitType` | Kind of apartment (×5 at Skybreeze) | Type list, filters, type detail | Shared specs; allotment counts |
| `Unit` | Bookable physical apartment | Unit list, calendar rows | Availability, iCal, ops |
| `Reservation` | Confirmed stay on a unit | Calendar, arrivals, detail | Overlap, reports, check-in |
| `CalendarBlock` | Non-guest hold (maintenance, owner use) | Calendar busy slots | Overlap with stays |

Out of Phase 1 inventory tables: OTA rate plans, live OTA prices, amenity master catalog, allotment-only inventory.

---

## 3. Relationships

```text
Property
  id
  │
  ├──< UnitType.propertyId
  │      id
  │      │
  │      └──< Unit.unitTypeId
  │             id
  │             │
  │             ├──< Reservation.unitId
  │             └──< CalendarBlock.unitId
  │
  └──< Unit.propertyId          (denormalized = same as type’s property)
```

Cardinality:

| From | To | Rule |
|------|----|------|
| Property | UnitType | 1 → many |
| UnitType | Unit | 1 → many |
| Unit | Reservation | 1 → many |
| Unit | CalendarBlock | 1 → many |
| Unit | UnitType | many → 1 |
| UnitType | Property | many → 1 |

Invariant: `Unit.propertyId` **must equal** `UnitType.propertyId` for that unit’s type (enforce in service on create/update).

---

## 4. Enums

```text
UnitStatus
  ACTIVE
  INACTIVE
  MAINTENANCE

UnitLayout
  STUDIO
  APARTMENT
  CABIN
  OTHER

BedKind
  SINGLE
  DOUBLE
  LARGE_DOUBLE
  QUEEN
  KING
  SOFA_BED
  OTHER

MediaKind
  IMAGE
  VIDEO

ReservationSource
  MANUAL
  WEBSITE
  BOOKING_COM
  AIRBNB
  AGODA

ReservationStatus
  UNCONFIRMED    # iCal stub — on calendar, needs enrichment
  CONFIRMED
  CHECKED_IN
  CHECKED_OUT
  CANCELLED      # terminal — includes walk-away / never-arrived (notes optional)

PaymentStatus
  UNPAID
  DEPOSIT
  PAID
  REFUNDED

CollectedVia
  PROPERTY
  CHANNEL
  MIXED

PaymentMovementDirection
  IN
  OUT

PaymentMovementKind
  DEPOSIT
  TOP_UP
  REFUND
  CANCEL_REFUND
  CHANNEL_SETTLED

CalendarBlockReason
  MAINTENANCE
  OWNER
  HOLD
  OTHER
```

No `DRAFT` / email ingest — see [`reservations-design.md`](reservations-design.md).

Wire shared enums via `@cabin/api-contract` when FE + API both need them.

---

## 5. Tables

### 5.1 `Property`

| Column | Type | Null | Notes |
|--------|------|------|--------|
| `id` | `cuid` / `text` PK | no | |
| `code` | `varchar(32)` | no | Stable slug, unique globally — e.g. `SKYBREEZE_SENTRALAND` |
| `name` | `varchar(128)` | no | Display name |
| `timezone` | `varchar(64)` | no | IANA — e.g. `Asia/Jakarta` |
| `checkInFrom` | `time` or `varchar(5)` | yes | e.g. `15:00` |
| `checkInUntil` | `time` / `varchar(5)` | yes | e.g. `23:30` |
| `checkOutFrom` | `time` / `varchar(5)` | yes | |
| `checkOutUntil` | `time` / `varchar(5)` | yes | e.g. `12:00` |
| `addressLine` | `varchar(255)` | yes | Street / building line |
| `city` | `varchar(128)` | yes | |
| `countryCode` | `char(2)` | yes | `ID` |
| `latitude` | `decimal(10,7)` | yes | WGS84 — **our** multi-property map pins (web) |
| `longitude` | `decimal(10,7)` | yes | WGS84 — pair with `latitude` |
| `googlePlaceId` | `varchar(256)` | yes | Google Place ID (`ChIJ…`) — **Open in Google Maps** (named place). Prefer over share/short links |
| `coverImage` | `jsonb` | yes | Single `MediaItem` for explorer cards — see §6.3 |
| `isActive` | `boolean` | no | default `true` |
| `createdAt` | `timestamptz` | no | |
| `updatedAt` | `timestamptz` | no | |

**Location rules (locked)**

- Text address (`addressLine` / `city` / `countryCode`) for display.
- `latitude` + `longitude` + property `name` → Phase 2 web map (pin + title).
- `googlePlaceId` → deep link to Google’s named place card (not bare coordinates as title).
- Do **not** treat `maps.app.goo.gl` share URLs as the durable stored key.

**Indexes / constraints**

- `UNIQUE (code)`
- `INDEX (isActive)`
- `CHECK ((latitude IS NULL) = (longitude IS NULL))` — both null or both set

**FE shape (list):** `{ id, code, name, city, coverImage, isActive }`  
**FE shape (detail):** full row.

---

### 5.2 `UnitType`

Shared product specs for every unit of that kind. Booking room-type detail lives here.

| Column | Type | Null | Notes |
|--------|------|------|--------|
| `id` | `cuid` PK | no | |
| `propertyId` | FK → `Property` | no | `ON DELETE RESTRICT` |
| `code` | `varchar(32)` | no | Stable within property — e.g. `DLX_STUDIO` |
| `name` | `varchar(128)` | no | e.g. `Deluxe Studio` |
| `layout` | `UnitLayout` | no | `STUDIO` / `APARTMENT` / … |
| `sizeSqm` | `decimal(6,2)` | yes | e.g. `18.00` |
| `bedroomCount` | `int` | no | **Derived on write** — see below |
| `bathroomCount` | `int` | no | default `1` |
| `maxGuests` | `int` | no | Hard cap for booking validation |
| `defaultPriceIdr` | `int` | no | Rack rate **per night**, whole rupiah. Desk stay Total suggests `nights ×` this value ([`reservations-design.md`](reservations-design.md) §6). Not live OTA price. |
| `bedConfig` | `jsonb` | no | See §6.1 — rooms with **one or more** bed rows each |
| `amenities` | `jsonb` | no | See §6.2 — grouped lists for FE |
| `media` | `jsonb` | no | Ordered gallery — see §6.3; first `IMAGE` = card thumb |
| `description` | `text` | yes | Optional marketing / notes |
| `smokingAllowed` | `boolean` | no | default `false` |
| `sortOrder` | `int` | no | default `0` — FE type list order |
| `isActive` | `boolean` | no | default `true` |
| `createdAt` | `timestamptz` | no | |
| `updatedAt` | `timestamptz` | no | |

**`bedroomCount` (locked)**

```text
layout === STUDIO  →  bedroomCount = 0
otherwise          →  bedroomCount = bedConfig.length   (number of rooms)
```

PMS form shows bedrooms as **read-only**; staff edit rooms in `bedConfig`, not a separate bedroom input.

**Indexes / constraints**

- `UNIQUE (propertyId, code)`
- `INDEX (propertyId, isActive)`
- `INDEX (propertyId, sortOrder)`
- `CHECK (defaultPriceIdr >= 0)`

**FE shape (list):**  
`{ id, propertyId, code, name, layout, sizeSqm, maxGuests, bedroomCount, bathroomCount, defaultPriceIdr, isActive, unitCount?, mediaThumb? }`  
(`unitCount` = aggregate from API, not a stored column. Thumb = first IMAGE in `media`.)

**FE shape (detail):** list fields + `bedConfig` + `amenities` + `media` + `description` + `smokingAllowed`.

**Do not store:** live OTA prices, multi-currency, “rooms left”, refundable flags.

---

### 5.3 `Unit`

Physical bookable apartment. **Source of truth for calendar.**

| Column | Type | Null | Notes |
|--------|------|------|--------|
| `id` | `cuid` PK | no | |
| `propertyId` | FK → `Property` | no | Denormalized; must match type’s property |
| `unitTypeId` | FK → `UnitType` | no | `ON DELETE RESTRICT` |
| `code` | `varchar(32)` | no | Ops id — e.g. `DS-1208`, `B-0801` |
| `name` | `varchar(128)` | yes | Optional display override |
| `floor` | `varchar(16)` | yes | `12` / `G` — string keeps flexibility |
| `status` | `UnitStatus` | no | default `ACTIVE` — **only `ACTIVE` is bookable** |
| `notes` | `text` | yes | Internal only (access, quirks) |
| `sortOrder` | `int` | no | default `0` |
| `createdAt` | `timestamptz` | no | |
| `updatedAt` | `timestamptz` | no | |

**Indexes / constraints**

- `UNIQUE (propertyId, code)`
- `INDEX (propertyId, status)`
- `INDEX (unitTypeId)`
- `INDEX (propertyId, unitTypeId)`

**FE shape (list / calendar row):**  
`{ id, propertyId, unitTypeId, code, name, floor, status, unitType: { id, name, code, maxGuests } }`

**FE shape (detail):** list + `notes` + full nested `unitType` if needed.

Changing `unitTypeId` is rare; allow only when unit has no overlapping future confirmed stays (service rule).

---

### 5.4 `Reservation`

Stay on **one unit**. Designed so calendar, check-in, and reports share one row.

| Column | Type | Null | Notes |
|--------|------|------|--------|
| `id` | `cuid` PK | no | |
| `propertyId` | FK → `Property` | no | Denormalized for scoped queries |
| `unitId` | FK → `Unit` | no | Calendar key |
| `unitTypeId` | FK → `UnitType` | no | Snapshot helper — type at booking time (denormalized) |
| `source` | `ReservationSource` | no | |
| `status` | `ReservationStatus` | no | |
| `checkInDate` | `date` | no | **Stay night start** (property local date) |
| `checkOutDate` | `date` | no | **Exclusive end** — night of checkout not occupied |
| `guestName` | `varchar(128)` | no | |
| `guestEmail` | `varchar(255)` | yes | |
| `guestPhone` | `varchar(32)` | yes | |
| `guestCount` | `int` | yes | Null OK for iCal stubs; required `>= 1` on confirm / create-CONFIRMED; `<= maxGuests` |
| `notes` | `text` | yes | Staff / special requests |
| `totalAmountIdr` | `bigint` | yes | Stay quote (whole IDR); null until confirm |
| `paidAmountIdr` | `bigint` | no | default 0; **cache** = sum(`PaymentMovement.signedAmount`) |
| `paymentStatus` | `PaymentStatus` | no | `UNPAID` \| `DEPOSIT` \| `PAID` \| `REFUNDED` |
| `collectedVia` | `CollectedVia` | yes | Optional rollup from latest movement |
| `externalRef` | `varchar(128)` | yes | OTA booking id when known |
| `icalSyncWarning` | `IcalSyncWarning` | yes | |
| `icalSyncWarnedAt` | `timestamptz` | yes | |
| `confirmedAt` | `timestamptz` | yes | |
| `checkedInAt` | `timestamptz` | yes | |
| `checkedOutAt` | `timestamptz` | yes | |
| `cancelledAt` | `timestamptz` | yes | |
| `createdAt` | `timestamptz` | no | |
| `updatedAt` | `timestamptz` | no | |
| `createdByAdminId` | FK → `Admin` | yes | Manual creates |
| `updatedByAdminId` | FK → `Admin` | yes | |

**Date semantics (locked)**

```text
checkInDate  inclusive
checkOutDate exclusive
Stay nights = [checkInDate, checkOutDate)

Example: check-in 2026-07-25, check-out 2026-07-26 → occupies 1 night (25th).
```

**Indexes / constraints**

- `CHECK (checkOutDate > checkInDate)`
- `CHECK (guestCount IS NULL OR guestCount >= 1)`
- `INDEX (unitId, checkInDate, checkOutDate)`
- `INDEX (propertyId, checkInDate)` — arrivals board
- `INDEX (propertyId, checkOutDate)` — departures board
- `INDEX (propertyId, status)`
- `INDEX (source)`
- `UNIQUE (source, externalRef)` where `externalRef IS NOT NULL` — avoid duplicate OTA imports

**Overlap (locked — Postgres)**

For statuses that occupy the calendar (`UNCONFIRMED`, `CONFIRMED`, `CHECKED_IN`):

- No two occupying reservations on the **same `unitId`** with overlapping `[checkInDate, checkOutDate)`.
- Prefer Postgres **exclusion constraint** with `daterange` + `gist` (or transactional conflict check in Phase 1 if exclusion ships slightly later — product rule: never UI-only).

Same overlap rule applies vs `CalendarBlock` on that unit.

**FE shape (calendar event):**  
`{ id, unitId, checkInDate, checkOutDate, status, source, guestName, guestCount }`

**FE shape (detail):** full row + nested `unit` + `unitType` summary + `movements[]` (cash timeline).

**Not on this table:** line-item pricing, multi-unit group bookings. Cash movements live on **`PaymentMovement`** (below). Stay **Total** on create/edit is suggested from `UnitType.defaultPriceIdr × nights` (`suggestStayTotalIdr`). Paid is **not** auto-changed when nights change; if Paid > Total → `refundDueIdr` — see [`reservations-design.md`](reservations-design.md) §6.

---

### 5.4b `PaymentMovement`

Append-only cash ledger for a reservation. Nest `/staff/reservations` + PMS live client.

| Column | Type | Null | Notes |
|--------|------|------|--------|
| `id` | `cuid` PK | no | |
| `reservationId` | FK → `Reservation` | no | `ON DELETE CASCADE` |
| `direction` | `PaymentMovementDirection` | no | `IN` \| `OUT` |
| `kind` | `PaymentMovementKind` | no | `DEPOSIT` \| `TOP_UP` \| `REFUND` \| `CANCEL_REFUND` \| `CHANNEL_SETTLED` |
| `amountIdr` | `bigint` | no | always > 0 |
| `signedAmount` | `bigint` | no | +amount (IN) or −amount (OUT) |
| `method` | `CollectedVia` | yes | `PROPERTY` \| `CHANNEL` \| `MIXED` |
| `note` | `varchar(500)` | yes | |
| `createdAt` | `timestamptz` | no | |
| `createdByAdminId` | FK → `Admin` | yes | |

**Indexes / constraints**

- `CHECK (amountIdr > 0)`
- `CHECK (signedAmount = amountIdr OR signedAmount = -amountIdr)` (or enforce in service)
- `INDEX (reservationId, createdAt)`

**Rule:** `Reservation.paidAmountIdr = sum(signedAmount)` (never negative). Quote (`totalAmountIdr`) is **not** a movement.

**FE shape:** `{ id, reservationId, direction, kind, amountIdr, signedAmount, method, note, createdAt, createdByAdminId, createdByAdminUsername }`

**Attribution (Phase 1):** movement `createdByAdminId` + reservation `createdByAdminId` / `updatedByAdminId` (with denormalized usernames on staff wire). No full action-history table yet.

---

### 5.5 `CalendarBlock`

Non-guest occupancy (maintenance, owner, soft hold).

| Column | Type | Null | Notes |
|--------|------|------|--------|
| `id` | `cuid` PK | no | |
| `propertyId` | FK → `Property` | no | |
| `unitId` | FK → `Unit` | no | |
| `reason` | `CalendarBlockReason` | no | |
| `startDate` | `date` | no | inclusive |
| `endDate` | `date` | no | exclusive (same as reservation) |
| `notes` | `text` | yes | |
| `createdAt` | `timestamptz` | no | |
| `updatedAt` | `timestamptz` | no | |
| `createdByAdminId` | FK → `Admin` | yes | |

**Indexes / constraints**

- `CHECK (endDate > startDate)`
- `INDEX (unitId, startDate, endDate)`
- Overlap exclusion vs reservations + other blocks on same unit

**FE shape:** `{ id, unitId, reason, startDate, endDate, notes }`

---

## 6. JSON contracts (FE + BE shared)

### 6.1 `bedConfig`

Array of **rooms**. Each room has a name and **one or more** bed rows (e.g. 1 Queen + 1 Single in the same bedroom).

```json
[
  {
    "room": "Studio",
    "beds": [{ "type": "LARGE_DOUBLE", "count": 1 }]
  }
]
```

Two-bedroom example:

```json
[
  {
    "room": "Bedroom 1",
    "beds": [{ "type": "DOUBLE", "count": 1 }]
  },
  {
    "room": "Bedroom 2",
    "beds": [{ "type": "SINGLE", "count": 1 }]
  }
]
```

Multi-bed in one room:

```json
[
  {
    "room": "Bedroom 1",
    "beds": [
      { "type": "QUEEN", "count": 1 },
      { "type": "SINGLE", "count": 1 }
    ]
  }
]
```

`type` values = `BedKind` enum strings. FE renders rooms + bed rows; BE validates enum + `count >= 1` + at least one bed per room.

### 6.2 `amenities`

Grouped so FE can render Booking-style sections without parsing prose:

```json
{
  "highlights": [
    "PRIVATE_KITCHEN",
    "PRIVATE_BATHROOM",
    "BALCONY",
    "CITY_VIEW",
    "POOL_WITH_A_VIEW",
    "AIR_CONDITIONING",
    "FLAT_SCREEN_TV",
    "SOUNDPROOFING",
    "TERRACE",
    "FREE_WIFI"
  ],
  "kitchen": [
    "REFRIGERATOR",
    "KITCHENWARE",
    "ELECTRIC_KETTLE",
    "STOVETOP"
  ],
  "bathroom": ["SHOWER", "BIDET"],
  "view": ["BALCONY", "TERRACE", "CITY_VIEW"],
  "facilities": [
    "ELEVATOR_ACCESS",
    "FLAT_SCREEN_TV",
    "TOWELS",
    "WHEELCHAIR_ACCESSIBLE",
    "SEATING_AREA",
    "SOCKET_NEAR_BED",
    "LINEN",
    "TILE_MARBLE_FLOOR",
    "WARDROBE",
    "CLEANING_PRODUCTS",
    "SOUNDPROOFING",
    "AIR_CONDITIONING"
  ]
}
```

Use **stable SCREAMING_SNAKE codes** in DB; map to labels in FE / `api-contract`. Do not store free-text amenity soup as the only source of truth.

Empty groups allowed (`[]`). Unknown future codes: ignore on FE, do not fail reads.

### 6.3 `MediaItem` (`coverImage` / `media[]`)

```json
{
  "id": "m_studio_1",
  "kind": "IMAGE",
  "url": "https://…",
  "name": "Studio",
  "mimeType": "image/jpeg"
}
```

| Field | Notes |
|-------|--------|
| `kind` | `IMAGE` \| `VIDEO` |
| `url` | Object URL (mock) or storage URL (prod) |
| Array order on `UnitType.media` | Sortable; **first IMAGE** = explorer card thumbnail |
| `Property.coverImage` | Single item or `null` |

---

## 7. Seed reference (from PMS mock)

Aligned with [`mock-inventory.ts`](../apps/pms/src/pages/properties/mock-inventory.ts).

### 7.1 Properties

| code | name | city | addressLine (summary) | lat / lng | googlePlaceId |
|------|------|------|------------------------|-----------|---------------|
| `SKYBREEZE_SENTRALAND` | Skybreeze Sentraland | Medan | Jl. Nikel, Sukaramai II, Medan Area … 20224 | `3.5858139` / `98.7040167` | `ChIJDQnc_KkxMTAR4tzfa3cP0Yw` |
| `CABIN_LAKE_HOUSE` | Cabin Lake House | Berastagi | — | `3.1944` / `98.5089` | — |

Skybreeze check-in `15:00`–`23:30`, check-out until `12:00`, timezone `Asia/Jakarta`.

### 7.2 Unit types (Skybreeze + cabin)

| code | name | layout | sizeSqm | bedrooms | baths | maxGuests | defaultPriceIdr | beds (summary) |
|------|------|--------|---------|----------|-------|-----------|-----------------|----------------|
| `TWO_BR_STD` | Two-Bedroom Standard Apartment | `APARTMENT` | 36 | 2 | 1 | 3 | 650000 | Bedroom1 double · Bedroom2 single |
| `THREE_BR_STD` | Three-Bedroom Standard Apartment | `APARTMENT` | 54 | 3 | 1 | 3 | 850000 | double + 2× single |
| `DLX_KING_STUDIO` | Deluxe King Studio | `STUDIO` | 21 | 0 | 1 | 2 | 550000 | 1 large double |
| `DLX_QUEEN_STUDIO` | Deluxe Queen Studio | `STUDIO` | 18 | 0 | 1 | 2 | 450000 | 1 large double |
| `DLX_STUDIO` | Deluxe Studio | `STUDIO` | 18 | 0 | 1 | 2 | 400000 | 1 large double |
| `LAKE_CABIN` | Lake Cabin | `CABIN` | 42 | 1 | 1 | 2 | 750000 | 1 queen |

Studios use `bedroomCount = 0` and a single `Studio` room in `bedConfig`. Amenity presets match §6.2 (apartments may omit `POOL_WITH_A_VIEW` in highlights).

### 7.3 Units (mock sample)

| property | unitType | codes (status) |
|----------|----------|----------------|
| Skybreeze | `TWO_BR_STD` | `B-0801`, `B-0802` ACTIVE · `B-0803` MAINTENANCE |
| Skybreeze | `THREE_BR_STD` | `B-1201` |
| Skybreeze | `DLX_KING_STUDIO` | `DS-0501` |
| Skybreeze | `DLX_QUEEN_STUDIO` | `DQ-0701` |
| Skybreeze | `DLX_STUDIO` | `DS-0901` ACTIVE · `DS-0902` INACTIVE |
| Cabin Lake | `LAKE_CABIN` | `CABIN-01`, `CABIN-02` |

Booking “We have 3 left” = derived availability for that type on a night (`count units where free`), **not** a stored allotment field.

---

## 8. API orientation (clean for FE)

Suggested Nest modules: `properties`, `units` (types + units), later `reservations`.

| Method | Path | Notes |
|--------|------|--------|
| `GET/POST` | `/staff/properties` | |
| `GET/PATCH` | `/staff/properties/:id` | |
| `GET/POST` | `/staff/properties/:propertyId/unit-types` | |
| `GET/PATCH` | `/staff/unit-types/:id` | |
| `GET/POST` | `/staff/properties/:propertyId/units` | query: `unitTypeId`, `status` |
| `GET/PATCH` | `/staff/units/:id` | |
| `GET` | `/staff/properties/:propertyId/calendar` | units + reservations + blocks in range |

Public website browse/book (Phase 2) uses `/public/...` — not these staff paths.
| `GET/POST` | `/reservations` | |
| `GET/PATCH` | `/reservations/:id` | status transitions |
| `POST` | `/calendar-blocks` | |

Response envelope stays global `{ data, meta }`.  
List endpoints may include nested summaries (`unitType: { id, name, code }`) to avoid N+1 on FE.

---

## 9. Availability rules (reservation-ready)

```text
Unit is free for [checkIn, checkOut)
  iff property.isActive
  and unitType.isActive
  and unit.status = ACTIVE
  and no occupying Reservation overlaps the range
  and no CalendarBlock overlaps (when blocks ship)
```

Staff HTTP: `GET /staff/properties/:propertyId/units/availability?checkInDate&checkOutDate&unitTypeId?&excludeReservationId?`

Returns **all** matching units as `StaffUnitAvailability[]` (`StaffUnit` + `available` + `blockReason`). Blocked rows stay in the list for Choose unit UI; only `available: true` is selectable. Stay dates are **optional** — omit both to skip `DATE_OVERLAP` (catalog bookability only).

`blockReason` priority: `PROPERTY_INACTIVE` → `UNIT_TYPE_INACTIVE` → `UNIT_NOT_BOOKABLE` → `DATE_OVERLAP`.

Unit POV (date picker): `GET /staff/units/:unitId/occupancy?yearMonth=YYYY-MM&excludeReservationId?` → `UnitMonthOccupancy` (occupying `blocks` overlapping that month). PMS loads visible months (1–2), keeps prior months in the query cache as staff pages the calendar, and disables booked nights (exclusive checkout).

Type-level “how many left” for night D:

```text
count(units of type T that are free on D)
```

Staff may:

1. Book a **specific unit**, or  
2. Book by **type** then assign a free unit (assign still writes `Reservation.unitId` before confirm).

Phase 1 MVP can require choosing a unit up front; type-then-assign is a UX layer on the same tables.

---

## 10. Explicit non-goals (do not add to these tables)

| Temptation | Why not |
|------------|---------|
| `roomsLeft` / allotment int on `UnitType` | Lies the moment calendars move; derive it |
| Live OTA prices / multi-currency / rate plans | OTA prices stay manual until CM; rack rate is `defaultPriceIdr` only |
| Google Maps **share** URL as primary location key | Prefer `googlePlaceId` + own lat/lng |
| Guest master table required for Phase 1 | Snapshot columns on reservation enough for ops |
| Amenity entity + M2M for Phase 1 | `jsonb` codes are enough; normalize later if `web` filters need it |
| Scraped OTA HTML blobs | Forbidden; staff/seed enters structured fields |

---

## 11. Implementation order

1. Prisma models: `Property`, `UnitType`, `Unit` + enums (include location, `defaultPriceIdr`, media)  
2. Migrate + seed from §7 (Skybreeze + cabin lake)  
3. CRUD API + PMS screens (explorer mock already prototypes FE)  
4. `Reservation` + `CalendarBlock` + overlap enforcement  
5. Calendar read API for PMS  

---

## 12. Open inputs

- [x] Studio `bedroomCount = 0`  
- [x] `DLX_QUEEN_STUDIO` vs `DLX_STUDIO` stay two types  
- [x] Multi-property supported (Skybreeze + Cabin Lake in mock)  
- [ ] Expand unit codes/counts to full ops inventory when known  
- [ ] Cabin Lake `googlePlaceId` when available  

---

## 13. One-screen summary

```text
Property          place + address + lat/lng + googlePlaceId + cover
UnitType          shared product (beds, m², amenities, defaultPriceIdr, media)
Unit              physical apartment + calendar identity
Reservation       guest stay on a unit  [checkIn, checkOut)
CalendarBlock     non-guest busy on a unit

bedroomCount      derived from bedConfig (studio = 0)
bedConfig         rooms[]; each room may have multiple bed kinds
defaultPriceIdr   rack IDR / night → stay Total = nights × rack (reservations-design §6)
maps              lat/lng = our pins; Place ID = Open in Google Maps

N properties  → Property rows
types each    → UnitType rows under that property
N apartments  → Unit rows under each type
Bookings      → Reservation.unitId
```
