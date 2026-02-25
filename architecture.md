# Architecture

## Overview

Dungeon Mapster is a web-based collaborative mapping tool for tabletop RPG dungeon masters and players. It supports
creating, editing, and sharing dungeon maps with grid overlay systems.

## User Roles

- **Owner** — full control over a map
- **DM (Dungeon Master)** — edit access
- **Player** — view/interact access
- Group sizes: 4–20 players per map

## Key Features

- Square and hexagonal grid tessellation with positioning controls
- Image upload up to 30MB stored in GCS
- Automatic saving with debounce timers
- Map sharing via join codes
- Demo mode — unauthenticated users can explore pre-made maps
- Role-based access control via `MapMembership` entities

## Serving Strategy

Spring Boot serves the Angular frontend as static resources (from `src/main/resources/static`). All API routes are
prefixed with `/api`. The frontend proxy (`proxy.conf.json`) forwards `/api` calls to the backend during local
development.

## Image Serving

- Images stored in GCS under `maps/` prefix; DB stores filename only
- Frontend fetches via `/api/upload/image/{filename}` using `HttpClient` (blob, JWT required)
- GCS access uses Application Default Credentials via `GcsConfig`
- UUID-based filenames are used instead of complex auth schemes for image access

## Authentication

- Google OAuth via Spring Security
- JWT tokens for API authentication
- Demo mode bypasses auth for read-only map access

## Grid Rendering

- Dual-canvas architecture
- Grid rendering is decoupled from user interactions for performance
- Only grid cells overlapping the map image are rendered (not an infinite grid)

## Database

- `MapMembership` entity manages role-based access per map per user
- Hibernate `ddl-auto=update` for development; Flyway with `validate` reserved for future production use