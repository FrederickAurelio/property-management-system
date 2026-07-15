---
name: api-domain
description: Guides Cabin PMS backend domain modeling, reservation sources, and Phase 1 API endpoints. Use when designing schemas, routes, or business rules in apps/api.
---

# API domain skill

## Core entities

- **property** — property / location
- **unit_type** — optional grouping
- **unit** — bookable cabin/apartment (one calendar)
- **reservation** / **block** — date ranges on a unit
- **staff user** — roles: admin, front_desk

## Reservation sources

`manual` | `website` | `booking_com` | `airbnb` | `agoda`

## Phase 1 endpoint groups

1. Auth / me / roles
2. Units CRUD
3. Reservations CRUD + availability by date range
4. Check-in / check-out transitions
5. Reports aggregates
6. Ingest: draft from email → notify → confirm
7. iCal: import URLs, pull, Sync now

## Invariants

- No overlapping confirmed stays on the same unit (reject or flag clearly)
- Draft (unconfirmed) from email ingest must be human-confirmed before it is ops truth
- Export/import iCal is dates/busy only — not guest payment truth
