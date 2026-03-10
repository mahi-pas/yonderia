# One-Shot Prompt: Yonderia — Group Vacation Planning App

You are a senior full-stack engineer at a top-tier FAANG company. You write clean, secure, production-grade code with proper error handling, type safety, and separation of concerns. You follow the principle of least privilege, never trust client input, and validate on both client and server. Your code should pass a security audit.

Build the complete application described below. Think step by step before writing each file. For every architectural decision, choose the option that maximizes correctness, security, and maintainability.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19, Turbopack) hosted on Vercel
- **Database:** Supabase (PostgreSQL) with Row-Level Security (RLS) on every table
- **Auth:** Supabase Auth with Google OAuth (Gmail sign-in)
- **Storage:** Supabase Storage (S3-compatible blob storage) for images
- **Maps:** Google Maps JavaScript API with the Places library
- **Image Search:** Google Custom Search JSON API for auto-suggesting event images
- **Styling:** Tailwind CSS
- **Language:** TypeScript (strict mode, no `any` types)

---

## Database Schema

Use a fully normalized relational schema. Create a Supabase migration file. All tables get `created_at TIMESTAMPTZ DEFAULT now()`. Use UUIDs for all primary keys.

### `profiles`
Extends Supabase's `auth.users`. Created automatically via a database trigger on `auth.users` insert.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | References `auth.users(id)` ON DELETE CASCADE |
| email | TEXT NOT NULL | |
| display_name | TEXT | |
| avatar_url | TEXT | URL in Supabase Storage |
| has_completed_onboarding | BOOLEAN DEFAULT false | Tracks if they've set a profile pic |
| created_at | TIMESTAMPTZ | |

### `trips`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | Also used in the URL slug |
| name | TEXT NOT NULL | |
| description | TEXT | |
| image_url | TEXT | Header image in Supabase Storage |
| location_name | TEXT | Human-readable location |
| latitude | DOUBLE PRECISION | |
| longitude | DOUBLE PRECISION | |
| start_date | DATE NOT NULL | |
| end_date | DATE NOT NULL | |
| default_planner_permission | BOOLEAN DEFAULT false | If true, all new joiners get planner role |
| created_by | UUID FK → profiles(id) | |
| created_at | TIMESTAMPTZ | |

### `invite_codes`
Separate table so a trip can have multiple invite codes (revocable, trackable). Supports three code types: `join` (standard — adds user as participant), `join_planner` (adds user as planner), and `view` (read-only access without login or participant row).

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK → trips(id) ON DELETE CASCADE | |
| code | TEXT UNIQUE NOT NULL | Short random string (nanoid, 10 chars) |
| code_type | TEXT CHECK (code_type IN ('join', 'join_planner', 'view')) DEFAULT 'join' | `join` = adds as member, `join_planner` = adds as planner, `view` = read-only, no login required |
| is_active | BOOLEAN DEFAULT true | Can be revoked |
| created_by | UUID FK → profiles(id) | |
| created_at | TIMESTAMPTZ | |

### `trip_participants`
Join table. One row per user per trip. This is where per-trip nickname and arrival/departure info lives.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK → trips(id) ON DELETE CASCADE | |
| user_id | UUID FK → profiles(id) ON DELETE CASCADE | |
| nickname | TEXT | Per-trip display name |
| role | TEXT CHECK (role IN ('organizer', 'planner', 'member')) DEFAULT 'member' | |
| arrival_time | TIMESTAMPTZ | |
| departure_time | TIMESTAMPTZ | |
| arrival_location | TEXT | e.g. "JFK Airport" |
| departure_location | TEXT | e.g. "LAX Airport" |
| joined_at | TIMESTAMPTZ DEFAULT now() | |
| UNIQUE(trip_id, user_id) | | Enforces one membership per user per trip |

### `itinerary_items`
Polymorphic via `item_type`. Stores events, hotels, and commutes in one table to enable unified ordering and querying per day.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK → trips(id) ON DELETE CASCADE | |
| item_type | TEXT CHECK (item_type IN ('event', 'hotel', 'commute')) NOT NULL | |
| title | TEXT NOT NULL | |
| description | TEXT | |
| image_url | TEXT | Auto-fetched or user-overridden |
| day_date | DATE NOT NULL | Which day this belongs to |
| start_time | TIMESTAMPTZ | For events: event time. Hotels: check-in. Commutes: departure. |
| end_time | TIMESTAMPTZ | For hotels: check-out. Commutes: arrival time. |
| location_name | TEXT | |
| latitude | DOUBLE PRECISION | |
| longitude | DOUBLE PRECISION | |
| destination_name | TEXT | Commute only: where they end up |
| destination_latitude | DOUBLE PRECISION | Commute only |
| destination_longitude | DOUBLE PRECISION | Commute only |
| sort_order | INTEGER DEFAULT 0 | For manual ordering within a day |
| created_by | UUID FK → profiles(id) | |
| created_at | TIMESTAMPTZ | |

**Index strategy:**
```sql
CREATE INDEX idx_trip_participants_trip ON trip_participants(trip_id);
CREATE INDEX idx_trip_participants_user ON trip_participants(user_id);
CREATE INDEX idx_itinerary_items_trip_day ON itinerary_items(trip_id, day_date);
CREATE INDEX idx_invite_codes_code ON invite_codes(code);
CREATE INDEX idx_invite_codes_trip ON invite_codes(trip_id);
```

### Row-Level Security

Enable RLS on ALL tables. Policies:

- **profiles:** Users can read any profile. Users can update only their own.
- **trips:** Participants can read a trip. The creator can update/delete. **Additionally**, anyone (including unauthenticated users) can read a trip if they provide a valid, active `view`-type invite code for that trip. This is enforced via a server-side API route that validates the code and returns the trip data — NOT via a permissive RLS policy. The RLS policy stays restrictive; the API route uses the service role key to bypass RLS for this specific read.
- **trip_participants:** Participants of a trip can read all other participants. Users can update only their own row (nickname, arrival/departure). Organizers can update any participant's role. Organizers can DELETE any participant's row (kick). Users can delete their own row (leave trip). The organizer cannot be kicked or leave (must delete the trip instead). View-only visitors can read the participant list (served via the same server-side API route, not direct client access).
- **invite_codes:** The trip organizer can perform all operations (create, read, revoke, delete). Planners can create and read codes. Members can only read codes they personally used to join (not all codes).
- **itinerary_items:** Participants can read. Only organizer or planners can insert/update/delete. View-only visitors can read (served via server-side API route).

Create a helper function:
```sql
CREATE OR REPLACE FUNCTION is_trip_participant(trip_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_participants
    WHERE trip_id = trip_uuid AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_trip_role(trip_uuid UUID)
RETURNS TEXT AS $$
  SELECT role FROM trip_participants
    WHERE trip_id = trip_uuid AND user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
```

Use these in RLS policies to avoid redundant subqueries.

### Database trigger

Create a trigger that automatically creates a `profiles` row when a new user signs up via Supabase Auth:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## Application Architecture

```
src/
├── app/
│   ├── layout.tsx                  # Root layout with providers
│   ├── page.tsx                    # Landing/login page (yonderia.com)
│   ├── dashboard/
│   │   └── page.tsx                # User's trips list + create trip
│   ├── profile/
│   │   └── [userId]/
│   │       └── page.tsx            # Public profile page (name, avatar, trip count)
│   ├── trip/
│   │   └── [tripId]/
│   │       ├── page.tsx            # Main trip view
│   │       ├── participants/
│   │       │   └── page.tsx        # Participants + invite management (full page)
│   │       ├── join/
│   │       │   └── page.tsx        # Invite code entry / auto-join flow
│   │       └── edit/
│   │           └── page.tsx        # Edit trip details (creator only)
│   └── api/
│       ├── invite/
│       │   └── validate/route.ts   # Server-side invite code validation + join
│       ├── trip/
│       │   └── [tripId]/
│       │       └── view/route.ts   # View-only trip data endpoint (validates view code, bypasses RLS with service role)
│       ├── participants/
│       │   ├── kick/route.ts       # Server-side participant removal (organizer only)
│       │   └── role/route.ts       # Server-side role update (organizer only)
│       └── images/
│           └── search/route.ts     # Proxy for Google Image Search API (hide API key)
├── components/
│   ├── auth/
│   │   ├── AuthProvider.tsx
│   │   ├── LoginButton.tsx
│   │   └── OnboardingModal.tsx     # First-time profile pic setup
│   ├── trip/
│   │   ├── TripCard.tsx            # Card on dashboard
│   │   ├── TripHeader.tsx          # Hero image, name, dates, location
│   │   ├── ParticipantsRow.tsx     # Horizontal avatar row on trip page (clickable → navigates to participants page)
│   │   ├── ParticipantsView.tsx    # Full participants list with role management and kick
│   │   ├── InviteManagement.tsx    # Tab/section on participants page for creating/revoking invites
│   │   ├── TripMap.tsx             # Google Maps with itinerary pins
│   │   ├── DayItinerary.tsx        # Collapsible day section
│   │   ├── ItineraryCard.tsx       # Compact card (image, title, time, location)
│   │   ├── ItineraryDetail.tsx     # Expanded modal/popup with full info
│   │   ├── AddEventModal.tsx       # Form for new event/hotel/commute
│   │   └── NicknameModal.tsx       # Set per-trip nickname on join
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Modal.tsx
│       ├── ImageUploader.tsx       # Supabase Storage upload component
│       └── MapMarker.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # Browser client
│   │   ├── server.ts              # Server-side client (for API routes/server components)
│   │   └── proxy.ts                # Auth proxy helper
│   ├── google-maps.ts             # Maps loader + helpers
│   ├── image-search.ts            # Google Custom Search client
│   ├── types.ts                   # All TypeScript interfaces (mirroring DB schema)
│   └── utils.ts                   # Date formatting, nanoid for invite codes, etc.
├── hooks/
│   ├── useTrip.ts                 # Fetch + cache trip data
│   ├── useParticipants.ts         # Real-time participant list
│   └── useItinerary.ts            # Real-time itinerary items
└── proxy.ts                        # Next.js proxy for auth redirects
```

---

## Auth Flow (Critical — get this exactly right)

1. **Home page (`/`):** Marketing page with a "Sign in with Google" button using Supabase Auth.
2. **After sign-in:** Redirect to `/dashboard`. The Next.js proxy checks `supabase.auth.getUser()` and redirects unauthenticated users to `/`.
3. **Invite link flow:** User visits `yonderia.com/{trip-id}?code={invite-code}`. The behavior depends on the `code_type` of the invite code:

   **If `code_type` = `'view'` (view-only link):**
   - No login required. The trip page renders in a **read-only mode** for anyone with this link.
   - The page fetches trip data through a dedicated server-side API route (`/api/trip/[tripId]/view?code={code}`) that validates the code and returns trip details, participants, and itinerary items using the service role key to bypass RLS.
   - The view-only page shows: hero header, description, participant list (avatars + nicknames, but not clickable to profiles), map with pins, and the daily itinerary (read-only, no "add event" buttons).
   - Show a banner at the top: "You're viewing this trip as a guest. Have an invite code? Enter it to join!" with a button that navigates to the invite code entry form (`/trip/{tripId}/join`). Do NOT show a "Sign in" button on the view-only page — signing in alone grants zero additional access to the trip. The view-only page continues to use the view code for all data fetching regardless of whether the user happens to be logged in. A logged-in user viewing a trip via a view code sees the exact same read-only page as an anonymous visitor. The only way to become a participant is to use a separate `join` or `join_planner` invite code through the standard join flow.
   - View-only visitors cannot: see the participants page, access invite management, add events, or see arrival/departure details of participants.

   **If `code_type` = `'join'` or `'join_planner'` (join link):**
   - If not logged in → redirect to Google OAuth. Store the full URL (with trip ID and code) in the `redirectTo` param so they return to it after login.
   - If logged in and URL has `?code=` → validate the code server-side via `/api/invite/validate`. Check that the code exists, is active, and belongs to this trip. If valid, add user to `trip_participants`. **Role assignment:** if `code_type` is `'join_planner'`, set the participant's role to `'planner'`. If the trip's `default_planner_permission` is true, also set to `'planner'`. Otherwise, set to `'member'`. Then redirect to the trip page.
   - If logged in but visiting `yonderia.com/{trip-id}` with NO `?code=` param, and the user is NOT already a participant → show a clean "Enter invite code" form. The form submits to the same `/api/invite/validate` endpoint.
   - If already a participant → skip all join logic, render the trip page directly.

4. **First-time onboarding:** After first-ever Google sign-in, if `has_completed_onboarding` is false, show a modal asking the user to set a display name and profile picture. This only happens once globally — not per trip. The profile picture is shared across all trips. Mark `has_completed_onboarding = true` after they save.
5. **Per-trip nickname + arrival/departure:** After joining a trip (either via invite link or manual code entry), show a modal prompting the user to:
   - Set a nickname for this trip. UI copy should say something like "What should people call you on this trip?" to make it clear this is trip-specific and fun.
   - Set arrival date/time and arrival location (e.g. "Flying into LAX at 3pm Friday").
   - Set departure date/time and departure location.
   - All fields are optional and can be edited later from the participants section.

---

## UI/UX Specification

### Design Direction

**Mobile-first. This is non-negotiable.** Most users will open invite links on their phones. Design every screen for a 375px viewport first, then scale up to tablet and desktop. Use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`) to layer on desktop enhancements — never the other way around.

The UI should be inspired by **Partiful**: warm, playful, slightly maximalist with personality. Key principles:
- Bold, expressive typography — use a distinctive display font (e.g. a rounded geometric or retro serif) for trip names and headings, paired with a clean sans-serif for body text. Do NOT use Inter, Roboto, or system fonts.
- Warm color palette — think sunset tones, terracotta, warm pinks, muted golds. Not corporate blue/purple.
- Generous border-radius on cards, soft shadows, and subtle background textures or gradients.
- Micro-interactions: hover effects on cards (desktop), smooth expand/collapse animations on itinerary days.
- The vibe is "your fun friend planned this trip, not a project manager."

**Mobile-specific UX rules:**
- All tap targets must be at least 44x44px.
- The participants row must be horizontally scrollable with momentum scrolling (`overflow-x: auto` with `-webkit-overflow-scrolling: touch`).
- The map must be a reasonable height on mobile (~250px) and expand on desktop. Include a "full screen" toggle.
- Collapsible itinerary day sections must have large, easy-to-tap headers.
- Forms (create trip, add event, nickname) must be full-screen on mobile with sticky submit buttons at the bottom.
- The Participants Page tabs ("People" / "Invites") should be full-width, bottom-aligned tab bar on mobile.
- All modals (add event, confirmation dialogs) should be bottom sheets on mobile, centered modals on desktop.
- Navigation back from the Participants Page and Profile Page should use a clear back arrow, not rely on browser back.
- Image uploads must work with the device camera (accept `capture` attribute on mobile file inputs).
- Toast notifications should appear at the top of the viewport on mobile so they don't overlap keyboard or bottom nav.

### Home Page (`/`)
- Full-screen hero with a warm gradient or textured background.
- Yonderia logo/wordmark prominently displayed.
- "Sign in with Google" button, styled warmly (not a plain white button).
- Brief tagline like "Plan adventures with your people."

### Dashboard (`/dashboard`)
- Grid of trip cards showing: header image, trip name, dates, location, participant count (with stacked avatar circles).
- "Create New Trip" card with a `+` icon, visually distinct.
- Each card links to `/trip/{tripId}`.

### Create/Edit Trip
- Modal or dedicated page with fields: name, image upload (to Supabase Storage), date range picker, location (with Google Places autocomplete for lat/lng), description.
- The creator is automatically added as a participant with role `organizer`.
- After creation, show the invite link generator prominently.

### Invite Link Generator
- Invite generation lives INSIDE the Participants Page (see below), not as a standalone section.
- When the organizer creates a trip, immediately after creation redirect them to the Participants Page (`/trip/{tripId}/participants`) open to the "Invites" tab so they can generate and share their first link.

### Profile Page (`/profile/{userId}`)
- Accessible by clicking any participant's avatar anywhere in the app.
- Shows: large avatar, display name (global, not trip nickname), and total number of trips they've participated in.
- Trip count is derived via `SELECT COUNT(*) FROM trip_participants WHERE user_id = ?`. Do NOT denormalize this — it's a simple query on an indexed column.
- If the viewer is looking at their own profile, show an "Edit Profile" button that lets them update their display name and avatar.
- Below the profile info, optionally show a list of trips they share in common with the viewer (trips where both users are participants). This is a nice social touch.

### Trip Page (`/trip/{tripId}`)

**Layout (top to bottom):**

1. **Hero Header:** Full-width trip image with the trip name, dates, and location overlaid. If the user is the organizer, show a subtle edit button.

2. **Description:** Below the hero, the trip description in body text.

3. **Participants Section:** Horizontal scrollable row showing participant avatars with nicknames below (truncate if many). Show a small role badge (crown for organizer, star for planner). At the end of the row, show a circular "See All" button with a count (e.g. "+12"). **Clicking anywhere on the participants row navigates to the Participants Page (`/trip/{tripId}/participants`).** Clicking an individual avatar navigates to their profile page (`/profile/{userId}`). These two interactions must be distinct — avatar click goes to profile, clicking the row background or "See All" navigates to the participants page.

### Participants Page (`/trip/{tripId}/participants`)

This is a **dedicated full page**, not a modal. It has a back button/link to return to the trip page, and uses **two tabs**: "People" and "Invites".

The page should have a clean header with the trip name and a back arrow. On mobile, the tabs should be full-width and easily tappable.

**"People" Tab:**
- Clean vertical list of all participants. Each row shows: avatar (clickable → profile page), nickname (with global display name in smaller text if different), role badge, and arrival/departure info summary.
- **Role management (organizer only):** Each participant row has a dropdown or action menu. Options: "Make Planner", "Make Member", "Kick from Trip". Kicking shows a confirmation dialog ("Remove {name} from this trip? They'll need a new invite to rejoin."). Deletes their `trip_participants` row. The organizer's own row has no kick/role options.
- **Role management (planner):** Planners can see the list but cannot change roles or kick people.
- **Members:** Can only view the list.
- Participants are sorted: organizer first, then planners, then members, alphabetical within each group.

**"Invites" Tab (organizer and planners only):**
- **Generate New Invite** button at the top. When clicked, shows options:
  - **Code type selector** with three options:
    - "Join as Member" (`code_type: 'join'`) — default. Recipient must log in and becomes a member.
    - "Join as Planner" (`code_type: 'join_planner'`) — recipient must log in and becomes a planner.
    - "View Only" (`code_type: 'view'`) — recipient can see the trip without logging in. They are NOT added as a participant. Good for sharing trip plans with people who aren't coming but want to see the itinerary (family, coworkers, etc.).
  - Generate button creates a new `invite_codes` row and displays the full link: `yonderia.com/{trip-id}?code={invite-code}`
  - Copy button with animation/toast.
- **Active Invites:** List of all active invite codes. Each shows: the code (truncated), code type as a colored badge ("Join" / "Join + Planner" / "View Only"), when it was created, who created it, and a "Revoke" button. Revoking sets `is_active = false`. Show a confirmation dialog.
- **Revoked Invites:** Collapsed section showing previously revoked codes (grayed out, no actions).
- Members see neither tab — the "Invites" tab is completely hidden for non-organizer/non-planner roles.

4. **Map:** Embedded Google Map showing pins for all itinerary items. Each pin should have a small label or custom icon indicating type (event/hotel/commute). Clicking a pin shows an info window with the item's image, title, time, and a "View details" link. Include a day filter (horizontal pill buttons: "All", "Day 1", "Day 2", ...) that filters map pins. For commutes, show both origin and destination pins connected by a line.

5. **Daily Itinerary:** For each day between `start_date` and `end_date`, render a collapsible section:
   - **Section header:** "Day 1 — Sat, Mar 14" with a chevron to expand/collapse. Default: Day 1 expanded, others collapsed.
   - **Inside:** Vertical list of `ItineraryCard` components sorted by `start_time` (with hotels without check-in time sorted to the end).
   - **ItineraryCard (compact):** Horizontal card with a small thumbnail image on the left, then title, time, and location. A small icon/badge indicates type (event/hotel/commute). Clicking expands inline or opens a modal with full details (description, full image, map location, all times).
   - **Add Event button:** Visible only to organizers/planners. Opens `AddEventModal`.

### Add Event Modal

- Tab selector at top: "Event", "Hotel", "Commute" — form fields adjust based on selection.
- **Event fields:** Title, description, date (pre-filled to the selected day), time, location (Google Places autocomplete).
- **Hotel fields:** Title, description, check-in time (optional), check-out time (optional), location.
- **Commute fields:** Title, description, departure time, origin location, destination location.
- **Image:** Auto-fetch a suggestion from Google Custom Search API based on the title + location. Show a preview with an "Override" button to upload a custom image. The API call should go through a Next.js API route (`/api/images/search`) to keep the API key server-side.
- Save button creates the `itinerary_item` row.

### Profile Picture Upload
- Use Supabase Storage. Upload to a bucket called `avatars` with the path `{user-id}/avatar.{ext}`.
- Generate a public URL and store it in `profiles.avatar_url`.
- Trip header images go to a bucket called `trip-images` at `{trip-id}/header.{ext}`.
- Itinerary item images go to `itinerary-images/{item-id}.{ext}`.
- All uploads should be validated: max 5MB, image types only (jpeg, png, webp).

---

## Real-Time Features

Use Supabase Realtime subscriptions so the trip page updates live:
- Subscribe to `trip_participants` changes for the trip → update participant list.
- Subscribe to `itinerary_items` changes for the trip → update itinerary and map pins.

---

## Security Checklist

- [ ] RLS enabled on every table with restrictive policies.
- [ ] All Supabase client calls use the anon key; service role key is NEVER exposed to the client.
- [ ] The service role key is ONLY used in server-side API routes — specifically `/api/trip/[tripId]/view` for view-only access. This route validates the view code before returning any data and strips sensitive fields (arrival/departure details, profile links).
- [ ] API routes validate the user session via `supabase.auth.getUser()` before any mutation.
- [ ] Invite codes are validated server-side only.
- [ ] View-only codes are validated per-request — the code must be passed as a query param on every API call, not stored in a session. This means sharing the view URL is equivalent to sharing access, and revoking the code immediately cuts off access.
- [ ] A view-only code NEVER escalates to participant access, even if the user signs in. Auth state and view-code access are completely independent paths. The trip page component must check: (1) is the user a participant? → render full trip page, (2) is there a valid view code in the URL? → render read-only view, (3) neither? → show invite code entry form. These checks are ordered so that a logged-in user with a view code does NOT get participant access.
- [ ] File uploads are validated for type and size both client-side and via Supabase Storage policies.
- [ ] Google API keys are only used in server-side API routes.
- [ ] No raw SQL in client code — use Supabase client methods.
- [ ] Input sanitization on all user-provided text (trip names, descriptions, nicknames).
- [ ] CSRF protection via Supabase Auth's built-in token handling.

---

## Implementation Notes

- **Next.js 16 specifics:** Use the App Router with React 19. Leverage React Server Components for initial data loading. Use Turbopack for development (`next dev --turbopack`). All dynamic code executes at request time by default in Next.js 16 — only use `"use cache"` directive where you explicitly want caching. Use View Transitions API (React 19.2) for smooth page-to-page animations, especially when navigating between the trip page and the participants page.
- Use Supabase's `@supabase/ssr` package for server-side auth in the App Router.
- For Google Maps, use `@vis.gl/react-google-maps` or load the JS API manually. Ensure the API key is restricted to your domain.
- Generate invite codes using `nanoid` (10 characters, URL-safe alphabet).
- For date ranges, use a library like `date-fns` for formatting and day iteration.
- Handle loading and error states for every async operation. Show skeleton loaders, not blank screens.
- **Mobile-first is the primary design target.** Write all base styles for mobile, then use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) to add desktop layouts. Test every page at 375px width. The trip page, participants page, and profile page must all work beautifully on phones.
- Use `next/image` for all images with appropriate `sizes` attribute for responsive loading.
- Ensure the Participants Page and Profile Page work as proper pages with their own URLs — they should be shareable, bookmarkable, and support browser back/forward navigation correctly.

---

## What to Deliver

1. The complete Supabase migration SQL file(s).
2. All source files listed in the architecture above, fully implemented.
3. A `.env.local.example` file listing all required environment variables.
4. A `README.md` with setup instructions.

Build the entire application. Do not leave placeholder comments or TODO stubs — implement everything fully.