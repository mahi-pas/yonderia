# Yonderia — Cursor Composer Prompts (In Order)

## Setup

Before starting, do two things in Cursor:

1. **Add SPEC.md as a Project Rule.** Go to Settings → Rules → Project Rules → Add Rule. Paste the entire contents of `yonderia-prompt.md`. Name the rule "Yonderia Spec". This makes the spec available to every Composer session without you having to reference it manually or burn context window tokens.

2. **Use Agent mode.** When you open Composer (Cmd+I), toggle "Agent" on at the top. This lets Cursor run terminal commands, install packages, and create files autonomously rather than just showing you diffs.

---

## Session 0: Project Bootstrap

```
Read the project spec in the rules. Initialize a new Next.js 16 project with TypeScript strict mode and Tailwind CSS. Use the App Router. Set up the full folder structure from the Application Architecture section of the spec — create all the directories and placeholder files (empty components that just export a div with the component name, so imports work).

Create:
- .env.local.example with all required env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, GOOGLE_CUSTOM_SEARCH_API_KEY, GOOGLE_CUSTOM_SEARCH_CX)
- src/lib/supabase/client.ts (browser Supabase client using @supabase/ssr)
- src/lib/supabase/server.ts (server-side Supabase client for API routes and server components)
- src/lib/types.ts with TypeScript interfaces for all DB tables: Profile, Trip, InviteCode, TripParticipant, ItineraryItem
- src/lib/utils.ts with date formatting helpers using date-fns and a generateInviteCode() function using nanoid (10 chars, URL-safe)
- package.json should include: @supabase/supabase-js, @supabase/ssr, nanoid, date-fns

Install all dependencies. Make sure the project compiles with no errors.
```

**After this:** Verify the project runs with `npm run dev`. Check that the folder structure matches the spec.

---

## Session 1: Database Migration

```
Read the Database Schema and Row-Level Security sections of the project spec. Create a complete Supabase migration file at supabase/migrations/001_initial_schema.sql.

Include:
1. All 5 tables (profiles, trips, invite_codes, trip_participants, itinerary_items) with exact columns, types, constraints, and foreign keys from the spec
2. All indexes from the Index Strategy section
3. The handle_new_user() trigger function that creates a profiles row when auth.users gets a new row
4. The is_trip_participant() and get_trip_role() helper functions with SECURITY DEFINER
5. RLS enabled on every table
6. All RLS policies exactly as described — pay close attention to: organizers can kick (DELETE) participants but not themselves, planners can create and read invite codes, the organizer cannot be kicked or leave

Double-check every policy. The most common mistake is forgetting to add the "organizer cannot be kicked" guard on the DELETE policy for trip_participants.
```

**After this:** Run this migration against your Supabase project. Verify all tables, policies, and functions exist in the Supabase dashboard.

---

## Session 1B: Testing Infrastructure

```
Set up the testing infrastructure for this project. We need three layers:

1. **pgTAP for RLS policy tests.** Create supabase/tests/001_rls_policies.sql using pgTAP. This is critical — RLS bugs are invisible from the frontend. The test should:

   - Create 3 test users via auth.users: user_a (will be organizer), user_b (will be planner), user_c (will be member)
   - Verify the handle_new_user trigger created profiles rows for all 3
   - As user_a: create a trip, verify they can read it
   - As user_b: verify they CANNOT read the trip (not a participant yet)
   - As user_a: add user_b as a participant with role='planner', add user_c with role='member'
   - As user_b: verify they CAN now read the trip but CANNOT update or delete it
   - As user_c: verify they CAN read the trip but CANNOT update or delete it

   Test trip_participants policies:
   - As user_b: verify they can update their OWN row (nickname, arrival) but NOT user_c's row
   - As user_c: verify they can update their own row
   - As user_a (organizer): verify they CAN update any participant's role
   - As user_a: verify they CAN delete user_c's row (kick)
   - As user_a: verify they CANNOT delete their own row (organizer can't leave)
   - As user_b: verify they CANNOT delete user_c's row (planner can't kick)

   Test invite_codes policies:
   - As user_a: create invite codes of all 3 types (join, join_planner, view), verify they can read all
   - As user_b (planner): verify they CAN create and read invite codes
   - As user_c (member): verify they CANNOT create invite codes and can only read codes they used

   Test itinerary_items policies:
   - As user_a: create an itinerary item, verify all participants can read it
   - As user_b (planner): verify they CAN create/update/delete itinerary items
   - As user_c (member): verify they CANNOT create/update/delete itinerary items

   Use SET LOCAL role and SET LOCAL request.jwt.claims to simulate different authenticated users.
   Use SELECT plan(), SELECT is(), SELECT ok(), and SELECT finish() from pgTAP.

2. **Vitest for API route tests.** Install vitest and create vitest.config.ts at the project root. Configure it for the Next.js App Router (use @vitejs/plugin-react if needed). Create a tests/ directory at the project root.

   Create tests/helpers/supabase-mock.ts — a helper that creates a mock Supabase client. It should let tests control:
   - What supabase.auth.getUser() returns (authenticated user, or null)
   - What database queries return (mock .from().select() chains)
   
   Create tests/helpers/setup.ts — shared test setup that initializes mocks and resets them between tests.

3. **Playwright for E2E tests.** Install @playwright/test. Create playwright.config.ts with:
   - baseURL pointing to localhost:3000
   - Mobile viewport as default (375x812) — we're mobile-first
   - A second project for desktop (1280x720)
   - Screenshot on failure
   - 30 second timeout

   Create e2e/helpers/auth.ts — a helper that creates authenticated browser contexts by:
   - Calling the Supabase admin API to create a test user (supabase.auth.admin.createUser)
   - Getting a session for that user (supabase.auth.admin.generateLink)
   - Setting the session cookies in the Playwright browser context
   This lets us test authenticated flows without going through Google OAuth.

   Create e2e/helpers/seed.ts — a helper that seeds test data:
   - createTestTrip(organizerId) — creates a trip and the organizer participant row
   - createTestInviteCode(tripId, codeType) — creates an invite code
   - addParticipant(tripId, userId, role) — adds a participant
   - createTestItineraryItem(tripId, type) — creates an itinerary item
   All using the Supabase service role client so they bypass RLS.

Add scripts to package.json:
- "test:db": "supabase test db"
- "test:unit": "vitest run"
- "test:e2e": "playwright test"
- "test": "npm run test:db && npm run test:unit && npm run test:e2e"
```

**After this:** Run `npm run test:db` and verify all RLS tests pass. Run `npx vitest run` and `npx playwright test` to make sure the test runners work (they'll have no tests yet, that's fine).

---

## Session 2: Auth + Middleware

```
Read the Auth Flow section of the project spec. Implement the complete authentication system:

1. src/middleware.ts — Next.js middleware that:
   - Refreshes the Supabase auth session on every request
   - Redirects unauthenticated users away from /dashboard and /profile/* to /
   - Does NOT redirect unauthenticated users away from /trip/[tripId] because view-only codes allow anonymous access
   - Preserves the full URL (including query params like ?code=) when redirecting to login

2. src/components/auth/AuthProvider.tsx — Context provider that wraps the app, provides the current user and session, listens for auth state changes

3. src/components/auth/LoginButton.tsx — "Sign in with Google" button that calls supabase.auth.signInWithOAuth({ provider: 'google' }). After sign-in, redirect to /dashboard (or to the stored redirect URL if the user came from an invite link)

4. src/components/auth/OnboardingModal.tsx — Modal that appears when has_completed_onboarding is false. Shows fields for display name and profile picture upload (to Supabase Storage avatars bucket). On save, updates the profiles row and sets has_completed_onboarding = true. Only shown once globally, not per trip.

5. src/app/layout.tsx — Root layout that wraps everything in AuthProvider

6. src/app/page.tsx — Home page with the Partiful-inspired design: full-screen hero, warm gradient background, Yonderia wordmark, tagline "Plan adventures with your people", and the LoginButton. If user is already logged in, redirect to /dashboard.

Follow the mobile-first design direction from the spec — distinctive display font, warm color palette, generous border-radius. Do NOT use Inter, Roboto, or system fonts. Load a Google Font that feels playful and warm.
```

**After this:** Test the full auth flow — sign in with Google, see the onboarding modal, set a profile pic, get redirected to /dashboard.

**Tests to write for this session:**

```
Write the following tests:

tests/api/auth.test.ts (Vitest):
- Middleware redirects unauthenticated user from /dashboard to /
- Middleware does NOT redirect unauthenticated user from /trip/[tripId] (view-only needs to work)
- Middleware preserves ?code= query params when redirecting to login
- OnboardingModal updates profile and sets has_completed_onboarding=true

e2e/auth.spec.ts (Playwright):
- Home page shows sign-in button when not authenticated
- After sign-in, user is redirected to /dashboard
- First-time user sees the onboarding modal
- After completing onboarding, the modal does not appear again on next visit
- Unauthenticated user visiting /dashboard is redirected to home page

Use the auth helpers from e2e/helpers/auth.ts to create test users without Google OAuth.
```

---

## Session 3: Dashboard + Create Trip

```
Read the Dashboard and Create/Edit Trip sections of the spec. Build:

1. src/app/dashboard/page.tsx — Server component that fetches all trips the current user participates in (via trip_participants JOIN trips). Renders a grid of TripCard components plus a "Create New Trip" card.

2. src/components/trip/TripCard.tsx — Card showing: trip header image (via next/image), trip name, dates formatted nicely, location, and a row of stacked participant avatars with a count. Links to /trip/{tripId}. Warm styling with soft shadows and generous border-radius per the design direction.

3. Create Trip flow — a full-screen modal (bottom sheet on mobile) with:
   - Trip name input
   - Image upload to Supabase Storage (trip-images bucket, path: {trip-id}/header.{ext}). Use the ImageUploader component. Validate: max 5MB, jpeg/png/webp only.
   - Date range picker for start and end dates
   - Location input with Google Places autocomplete that captures the location name, latitude, and longitude
   - Description textarea
   - On submit: create the trip row, then create a trip_participants row with role='organizer' for the current user, then redirect to /trip/{tripId}/participants?tab=invites so they can immediately generate invite links

4. src/components/ui/ImageUploader.tsx — Reusable image upload component. Shows a drop zone / file picker, previews the selected image, uploads to the specified Supabase Storage bucket and path, returns the public URL. Validates file type and size. Shows upload progress.

Mobile-first: the dashboard should be a single column of full-width cards on mobile, 2 columns on tablet, 3 on desktop. The create trip modal should be a full-screen bottom sheet on mobile.
```

**After this:** Create a trip, upload an image, verify it appears on the dashboard.

**Tests to write for this session:**

```
Write the following tests:

e2e/dashboard.spec.ts (Playwright):
- Dashboard shows "Create New Trip" card when user has no trips
- Dashboard shows trip cards for trips the user is participating in
- Trip card displays: image, name, dates, location, participant avatars
- Clicking a trip card navigates to /trip/{tripId}

e2e/create-trip.spec.ts (Playwright):
- Create trip modal opens when clicking "Create New Trip"
- All fields are present: name, image upload, date range, location, description
- Submitting with valid data creates the trip and redirects to /trip/{tripId}/participants?tab=invites
- The creating user is automatically added as organizer
- Submitting without required fields (name, dates) shows validation errors
- Image upload validates file type (rejects non-image) and size (rejects >5MB)
- On mobile (375px viewport): form renders as full-screen bottom sheet

Use e2e/helpers/seed.ts to create pre-existing trips for the dashboard display test.
```

---

## Session 4: Trip Page (Read-Only Layout)

```
Read the Trip Page section of the spec. Build the trip page layout at src/app/trip/[tripId]/page.tsx. For now, focus on the read-only display — no edit capabilities yet.

The page component should:
1. Check if the current user is a participant. If yes, render the full trip page.
2. If not a participant but URL has ?code= param, check the code type:
   - If code_type='view', render the read-only view (described below)
   - If code_type='join' or 'join_planner', redirect to the join flow
3. If neither participant nor valid code, show the invite code entry form

Full trip page layout (top to bottom):
1. TripHeader.tsx — Full-width hero image with trip name, dates, and location overlaid with a dark gradient for text readability. On mobile the image should be ~250px tall, on desktop ~400px.
2. Description section — Body text below the hero
3. ParticipantsRow.tsx — Horizontal scrollable row of participant avatars with nicknames below. Crown badge for organizer, star for planner. "+N" see-all button at the end. Clicking an avatar navigates to /profile/{userId} (use stopPropagation). Clicking the row background or see-all button navigates to /trip/{tripId}/participants.
4. Placeholder divs for Map and Itinerary (we'll build those in later sessions)

Read-only view (for view codes):
- Same layout but: participant avatars are NOT clickable to profiles, no edit button on hero, no "see all" on participants, and a banner at the top saying "You're viewing this trip as a guest. Have an invite code? Enter it to join!" with a link to /trip/{tripId}/join
- Data is fetched through /api/trip/[tripId]/view?code={code} API route

Build the API route: src/app/api/trip/[tripId]/view/route.ts
- Accepts GET with ?code= query param
- Validates the code exists, is active, code_type='view', and belongs to this trip
- Uses the Supabase service role key to bypass RLS
- Returns trip details, participants (names + avatars only, no arrival/departure), and itinerary items
- Returns 403 if code is invalid
```

**After this:** Visit a trip page as a participant. Then test the view-only flow by creating a view code (manually in Supabase for now) and visiting the URL unauthenticated.

**Tests to write for this session:**

```
Write the following tests:

tests/api/view-trip.test.ts (Vitest):
- GET /api/trip/[tripId]/view?code={valid_view_code} returns trip data
- GET /api/trip/[tripId]/view?code={invalid_code} returns 403
- GET /api/trip/[tripId]/view?code={revoked_code} returns 403
- GET /api/trip/[tripId]/view?code={join_code} returns 403 (join codes can't be used as view codes)
- Response does NOT include participant arrival/departure details
- Response includes participant names and avatars

e2e/trip-page.spec.ts (Playwright):
- Participant sees full trip page: hero, description, participants row, placeholder sections
- Participant sees edit button if they are the organizer
- Non-participant without code sees the invite code entry form
- Non-participant with valid view code sees the read-only page
- Read-only page shows the guest banner with link to join page
- Read-only page does NOT have clickable avatars
- Clicking an avatar (as participant) navigates to /profile/{userId}
- Clicking "See All" navigates to /trip/{tripId}/participants
- Avatar click and row click are distinct interactions (avatar doesn't trigger row navigation)

Use seed helpers to set up trips with participants and invite codes.
```

---

## Session 5: Join Flow

```
Read the Auth Flow section of the spec, specifically the invite link flow. Build the complete join system:

1. src/app/api/invite/validate/route.ts — POST endpoint that:
   - Accepts { code, tripId } in the body
   - Validates the user is authenticated (via supabase.auth.getUser())
   - Looks up the invite code — checks it exists, is_active=true, belongs to the given trip, and code_type is 'join' or 'join_planner' (NOT 'view')
   - Checks if user is already a participant (if so, return success with redirect)
   - Creates a trip_participants row. Role is 'planner' if code_type='join_planner' OR if trip.default_planner_permission is true. Otherwise 'member'.
   - Returns success with the trip ID for redirect

2. src/app/trip/[tripId]/join/page.tsx — The join page handles two scenarios:
   - If URL has ?code= param: automatically submit the code to /api/invite/validate. Show a loading state while validating. On success, show the NicknameModal then redirect to trip page. On error, show the manual code entry form with the error message.
   - If no ?code= param: show a clean form to enter an invite code manually. Same flow on submit.

3. src/components/trip/NicknameModal.tsx — Shown after successfully joining a trip. Full-screen on mobile, centered modal on desktop. Fields:
   - "What should people call you on this trip?" — text input for nickname (make it clear this is trip-specific)
   - "When are you arriving?" — date/time picker + text input for location (e.g. "JFK Airport")
   - "When are you leaving?" — date/time picker + text input for location
   - All fields optional. "Skip" and "Save" buttons. Updates the trip_participants row.

4. Update the middleware: when an unauthenticated user hits /trip/[tripId]?code={code} and the code is a 'join' or 'join_planner' type, redirect to Google OAuth with redirectTo set to /trip/[tripId]/join?code={code} so they return to the join flow after login.

Critical: a view-only code must NEVER trigger the join flow. The middleware and join page must both check code_type before proceeding. If someone passes a view code to the join endpoint, return an error.
```

**After this:** Test the full flow — generate a join code (manually in Supabase), open the link in an incognito window, sign in, get the nickname modal, see the trip.

**Tests to write for this session:**

```
Write the following tests:

tests/api/invite-validate.test.ts (Vitest):
- POST with valid join code adds user as member, returns success
- POST with valid join_planner code adds user as planner, returns success
- POST with view code returns 400 (view codes can't be used to join)
- POST with inactive code returns 403
- POST with code belonging to different trip returns 403
- POST when user is already a participant returns 200 with redirect (idempotent)
- POST without authentication returns 401
- User gets planner role when trip.default_planner_permission is true, even with a 'join' code

e2e/join-flow.spec.ts (Playwright):
- Visiting /trip/{tripId}?code={join_code} when not logged in → redirected to login → after login, returns to join page → auto-validates → shows nickname modal → redirects to trip page
- Visiting /trip/{tripId}?code={join_code} when logged in → auto-validates → nickname modal → trip page
- Visiting /trip/{tripId}/join with no code shows manual code entry form
- Entering a valid code manually works the same as the URL flow
- Entering an invalid code shows an error message
- Nickname modal fields are all optional — clicking "Skip" still completes the join
- Visiting /trip/{tripId}?code={view_code} when not logged in does NOT trigger the join flow (shows read-only page instead)

These tests are critical for security. The view-code-cannot-join test is especially important.
```

---

## Session 6: Participants Page

```
Read the Participants Page section of the spec. Build /trip/[tripId]/participants as a full dedicated page (NOT a modal).

1. src/app/trip/[tripId]/participants/page.tsx — Server component that fetches participants and invite codes for the trip. Checks the user's role to determine what they can see and do. Has two tabs: "People" and "Invites". Accepts ?tab=invites query param to open on the invites tab (used after trip creation).

2. Page header: trip name, back arrow that links to /trip/{tripId}. On mobile, full-width tappable tabs below the header.

3. "People" Tab (src/components/trip/ParticipantsView.tsx):
   - Vertical list sorted: organizer first, then planners alphabetically, then members alphabetically
   - Each row: avatar (clickable → /profile/{userId}), nickname in bold, global display_name in smaller text if different, role badge (crown/star), arrival/departure summary (e.g. "Arriving Fri 3pm at JFK")
   - Organizer sees: dropdown on each row (except their own) with "Make Planner", "Make Member", "Kick from Trip"
   - Kick flow: confirmation dialog → calls /api/participants/kick (DELETE the trip_participants row)
   - Role change: calls /api/participants/role (UPDATE the role column)
   - Planners and members: read-only list, no action menus

4. "Invites" Tab (src/components/trip/InviteManagement.tsx):
   - Only visible to organizers and planners. Hidden entirely for members.
   - "Generate New Invite" section with code type selector (three radio buttons or segmented control): "Join as Member", "Join as Planner", "View Only"
   - Generate button → creates invite_codes row → displays full link yonderia.com/{tripId}?code={code} → copy button with toast
   - Active invites list: each shows truncated code, colored badge by type ("Join"=green, "Planner"=blue, "View Only"=gray), created date, creator name, and "Revoke" button with confirmation
   - Revoked invites: collapsed section, grayed out

5. API routes:
   - src/app/api/participants/kick/route.ts — POST, organizer only, validates permissions server-side, deletes the participant row. Cannot delete the organizer.
   - src/app/api/participants/role/route.ts — POST, organizer only, validates permissions, updates role. Cannot change the organizer's role.

All tap targets minimum 44x44px. Mobile-first layout.
```

**After this:** Test all flows — view as organizer (full controls), as planner (read-only people, can create invites), as member (read-only, no invites tab). Test kick and role changes.

**Tests to write for this session:**

```
Write the following tests:

tests/api/participants-kick.test.ts (Vitest):
- Organizer can kick a member → participant row deleted, returns success
- Organizer can kick a planner → participant row deleted, returns success
- Organizer CANNOT kick themselves → returns 403
- Planner cannot kick anyone → returns 403
- Member cannot kick anyone → returns 403
- Non-participant cannot kick → returns 403

tests/api/participants-role.test.ts (Vitest):
- Organizer can change member to planner → returns success
- Organizer can change planner to member → returns success
- Organizer CANNOT change their own role → returns 403
- Planner cannot change anyone's role → returns 403
- Member cannot change anyone's role → returns 403

e2e/participants-page.spec.ts (Playwright):
- Page shows "People" tab with all participants sorted correctly (organizer first, then planners, then members)
- Organizer sees action menus on all participants except themselves
- Organizer can kick a participant: click kick → confirmation dialog → confirm → participant disappears
- Organizer can change a participant's role: click "Make Planner" → role badge updates
- Planner sees the participant list but no action menus
- Planner sees the "Invites" tab
- Member sees the participant list but no action menus and no "Invites" tab
- "Invites" tab: organizer can generate all three code types (join, join_planner, view)
- "Invites" tab: copy button works (copies link to clipboard)
- "Invites" tab: organizer can revoke a code (confirmation → code moves to revoked section)
- Back arrow navigates to /trip/{tripId}
- On mobile: tabs are full-width and tappable, action menus are usable
```

---

## Session 7: Itinerary System

```
Read the Daily Itinerary and Add Event Modal sections of the spec. Build the itinerary system:

1. src/components/trip/DayItinerary.tsx — For each day between trip start_date and end_date, render a collapsible section:
   - Header: "Day 1 — Sat, Mar 14" with a chevron icon. Day 1 expanded by default, others collapsed.
   - Smooth expand/collapse animation (use CSS transitions or framer-motion)
   - Inside: vertical list of ItineraryCard components sorted by start_time. Hotels without check-in time go to the end.
   - "Add Event" button at the bottom, visible only to organizers/planners. Passes the day's date to AddEventModal.

2. src/components/trip/ItineraryCard.tsx — Compact horizontal card:
   - Small thumbnail image on the left (64x64 on mobile, 80x80 on desktop)
   - Title, time (formatted nicely), and location name
   - Small icon/badge indicating type: calendar icon for events, bed icon for hotels, car/plane icon for commutes
   - Clicking the card expands it inline to show full details OR opens ItineraryDetail as a modal

3. src/components/trip/ItineraryDetail.tsx — Expanded view showing: full-size image, title, description, all times, location with a mini map pin, and for commutes both origin and destination. Bottom sheet on mobile, modal on desktop.

4. src/components/trip/AddEventModal.tsx — Full-screen on mobile, centered modal on desktop. Tab selector: "Event", "Hotel", "Commute". Form fields adjust per type:
   - Event: title, description, date (pre-filled), time, location (Google Places autocomplete)
   - Hotel: title, description, check-in time (optional), check-out time (optional), location
   - Commute: title, description, departure time, origin (Places autocomplete), destination (Places autocomplete)
   - Image: after the user enters a title, auto-fetch a suggestion from /api/images/search (Google Custom Search). Show preview with "Change image" to upload a custom one.
   - Save button creates the itinerary_items row

5. src/app/api/images/search/route.ts — GET endpoint, accepts ?q= query param, calls Google Custom Search JSON API with searchType=image, returns top 3 image URLs. Requires authentication (check session). API key stays server-side.

6. src/hooks/useItinerary.ts — Hook that fetches itinerary items for a trip, groups them by day_date, sorts within each day, and subscribes to Supabase Realtime for live updates.

7. Wire the DayItinerary sections into the trip page below the participants row.
```

**After this:** Add events, hotels, and commutes to a trip. Verify they appear sorted correctly, expand/collapse works, and the auto-image search works.

**Tests to write for this session:**

```
Write the following tests:

tests/api/images-search.test.ts (Vitest):
- GET /api/images/search?q=eiffel+tower returns image URLs
- GET /api/images/search without auth returns 401
- GET /api/images/search without ?q= returns 400

e2e/itinerary.spec.ts (Playwright):
- Day sections render for each day of the trip (correct count, correct date labels)
- Day 1 is expanded by default, other days are collapsed
- Clicking a day header toggles expand/collapse
- Organizer/planner sees "Add Event" button, member does not
- Add Event modal: switching between Event/Hotel/Commute tabs changes the visible form fields
- Creating an event: fill title, time, location → save → card appears in the correct day section
- Creating a hotel with no check-in time: card appears at the end of the day's list
- Creating a commute: card shows both origin and destination
- Itinerary cards are sorted by start_time within each day
- Clicking a card expands it to show full details (description, full image, all times)
- Auto-image search: entering a title triggers an image suggestion (mock the API response in the test)
- On mobile: Add Event modal renders as full-screen bottom sheet

Seed a trip with 3 days and several itinerary items of different types for the display tests.
```

---

## Session 8: Map

```
Read the Map section of the spec. Build the interactive trip map:

1. src/lib/google-maps.ts — Google Maps loader utility. Load the Maps JavaScript API with the Places library.

2. src/components/trip/TripMap.tsx — Google Map component that:
   - Shows pins for all itinerary items in the trip
   - Custom pin icons/colors by type: one color/icon for events, another for hotels, another for commutes
   - For commute items: show BOTH origin and destination pins connected by a polyline
   - Clicking a pin shows an InfoWindow with: small image, title, time, location, and a "View details" button that opens the ItineraryDetail modal/bottom sheet
   - Day filter: horizontal row of pill buttons above the map — "All", "Day 1", "Day 2", etc. Clicking a day pill filters the pins to only show items for that day. "All" shows everything. Active pill is highlighted.
   - Map automatically fits bounds to show all visible pins
   - On mobile: map is ~250px tall with a "Full screen" toggle button. On desktop: ~400px tall.
   - The full-screen map on mobile should be a true full-viewport overlay with a close button.

3. Wire the map into the trip page between the participants row and the daily itinerary sections.

4. Also wire the map into the view-only trip page (same component, same data, but no editing). View-only users should be able to interact with the map, click pins, and see the info windows.

5. For the view-only page, make sure the map data comes from the /api/trip/[tripId]/view endpoint — do NOT use direct Supabase client queries (those would fail without auth due to RLS).
```

**After this:** Verify pins appear for all itinerary items, day filtering works, info windows show correct data, and the map works on the view-only page.

**Tests to write for this session:**

```
Write the following tests:

e2e/map.spec.ts (Playwright):
- Map renders on the trip page with pins for all itinerary items
- Clicking a pin shows an info window with image, title, time, location
- Info window "View details" button opens the itinerary detail modal
- Day filter pills appear above the map ("All", "Day 1", "Day 2", ...)
- Clicking "Day 1" hides pins from other days
- Clicking "All" shows all pins again
- Commute items show two pins connected by a line
- Map on view-only page: pins render correctly, info windows work, no edit capabilities
- On mobile: map is ~250px height with a "Full screen" button
- Full screen toggle: map expands to full viewport, close button returns to normal

Note: Google Maps in Playwright requires some setup. If the Google Maps JS API is not available in the test environment, mock the map component with a simple div that renders pin data as data attributes, and test the filtering/info-window logic separately. The visual map behavior can be verified manually.
```

---

## Session 9: Profile Page

```
Read the Profile Page section of the spec. Build:

1. src/app/profile/[userId]/page.tsx — Server component that:
   - Fetches the profile (display_name, avatar_url) from the profiles table
   - Fetches trip count: SELECT COUNT(*) FROM trip_participants WHERE user_id = ?
   - If the viewer is looking at their own profile, show an "Edit Profile" button
   - If both users are authenticated, fetch shared trips (trips where both the viewer and the profile owner are participants). Show as a list of TripCards below the profile info.

2. Profile layout:
   - Large avatar (120px on mobile, 160px on desktop) centered at top
   - Display name below
   - Trip count: "12 trips" with a subtle icon
   - Edit button (own profile only) opens a form to update display_name and avatar_url
   - Shared trips section with header "Trips you share" — only shown if there are shared trips and the viewer is authenticated. Uses the same TripCard component from the dashboard.

3. Make sure avatar clicks throughout the app actually navigate to /profile/{userId}:
   - In ParticipantsRow on the trip page (with stopPropagation so it doesn't also navigate to participants page)
   - In ParticipantsView on the participants page
   - On the dashboard (if applicable)

Mobile-first layout. The profile should look good as a simple centered single-column layout on all screen sizes.
```

**After this:** Click on avatars throughout the app, verify profile pages load with correct data, test the edit flow on your own profile.

**Tests to write for this session:**

```
Write the following tests:

e2e/profile.spec.ts (Playwright):
- Profile page shows avatar, display name, and trip count
- Trip count is accurate (matches actual number of trip_participants rows)
- Viewing own profile shows "Edit Profile" button
- Viewing someone else's profile does NOT show "Edit Profile" button
- Edit profile: changing display name and avatar saves correctly
- Shared trips section shows trips where both viewer and profile owner participate
- Shared trips section is hidden for unauthenticated visitors
- Clicking avatar in participants row navigates to correct profile page
- Clicking avatar in participants page navigates to correct profile page
- Profile page works on mobile (single column, centered layout)

Seed two users who share 2 trips and have 1 trip each that's not shared, to verify the shared trips section and trip counts.
```

---

## Session 10: Edit Trip

```
Build the trip editing flow:

1. src/app/trip/[tripId]/edit/page.tsx — Only accessible to the trip organizer. If the current user is not the organizer, redirect to the trip page.

2. Same form as Create Trip but pre-filled with existing data:
   - Trip name, description, location (with Places autocomplete), date range, header image
   - Image shows current header image with an option to replace it
   - Save button updates the trips row
   - Cancel button returns to the trip page
   - On mobile this should be a full-screen page. On desktop it can be the same.

3. Add an edit button to the TripHeader component — small pencil icon overlaid on the hero image, only visible to the organizer. Links to /trip/{tripId}/edit.

4. Also add the ability for participants to edit their own trip-specific info — nickname, arrival/departure. Add an "Edit my info" button somewhere on the trip page (maybe in the participants row near their own avatar, or as a floating action). Opens the same NicknameModal from session 5, pre-filled with their current data. Updates the trip_participants row.
```

**After this:** Edit a trip's details, change the header image, edit your nickname and arrival info.

**Tests to write for this session:**

```
Write the following tests:

e2e/edit-trip.spec.ts (Playwright):
- Organizer can access /trip/{tripId}/edit
- Non-organizer visiting /trip/{tripId}/edit is redirected to the trip page
- Edit form is pre-filled with existing trip data
- Changing the trip name and saving updates the trip page hero
- Changing the header image uploads a new image and updates the hero
- Cancel button returns to the trip page without saving changes
- Edit button (pencil icon) on hero is only visible to organizer

e2e/edit-participant-info.spec.ts (Playwright):
- Participant can click "Edit my info" on the trip page
- NicknameModal opens pre-filled with their current nickname and arrival/departure info
- Saving updates their info (verify the participants row shows new nickname)
- Changes are reflected in the participants page as well
```

---

## Session 11: Real-Time Subscriptions

```
Read the Real-Time Features section of the spec. Add live updates:

1. src/hooks/useParticipants.ts — Hook that:
   - Fetches the initial participants list for a trip (with profile info via join)
   - Subscribes to Supabase Realtime on the trip_participants table filtered by trip_id
   - On INSERT: add new participant to the list
   - On UPDATE: update the participant's info (role change, nickname change)
   - On DELETE: remove participant from the list (they were kicked or left)
   - Cleans up subscription on unmount

2. Update src/hooks/useItinerary.ts to also subscribe to Realtime:
   - On INSERT: add new itinerary item to the correct day
   - On UPDATE: update the item
   - On DELETE: remove the item
   - Re-sort items when changes come in

3. Wire these hooks into the trip page so that:
   - When someone joins the trip, their avatar appears in the participants row without a refresh
   - When someone adds an event, it appears in the itinerary and on the map without a refresh
   - When an organizer kicks someone, they disappear from the participants list in real-time

4. Do NOT add real-time to the view-only page — it fetches via API route and doesn't have a persistent Supabase client connection. View-only visitors see a snapshot.
```

**After this:** Open the trip page in two browser windows. Add an event in one, verify it appears in the other. Kick a participant, verify they disappear.

**Tests to write for this session:**

```
Write the following tests:

e2e/realtime.spec.ts (Playwright):
- Two browser contexts viewing the same trip page. Context A (organizer) adds an event → event appears in Context B without refresh.
- Context A adds a new participant (via seed helper) → avatar appears in Context B's participants row.
- Context A kicks a participant → participant disappears from Context B's view.
- Context A changes a participant's role → badge updates in Context B's view.
- View-only visitors do NOT get real-time updates (their page is a snapshot). Verify: add an event while a view-only page is open → event does NOT appear without manual refresh.

These tests use two Playwright browser contexts in the same test. Context A makes changes, then the test waits for Context B's DOM to update (use page.waitForSelector or expect with polling).
Supabase Realtime requires the local Supabase instance to have realtime enabled — verify this is set up in supabase/config.toml.
```

---

## Session 12: Mobile Polish Pass

```
Do a thorough mobile-first polish pass across the entire app. Open every page at 375px viewport width and fix issues:

1. All tap targets must be at least 44x44px — check buttons, avatars, tab buttons, card click areas
2. Forms should have sticky submit buttons at the bottom of the viewport on mobile
3. The AddEventModal and ItineraryDetail should render as bottom sheets on mobile (slide up from bottom, dismissible by swiping down or tapping overlay), centered modals on desktop
4. Confirmation dialogs (kick participant, revoke invite) should also be bottom sheets on mobile
5. The participants row should have smooth horizontal momentum scrolling
6. The map should be ~250px on mobile with a full-screen toggle
7. Collapsible day headers should have large tap areas (the entire header row, not just the chevron)
8. Toast notifications should appear at the top on mobile (not bottom, to avoid keyboard/nav overlap)
9. The home page hero should work on small screens — make sure the tagline and sign-in button don't overflow
10. Image upload file inputs should include accept="image/*" and capture attribute for mobile camera access
11. Check that the Google Places autocomplete dropdown is usable on mobile (it can be finicky)
12. Navigation between pages should feel smooth — add loading states for page transitions

Test on actual mobile viewport. Don't just guess.
```

---

## Session 13: Final Review + Security Audit

```
Read the Security Checklist in the spec. Go through every item and verify:

1. RLS is enabled on every table (profiles, trips, invite_codes, trip_participants, itinerary_items). Check that there are no tables with RLS disabled.

2. Search the entire codebase for SUPABASE_SERVICE_ROLE_KEY. It should ONLY appear in:
   - .env.local.example
   - src/lib/supabase/server.ts (and only used in API routes)
   - src/app/api/trip/[tripId]/view/route.ts
   Nowhere else. Especially not in any client component or page component.

3. Every API route (validate invite, kick participant, change role, image search, view trip) must call supabase.auth.getUser() and return 401 if no session — EXCEPT the view-only endpoint which validates via the code param instead.

4. The view-only code path must be completely isolated from the participant path. Verify: a logged-in user with only a view code cannot access the participants page, cannot add events, cannot see arrival/departure info. Test this explicitly.

5. File uploads: verify that ImageUploader validates file type (jpeg/png/webp only) and size (max 5MB) on the client side before uploading.

6. Check that no Google API keys appear in any client-side code. They should only be in API routes and .env.local.

7. Check for any console.log statements that might leak sensitive data. Remove them.

8. Verify that the organizer cannot be kicked — test by trying to call the kick API route with the organizer's user ID.

If any issues are found, fix them.

After all fixes, run the complete test suite:
- npm run test:db (RLS policy tests)
- npm run test:unit (API route tests)
- npm run test:e2e (Playwright E2E tests)

All tests must pass. If any test fails due to the security fixes, update the test expectations if the old behavior was incorrect, or fix the implementation if the test was right.
```