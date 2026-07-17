# Inventory & reservation tables (prod design)

**Status:** locked design for Prisma / API / PMS — implement next.  
**Scope:** multi-property inventory + reservation-ready unit calendars.  
**Product context:** [`.docs/cabin-pms-client-plan.md`](../.docs/cabin-pms-client-plan.md)

---

## 1. Goal

Model real apartments the way ops and OTAs work:

- Many **properties**
- Each property has several **unit types** (shared specs: size, beds, amenities)
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
| `Property` | Place / site | Property switcher, settings | Scope all inventory |
| `UnitType` | Kind of apartment (×5 at Skybreeze) | Type list, filters, type detail | Shared specs; allotment counts |
| `Unit` | Bookable physical apartment | Unit list, calendar rows | Availability, iCal, ops |
| `Reservation` | Confirmed stay on a unit | Calendar, arrivals, detail | Overlap, reports, check-in |
| `CalendarBlock` | Non-guest hold (maintenance, owner use) | Calendar busy slots | Overlap with stays |

Out of Phase 1 inventory tables: OTA rate plans, live prices, amenity master catalog, allotment-only inventory.

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

ReservationSource
  MANUAL
  WEBSITE
  BOOKING_COM
  AIRBNB
  AGODA

ReservationStatus
  DRAFT          # quick-confirm / ingest — not on calendar yet (optional Phase 1.x)
  CONFIRMED
  CHECKED_IN
  CHECKED_OUT
  CANCELLED
  NO_SHOW

CalendarBlockReason
  MAINTENANCE
  OWNER
  HOLD
  OTHER
```

Wire these via `@cabin/api-contract` when FE + API both need them.

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
| `addressLine` | `varchar(255)` | yes | |
| `city` | `varchar(128)` | yes | |
| `countryCode` | `char(2)` | yes | `ID` |
| `isActive` | `boolean` | no | default `true` |
| `createdAt` | `timestamptz` | no | |
| `updatedAt` | `timestamptz` | no | |

**Indexes / constraints**

- `UNIQUE (code)`
- `INDEX (isActive)`

**FE shape (list):** `{ id, code, name, city, isActive }`  
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
| `bedroomCount` | `int` | no | Studio → `0` (or `1` sleeping space — pick one and keep consistent; **recommend `0` for studio**) |
| `bathroomCount` | `int` | no | default `1` |
| `maxGuests` | `int` | no | Hard cap for booking validation |
| `bedConfig` | `jsonb` | no | See §6 |
| `amenities` | `jsonb` | no | See §6 — grouped lists for FE |
| `description` | `text` | yes | Optional marketing / notes |
| `smokingAllowed` | `boolean` | no | default `false` |
| `sortOrder` | `int` | no | default `0` — FE type list order |
| `isActive` | `boolean` | no | default `true` |
| `createdAt` | `timestamptz` | no | |
| `updatedAt` | `timestamptz` | no | |

**Indexes / constraints**

- `UNIQUE (propertyId, code)`
- `INDEX (propertyId, isActive)`
- `INDEX (propertyId, sortOrder)`

**FE shape (list):**  
`{ id, propertyId, code, name, layout, sizeSqm, maxGuests, bedroomCount, bathroomCount, isActive, unitCount? }`  
(`unitCount` = aggregate from API, not a stored column.)

**FE shape (detail):** list fields + `bedConfig` + `amenities` + `description` + `smokingAllowed`.

**Do not store:** OTA prices, “rooms left”, refundable flags, currency.

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
| `status` | `UnitStatus` | no | default `ACTIVE` |
| `notes` | `text` | yes | Internal only (access, quirks) |
| `sortOrder` | `int` | no | default `0` |
| `isActive` | `boolean` | no | default `true` — soft hide from booking |
| `createdAt` | `timestamptz` | no | |
| `updatedAt` | `timestamptz` | no | |

**Indexes / constraints**

- `UNIQUE (propertyId, code)`
- `INDEX (propertyId, status, isActive)`
- `INDEX (unitTypeId, isActive)`
- `INDEX (propertyId, unitTypeId)`

**FE shape (list / calendar row):**  
`{ id, propertyId, unitTypeId, code, name, floor, status, isActive, unitType: { id, name, code, maxGuests } }`

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
| `guestCount` | `int` | no | Must be `<= UnitType.maxGuests` at confirm |
| `notes` | `text` | yes | Staff / special requests |
| `externalRef` | `varchar(128)` | yes | OTA booking id when known |
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
- `CHECK (guestCount >= 1)`
- `INDEX (unitId, checkInDate, checkOutDate)`
- `INDEX (propertyId, checkInDate)` — arrivals board
- `INDEX (propertyId, checkOutDate)` — departures board
- `INDEX (propertyId, status)`
- `INDEX (source)`
- `UNIQUE (source, externalRef)` where `externalRef IS NOT NULL` — avoid duplicate OTA imports

**Overlap (locked — Postgres)**

For statuses that occupy the calendar (`CONFIRMED`, `CHECKED_IN`; optionally `DRAFT` if you show holds):

- No two occupying reservations on the **same `unitId`** with overlapping `[checkInDate, checkOutDate)`.
- Prefer Postgres **exclusion constraint** with `daterange` + `gist` (or transactional conflict check in Phase 1 if exclusion ships slightly later — product rule: never UI-only).

Same overlap rule applies vs `CalendarBlock` on that unit.

**FE shape (calendar event):**  
`{ id, unitId, checkInDate, checkOutDate, status, source, guestName, guestCount }`

**FE shape (detail):** full row + nested `unit` + `unitType` summary.

**Not on this table (yet):** line-item pricing, payments, multi-unit group bookings. Add later without changing the unit FK model.

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

`type` values = `BedKind` enum strings. FE renders rooms; BE validates enum + `count >= 1`.

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

---

## 7. Skybreeze Sentraland — seed reference (UnitType)

Property (example):

| Field | Value |
|-------|--------|
| code | `SKYBREEZE_SENTRALAND` |
| name | Skybreeze Sentraland |
| timezone | `Asia/Jakarta` |
| checkInFrom / Until | `15:00` / `23:30` |
| checkOutUntil | `12:00` |
| city | Medan |
| countryCode | `ID` |

Unit types from Booking availability paste:

| code | name | layout | sizeSqm | bedrooms | maxGuests | beds (summary) |
|------|------|--------|---------|----------|-----------|----------------|
| `TWO_BR_STD` | Two-Bedroom Standard Apartment | `APARTMENT` | 36 | 2 | 3 | double + single |
| `THREE_BR_STD` | Three-Bedroom Standard Apartment | `APARTMENT` | 54 | 3 | 3 | double + 2× single |
| `DLX_KING_STUDIO` | Deluxe King Studio | `STUDIO` | 21 | 0 | 2 | 1 large double |
| `DLX_QUEEN_STUDIO` | Deluxe Queen Studio | `STUDIO` | 18 | 0 | 2 | 1 large double |
| `DLX_STUDIO` | Deluxe Studio | `STUDIO` | 18 | 0 | 2 | 1 large double |

**Deluxe Studio detail** (from conversation) maps into `amenities` + `smokingAllowed: false` + `bedConfig` as in §6.

**Units:** codes and counts per type are **TBD** (ops list). Schema does not need counts as columns — create N `Unit` rows when known.

Booking “We have 3 left” = derived availability for that type on a night (`count units where free`), **not** a stored allotment field.

---

## 8. API orientation (clean for FE)

Suggested Nest modules: `properties`, `units` (types + units), later `reservations`.

| Method | Path | Notes |
|--------|------|--------|
| `GET/POST` | `/properties` | |
| `GET/PATCH` | `/properties/:id` | |
| `GET/POST` | `/properties/:propertyId/unit-types` | |
| `GET/PATCH` | `/unit-types/:id` | |
| `GET/POST` | `/properties/:propertyId/units` | query: `unitTypeId`, `status` |
| `GET/PATCH` | `/units/:id` | |
| `GET` | `/properties/:propertyId/calendar` | units + reservations + blocks in range |
| `GET/POST` | `/reservations` | |
| `GET/PATCH` | `/reservations/:id` | status transitions |
| `POST` | `/calendar-blocks` | |

Response envelope stays global `{ data, meta }`.  
List endpoints may include nested summaries (`unitType: { id, name, code }`) to avoid N+1 on FE.

---

## 9. Availability rules (reservation-ready)

```text
Unit is free on night D
  iff no occupying Reservation covers D
  and no CalendarBlock covers D
  and unit.status = ACTIVE and unit.isActive = true
```

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
| Price / currency on `Unit` or `UnitType` | OTA prices manual until CM; separate later |
| Guest master table required for Phase 1 | Snapshot columns on reservation enough for ops |
| Amenity entity + M2M for Phase 1 | `jsonb` codes are enough; normalize later if `web` filters need it |
| Scraped OTA HTML blobs | Forbidden; staff/seed enters structured fields |

---

## 11. Implementation order

1. Prisma models: `Property`, `UnitType`, `Unit` + enums  
2. Migrate + seed property + 5 Skybreeze types (units when codes known)  
3. CRUD API + PMS screens  
4. `Reservation` + `CalendarBlock` + overlap enforcement  
5. Calendar read API for PMS  

---

## 12. Open inputs (before seed units)

- [ ] Exact unit codes + count per type (ops list)  
- [ ] Confirm `DLX_QUEEN_STUDIO` vs `DLX_STUDIO` stay two types (Booking lists both)  
- [ ] Confirm studio `bedroomCount = 0`  
- [ ] Multi-property now vs single property first (schema already supports many)

---

## 13. One-screen summary

```text
Property          place
UnitType          shared apartment product (beds, m², amenities)
Unit              physical apartment + calendar identity
Reservation       guest stay on a unit  [checkIn, checkOut)
CalendarBlock     non-guest busy on a unit

3 properties → 3 Property rows
5 types each → UnitType rows under that property
N apartments  → Unit rows under each type
Bookings      → Reservation.unitId
```
