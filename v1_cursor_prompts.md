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

---

# V2 Feature Prompts

The sessions below add new features on top of the V1 foundation. Many can be worked on in parallel — see the **Parallelization Guide** at the bottom for which sessions can run simultaneously.

---

## Session 14: End Times for Events & Commutes

```
The itinerary_items table already has an end_time column, but the UI doesn't use it for events or commutes. Fix that:

1. Update src/components/trip/AddEventModal.tsx:
   - **Event tab**: Add an "End Time" date/time picker below the existing start time field. Make it optional. If set, validate that end_time is after start_time. Show a friendly error if not.
   - **Commute tab**: Add an "Arrival Time" date/time picker below the existing departure time. Label it clearly — "Departure Time" for start_time and "Arrival Time" for end_time. Make it optional. If set, validate arrival is after departure.
   - **Hotel tab**: No changes needed — hotels already have check-in (start_time) and check-out (end_time).

2. Update src/components/trip/ItineraryCard.tsx:
   - When end_time exists, display the time as a range: "2:00 PM – 5:00 PM" instead of just "2:00 PM".
   - For commutes: show "Departs 2:00 PM → Arrives 5:00 PM" format.
   - Use a dash (–) for events and an arrow (→) for commutes to visually distinguish them.

3. Update src/components/trip/ItineraryDetail.tsx:
   - Show end_time in the detail view. For events: "2:00 PM – 5:00 PM". For commutes: separate "Departure: 2:00 PM" and "Arrival: 5:00 PM" lines.
   - If end_time is null, just show the start time like before.

4. Update src/hooks/useItinerary.ts:
   - When sorting items within a day, the sort logic should be: primary sort by start_time ascending, secondary sort by end_time ascending (items that end sooner appear first if they start at the same time). Hotels without check-in time still go at the end.

5. Update the /api/trip/[tripId]/view endpoint to include end_time in its response so view-only users also see time ranges.

No database migration needed — the column already exists.
```

**After this:** Create events and commutes with end times. Verify time ranges display correctly in cards and detail views. Verify sorting works when two events start at the same time.

**Tests to write for this session:**

```
Write the following tests:

tests/components/itinerary-card-endtime.test.tsx (Vitest):
- Event with end_time displays "2:00 PM – 5:00 PM" format
- Event without end_time displays just "2:00 PM"
- Commute with end_time displays "Departs 2:00 PM → Arrives 5:00 PM"
- Commute without end_time displays just the departure time

e2e/end-times.spec.ts (Playwright):
- Add Event modal has an "End Time" field on the Event tab
- Add Event modal has an "Arrival Time" field on the Commute tab
- Setting end_time before start_time shows a validation error
- Creating an event with end_time shows the time range on the itinerary card
- Creating a commute with arrival time shows the departure→arrival format
- Itinerary detail view shows end time when present
- Two events starting at the same time are sorted by end_time (shorter event first)
- View-only page shows end times correctly

Seed a trip with events that have and don't have end times for display tests.
```

---

## Session 15: RSVP System (Going / Interested / Not Going)

```
Add an RSVP system so participants can indicate their attendance for each event. This helps organizers get headcounts.

1. Database migration — create supabase/migrations/002_event_rsvps.sql:

   CREATE TABLE event_rsvps (
     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     itinerary_item_id uuid REFERENCES itinerary_items(id) ON DELETE CASCADE NOT NULL,
     user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
     status text NOT NULL CHECK (status IN ('going', 'interested', 'not_going')),
     created_at timestamptz DEFAULT now(),
     updated_at timestamptz DEFAULT now(),
     UNIQUE(itinerary_item_id, user_id)
   );

   CREATE INDEX idx_event_rsvps_item ON event_rsvps(itinerary_item_id);
   CREATE INDEX idx_event_rsvps_user ON event_rsvps(user_id);

   RLS policies:
   - SELECT: any trip participant can read RSVPs for items in their trip (join through itinerary_items → trip_participants)
   - INSERT: any trip participant can create their own RSVP (user_id must match auth.uid())
   - UPDATE: users can only update their own RSVP (user_id = auth.uid())
   - DELETE: users can only delete their own RSVP

   Add event_rsvps to the supabase_realtime publication.

2. Update src/lib/types.ts:
   - Add EventRsvp interface: { id, itinerary_item_id, user_id, status, created_at, updated_at }
   - Add RsvpStatus type: 'going' | 'interested' | 'not_going'
   - Add RsvpSummary type: { going: number, interested: number, not_going: number, userStatus: RsvpStatus | null }

3. Create src/hooks/useEventRsvps.ts:
   - Accepts an itinerary_item_id
   - Fetches all RSVPs for that item
   - Computes counts: { going, interested, not_going }
   - Determines the current user's RSVP status (or null if they haven't responded)
   - Provides a setRsvp(status) function that upserts the RSVP row
   - Subscribes to Supabase Realtime on event_rsvps filtered by itinerary_item_id for live count updates
   - Cleans up subscription on unmount

4. Create src/components/trip/RsvpButtons.tsx:
   - Three buttons in a row: "Going" (check icon), "Interested" (star icon), "Not Going" (X icon)
   - The currently selected status button is highlighted with a distinct color (Going=green, Interested=amber, Not Going=muted)
   - Clicking the same button again deselects it (deletes the RSVP)
   - Below the buttons, show counts: "12 going · 5 interested"
   - Don't show "not going" count prominently — just show it on hover/tap as a tooltip
   - Optimistic UI: update the button state immediately, revert on error
   - Only show for itinerary items where item_type = 'event' (not hotels or commutes)

5. Wire RsvpButtons into ItineraryCard.tsx:
   - Show a compact version on the card itself: just a small "✓ 12" going count badge
   - Full RSVP buttons appear in the expanded ItineraryDetail view

6. Create src/components/trip/RsvpList.tsx:
   - Shows who's going/interested/not going as avatar rows grouped by status
   - Accessible from the ItineraryDetail view via a "See who's going" link
   - Opens as a bottom sheet on mobile, modal on desktop

7. Update the /api/trip/[tripId]/view endpoint to include RSVP counts (but NOT individual RSVPs — view-only users just see aggregate counts, not who specifically).
```

**After this:** RSVP to events, verify counts update in real-time across browser tabs, verify the RSVP list shows correct groupings.

**Tests to write for this session:**

```
Write the following tests:

supabase/tests/002_rsvp_policies.sql (pgTAP):
- Participant can create their own RSVP
- Participant CANNOT create an RSVP with someone else's user_id
- Participant can read all RSVPs for items in their trip
- Participant can update only their own RSVP
- Participant can delete only their own RSVP
- Non-participant cannot read RSVPs for items in trips they're not in
- RSVP is deleted when the itinerary item is deleted (CASCADE)
- RSVP is deleted when the user is removed from the trip (test: kick user → their RSVPs are cleaned up)

tests/hooks/use-event-rsvps.test.ts (Vitest):
- Hook returns correct counts for going/interested/not_going
- Hook returns current user's status
- setRsvp('going') creates/updates the RSVP row
- Calling setRsvp with the same status deletes the RSVP (toggle off)
- Hook handles the case where user has no RSVP (status = null)

e2e/rsvp.spec.ts (Playwright):
- Event card shows a going count badge
- Opening event detail shows the three RSVP buttons
- Clicking "Going" highlights the button and increments the count
- Clicking "Going" again deselects it and decrements the count
- Switching from "Going" to "Interested" updates both counts
- "See who's going" link opens the RSVP list with correct groupings
- RSVP buttons do NOT appear for hotel or commute items
- Real-time: User A RSVPs in one tab → count updates in User B's tab without refresh
- View-only page shows aggregate RSVP counts but no RSVP buttons

Seed a trip with events and multiple participants who have RSVPs for the display tests.
```

---

## Session 16: Event Comments with GIF Support

```
Add a comments section to events so participants can discuss details. Include a GIF picker powered by the Tenor API.

1. Database migration — create supabase/migrations/003_event_comments.sql:

   CREATE TABLE event_comments (
     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     itinerary_item_id uuid REFERENCES itinerary_items(id) ON DELETE CASCADE NOT NULL,
     user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
     content text,
     gif_url text,
     created_at timestamptz DEFAULT now(),
     updated_at timestamptz DEFAULT now(),
     CHECK (content IS NOT NULL OR gif_url IS NOT NULL)
   );

   CREATE INDEX idx_event_comments_item ON event_comments(itinerary_item_id);
   CREATE INDEX idx_event_comments_created ON event_comments(created_at);

   RLS policies:
   - SELECT: any trip participant can read comments on items in their trip
   - INSERT: any trip participant can create comments (user_id must match auth.uid())
   - UPDATE: users can only update their own comments (user_id = auth.uid())
   - DELETE: users can delete their own comments. Organizers can delete any comment in their trip.

   Add event_comments to the supabase_realtime publication.

2. Set up Tenor GIF API:
   - Add TENOR_API_KEY to .env.local.example
   - Create src/app/api/gifs/search/route.ts — GET endpoint:
     - Accepts ?q= search term and optional ?pos= for pagination
     - Calls Tenor API v2: https://tenor.googleapis.com/v2/search?q={q}&key={key}&limit=20&media_filter=gif,tinygif&pos={pos}
     - Returns array of { id, url (tinygif for preview), fullUrl (gif for display), width, height }
     - Requires authentication (check session)
   - Create src/app/api/gifs/trending/route.ts — GET endpoint for trending GIFs (shown by default before user types a search)

3. Create src/components/ui/GifPicker.tsx:
   - Search input at the top with debounced search (300ms)
   - Grid of GIF thumbnails (use tinygif format for fast loading) in a masonry or 2-column layout
   - Infinite scroll pagination using the Tenor "next" cursor
   - Before searching, show trending GIFs
   - Clicking a GIF selects it, shows a preview with "Send" and "Cancel" buttons
   - Powered by Tenor attribution badge at the bottom (required by Tenor ToS)
   - Smooth loading states with skeleton placeholders

4. Create src/components/trip/EventComments.tsx:
   - Comment list sorted by created_at ascending (oldest first, like a chat)
   - Each comment shows: user avatar (small, 32px), user nickname (for this trip), timestamp, and either text content or a GIF (rendered as an img with max-width constraints)
   - Comments that have both text and a GIF show text above the GIF
   - Users can delete their own comments (small trash icon on hover/long-press). Organizers see the trash icon on all comments.
   - Input area at the bottom: text input with a GIF button (opens GifPicker as a popover on desktop, bottom sheet on mobile) and a send button
   - Pressing Enter sends the comment (Shift+Enter for newline)
   - Maximum comment length: 500 characters
   - Show "No comments yet — start the conversation!" when empty

5. Create src/hooks/useEventComments.ts:
   - Fetches comments for an itinerary item (with user profile info via join)
   - Subscribe to Supabase Realtime for live comment updates
   - Provides addComment(content, gifUrl), deleteComment(commentId) functions
   - Optimistic UI: new comments appear immediately, revert on error

6. Wire EventComments into ItineraryDetail.tsx:
   - Show below the event details in the detail/modal view
   - Show a comment count on the ItineraryCard ("💬 3" badge next to the RSVP count)
   - Only show for participants (NOT on view-only pages)

7. Update src/lib/types.ts with EventComment interface.
```

**After this:** Comment on events, send GIFs, verify comments appear in real-time, verify organizers can delete any comment, test the GIF search and pagination.

**Tests to write for this session:**

```
Write the following tests:

supabase/tests/003_comment_policies.sql (pgTAP):
- Participant can create a comment on an event in their trip
- Participant CANNOT create a comment on an event in a trip they're not in
- Participant can read all comments on events in their trip
- Participant can delete their own comments
- Participant CANNOT delete other people's comments
- Organizer CAN delete any comment in their trip
- Planner CANNOT delete other people's comments (only organizer can)
- Comment is deleted when the itinerary item is deleted (CASCADE)
- Comment requires at least content OR gif_url (CHECK constraint)

tests/api/gifs-search.test.ts (Vitest):
- GET /api/gifs/search?q=happy returns GIF results
- GET /api/gifs/search without auth returns 401
- GET /api/gifs/search without ?q= returns 400
- GET /api/gifs/trending returns trending GIFs

tests/hooks/use-event-comments.test.ts (Vitest):
- Hook returns comments sorted by created_at ascending
- addComment creates a new comment and updates the list
- deleteComment removes the comment from the list
- Hook joins user profile info (avatar, nickname) with each comment

e2e/comments.spec.ts (Playwright):
- Event detail shows the comments section
- User can type and send a text comment
- Comment appears in the list with avatar, name, and timestamp
- User can open the GIF picker, search for a GIF, and send it
- GIF renders correctly in the comment list
- User can delete their own comment (trash icon → confirmation → removed)
- Organizer can delete any comment
- Member cannot delete other people's comments
- Pressing Enter sends the comment
- Pressing Shift+Enter creates a newline instead of sending
- Comment count badge shows on the itinerary card
- Real-time: User A comments → comment appears in User B's view without refresh
- Comments section is NOT shown on the view-only page
- Max character validation: typing 501 characters shows an error or disables send

Seed a trip with events and some pre-existing comments (text and GIF) for display tests.
```

---

## Session 17: Invite Landing Experience

```
Currently, when an unauthenticated user opens an invite link, they just see a generic login screen. Redesign this to show a warm, inviting landing page with trip information before asking them to sign in.

1. Create src/app/api/invite/preview/route.ts — GET endpoint:
   - Accepts ?code= query param
   - Validates the code exists and is active
   - Uses the service role client to bypass RLS
   - Returns LIMITED trip info: trip name, trip image_url, start_date, end_date, location_name, and the organizer's display_name and avatar_url
   - Does NOT return: participant list, itinerary, description, or any sensitive details
   - Returns the code_type so the frontend knows if this is a join or view code
   - Returns 404 if code is invalid or inactive

2. Create src/app/trip/[tripId]/invite-landing/page.tsx — The new invite landing page:
   - This page is shown to unauthenticated users who visit a trip link with a join/join_planner code
   - Layout (mobile-first):
     - Trip header image as a large background/hero (with dark gradient overlay)
     - "You're invited!" headline in a warm display font
     - Trip name in large text
     - Trip dates formatted nicely (e.g., "Mar 14 – 18, 2026")
     - Location name
     - "Hosted by [organizer name]" with their avatar
     - A prominent "Sign in with Google to join" button (same style as LoginButton but larger and more inviting)
     - Below the button: subtle text "You'll be able to see the full itinerary, RSVP to events, and coordinate with the group."
   - If code_type='view': change the headline to "You've been shared a trip!" and the button to "Sign in with Google to view" with different subtitle text: "Sign in to explore the full itinerary and map."
   - If the code is invalid: show a friendly "This invite link is no longer valid" message with a link to the home page
   - The page should feel celebratory and warm — consider subtle background animations (floating confetti particles, gentle gradient animation)

3. Update src/proxy.ts (middleware):
   - When an unauthenticated user visits /trip/[tripId]?code={code} with a join or join_planner code, redirect to /trip/[tripId]/invite-landing?code={code} instead of directly to the login page
   - This gives them the chance to see what they're being invited to before signing in
   - After they click "Sign in with Google", the OAuth redirectTo should point to /trip/[tripId]/join?code={code} so the normal join flow picks up after authentication

4. Make sure the existing flow still works for authenticated users — if a logged-in user visits a trip link with a join code, skip the landing page and go straight to the join flow.
```

**After this:** Open an invite link in an incognito window. Verify you see the invite landing page with trip info. Sign in and verify the join flow completes normally.

**Tests to write for this session:**

```
Write the following tests:

tests/api/invite-preview.test.ts (Vitest):
- GET /api/invite/preview?code={valid_join_code} returns trip name, image, dates, location, organizer info
- GET /api/invite/preview?code={valid_view_code} returns trip info with code_type='view'
- GET /api/invite/preview?code={invalid_code} returns 404
- GET /api/invite/preview?code={revoked_code} returns 404
- Response does NOT include participant list, itinerary, or description
- Response includes organizer's display_name and avatar_url

e2e/invite-landing.spec.ts (Playwright):
- Unauthenticated user with join code sees the invite landing page (NOT the login page)
- Landing page shows: "You're invited!", trip name, dates, location, organizer name
- Landing page shows the trip header image
- "Sign in with Google to join" button is present and prominent
- Clicking sign-in redirects to Google OAuth, then back to the join flow
- Unauthenticated user with view code sees "You've been shared a trip!" variant
- Invalid code shows "This invite link is no longer valid" message
- Authenticated user with join code skips the landing page and goes straight to join flow
- On mobile (375px): layout is single column, image fills width, text is readable
- Page loads fast even with a large trip image (image is properly optimized)

Use seed helpers to create trips with invite codes. Use Playwright's unauthenticated context for the landing page tests.
```

---

## Session 18: User Info & Name Management

```
Improve the ability for users to edit their trip-specific info (nickname, arrival, departure) and allow organizers to change anyone's nickname.

1. Enhance the "Edit my info" button (src/components/trip/EditMyInfoButton.tsx):
   - Make it more visible on the trip page — instead of a small button, show it as a card/banner near the top of the page (below the participants row) that says "Set your travel details" if arrival/departure are empty, or "Update your info" if they're already set.
   - Show a summary of what they've set: "Arriving Fri 3pm at JFK · Leaving Sun 2pm from JFK"
   - Tapping the card opens the NicknameModal (pre-filled with current data)

2. Improve the NicknameModal (src/components/trip/NicknameModal.tsx):
   - Current fields: nickname, arrival time, arrival location, departure time, departure location
   - Improve the date/time picker UX: use a combined date+time input or a calendar picker, not just raw datetime-local inputs
   - Add helpful placeholders: arrival location → "e.g., JFK Airport, Airbnb address"
   - Add validation: departure must be after arrival
   - The modal should be a bottom sheet on mobile, centered modal on desktop
   - Add a "Clear" button next to each field to reset it

3. Allow the organizer to change anyone's nickname:
   - On the participants page (ParticipantsView.tsx), add an "Edit Name" option to the organizer's action dropdown for each participant
   - Clicking "Edit Name" opens a small inline editor or modal with just a nickname text input
   - Create src/app/api/participants/nickname/route.ts — POST endpoint:
     - Accepts { tripId, participantId, nickname }
     - Validates the current user is the organizer of the trip
     - Updates the trip_participants row's nickname field
     - Returns success
   - Show a toast confirmation: "Updated [old nickname] to [new nickname]"

4. Update the RLS policies if needed:
   - The organizer should be able to UPDATE the nickname field on any participant's row
   - Check the existing UPDATE policy on trip_participants — it may only allow users to update their own row. If so, add a new policy: "Organizers can update any participant's nickname"
   - Be careful not to let organizers change other fields (like arrival/departure) that belong to the participant — scope the policy or handle this in the API route logic

5. Wire the real-time hook: when the organizer changes someone's nickname, it should update immediately for everyone viewing the trip.
```

**After this:** Edit your own nickname and arrival/departure. As the organizer, change another participant's nickname from the participants page. Verify changes appear in real-time.

**Tests to write for this session:**

```
Write the following tests:

tests/api/participants-nickname.test.ts (Vitest):
- Organizer can change any participant's nickname → returns success
- Organizer cannot change their own nickname via this endpoint (they use the normal edit flow)
- Planner cannot change anyone's nickname → returns 403
- Member cannot change anyone's nickname → returns 403
- Non-participant cannot change nicknames → returns 403
- Empty nickname is rejected → returns 400

e2e/edit-user-info.spec.ts (Playwright):
- "Set your travel details" banner appears when arrival/departure are empty
- Tapping the banner opens the NicknameModal
- NicknameModal fields are pre-filled with current data
- Saving nickname updates the participant's display in the participants row
- Saving arrival/departure shows the summary in the trip info banner
- Departure before arrival shows a validation error
- "Clear" button resets a field to empty
- Organizer sees "Edit Name" option in participant action dropdown
- Organizer clicks "Edit Name" → edits nickname → saves → nickname updates in the list
- Non-organizer does NOT see "Edit Name" option
- Real-time: organizer changes nickname → updated immediately in other user's view
```

---

## Session 19: Expanded Kick Permissions for Planners

```
Currently only organizers can kick people from a trip. Allow planners to also kick members (but not other planners or the organizer).

1. Update the RLS DELETE policy on trip_participants:
   - Current policy: only the organizer can delete other participants (and cannot delete themselves)
   - New policy: organizers can delete any non-organizer participant. Planners can delete members only (cannot delete other planners or the organizer). Members cannot delete anyone.
   - Create a new migration: supabase/migrations/004_planner_kick.sql
   - Drop the old DELETE policy and create the new one:
     - Organizer can DELETE where target role != 'organizer'
     - Planner can DELETE where target role = 'member'
     - The organizer still CANNOT delete themselves

2. Update src/app/api/participants/kick/route.ts:
   - Currently checks if the user is the organizer. Update to also allow planners.
   - Add role-based validation:
     - If requester is organizer: can kick anyone except themselves
     - If requester is planner: can kick members only. If they try to kick another planner or the organizer, return 403 with a descriptive error message.
     - If requester is member: return 403
   - Keep the "cannot kick the organizer" guard

3. Update src/components/trip/ParticipantsView.tsx:
   - Currently only shows the action dropdown (with "Kick from Trip") for the organizer
   - Now also show it for planners, but with restrictions:
     - Planners see "Kick from Trip" only on member rows (not on other planners or the organizer)
     - Planners do NOT see "Make Planner" / "Make Member" role change options (that's still organizer-only)
   - Organizers still see the full action dropdown on everyone except themselves

4. Update the confirmation dialog for kicks:
   - When a planner kicks a member, the dialog should say: "Remove [name] from this trip? They'll lose access to the itinerary and all trip details."
   - Same message for organizer kicks

5. Update the pgTAP RLS tests to cover the new policies.
```

**After this:** Log in as a planner and verify you can kick members but not other planners. Log in as a member and verify you cannot kick anyone. Verify the organizer can still kick everyone except themselves.

**Tests to write for this session:**

```
Write the following tests:

supabase/tests/004_planner_kick_policies.sql (pgTAP):
- Organizer can DELETE a member's participant row
- Organizer can DELETE a planner's participant row
- Organizer CANNOT DELETE their own participant row
- Planner can DELETE a member's participant row
- Planner CANNOT DELETE another planner's participant row
- Planner CANNOT DELETE the organizer's participant row
- Member CANNOT DELETE any participant row

tests/api/participants-kick-v2.test.ts (Vitest):
- Organizer kicks member → success
- Organizer kicks planner → success
- Organizer kicks self → 403
- Planner kicks member → success
- Planner kicks another planner → 403 with descriptive error
- Planner kicks organizer → 403 with descriptive error
- Member kicks anyone → 403

e2e/planner-kick.spec.ts (Playwright):
- Planner sees "Kick from Trip" option on member rows
- Planner does NOT see "Kick from Trip" on other planner rows
- Planner does NOT see "Kick from Trip" on the organizer row
- Planner does NOT see role change options (Make Planner / Make Member)
- Planner clicks "Kick" on a member → confirmation → member is removed
- Organizer still sees full action dropdown on all non-self participants
- Member sees no action dropdown at all
```

---

## Session 20: Partiful-Inspired Theme Overhaul

```
Redesign the entire app's visual identity to feel more sleek, bold, and fun — inspired by Partiful's aesthetic. This is a global theming change that affects every page.

1. Update src/app/globals.css with a new color palette:
   - Move away from the current warm/muted earthy tones
   - New direction: dark, rich backgrounds with vibrant accent colors
   - Primary background: deep charcoal/near-black (#0a0a0f or similar dark shade)
   - Card/surface background: slightly lighter dark (#14141f) with subtle transparency/glassmorphism
   - Accent color: vibrant gradient — electric purple to hot pink (#8b5cf6 → #ec4899) or similar eye-catching combo
   - Text: crisp white (#fafafa) for primary, muted gray (#a1a1aa) for secondary
   - Success/Going: bright green (#22c55e)
   - Warning: amber (#f59e0b)
   - Define all colors as CSS custom properties for easy per-trip theming later (Session 21)

2. Update fonts:
   - Replace the current display/body fonts with something more modern and sleek
   - Display font: something bold and distinctive — try "Space Grotesk", "Clash Display", "Satoshi", or "Cabinet Grotesk" (check Google Fonts availability). The font should feel tech-forward but still playful.
   - Body font: clean geometric sans — "DM Sans", "Plus Jakarta Sans", or "General Sans"
   - Update next/font/google imports in src/app/layout.tsx
   - Ensure font variables are set on :root and used via Tailwind theme config

3. Update component styling across the app:
   - **Cards** (TripCard, ItineraryCard): dark surface with subtle border (1px border with low-opacity white or accent color), rounded-2xl, hover effect with slight glow/border-color change. Consider a subtle glassmorphism effect (backdrop-blur + semi-transparent background).
   - **Buttons**: primary buttons use the accent gradient, with a hover glow effect. Secondary buttons are outlined with the accent color. Smooth transitions on hover.
   - **Inputs/textareas**: dark background (#1a1a2e), lighter border, focus ring uses the accent gradient color
   - **Modals/bottom sheets**: dark background with blur backdrop. Subtle top border glow.
   - **Badges** (role badges, RSVP counts, type badges): pill-shaped with accent-colored backgrounds at low opacity, bright text
   - **Avatar rings**: thin accent-colored ring around avatars. Organizer: gold ring. Planner: accent ring.
   - **Navigation**: dark top bar with blur effect, subtle bottom border

4. Add micro-animations:
   - Button press: subtle scale-down (0.97) on click
   - Card hover: slight translateY(-2px) and shadow increase
   - Page transitions: fade-in on route change (use Next.js loading.tsx with a smooth skeleton)
   - Modals: slide-up with spring easing for bottom sheets, fade+scale for centered modals
   - Toast notifications: slide-in from top with a smooth spring
   - Expand/collapse: smooth height transitions for day sections

5. Update the home/landing page (src/app/page.tsx):
   - Dark, dramatic hero with animated gradient background (slowly shifting colors)
   - Large wordmark in the display font
   - Tagline in lighter weight
   - The Google sign-in button should be prominent with a glow effect
   - Consider subtle particle effects or floating shapes in the background (keep it performant — use CSS animations, not heavy JS)

6. Update the dashboard (src/app/dashboard/page.tsx):
   - Trip cards on a dark grid
   - "Create New Trip" card with a dashed border and accent glow on hover
   - Section headers with subtle accent underlines

7. Make sure EVERYTHING still works — this is a styling-only session. No logic changes. Run through every page and verify nothing is broken.
```

**After this:** Navigate through every page of the app and verify the new theme looks consistent and polished. Check both mobile (375px) and desktop viewports. Ensure text is readable, contrast ratios are accessible (WCAG AA minimum), and all interactive elements are clearly distinguishable.

**Tests to write for this session:**

```
Write the following tests:

e2e/theme-overhaul.spec.ts (Playwright):
- Home page: verify dark background renders (check computed background-color is dark)
- Home page: verify display font is loaded (check font-family)
- Dashboard: trip cards have the new dark styling (border, background)
- Trip page: hero image still renders correctly with dark overlay
- All buttons are visible and have adequate contrast (spot-check 3-4 key buttons)
- Modals render with dark background and blur backdrop
- Mobile (375px): all pages render correctly without overflow or text truncation
- Desktop (1280px): layout adapts correctly (multi-column grids, centered modals)
- Navigation between pages has smooth transitions (no jarring white flash)
- The theme works in both mobile and desktop Playwright projects

These are primarily visual regression tests. For each page, take a screenshot and compare against the expected layout. Use Playwright's toHaveScreenshot() for visual regression if set up, or at minimum verify key CSS properties.
```

---

## Session 21: Per-Trip Custom Themes

```
Allow trip organizers to customize the visual theme of their specific trip page. This includes custom backgrounds, fonts, and special background effects.

1. Database migration — create supabase/migrations/005_trip_themes.sql:

   ALTER TABLE trips ADD COLUMN theme jsonb DEFAULT '{}'::jsonb;

   The theme JSON structure:
   {
     "background": {
       "type": "gradient" | "image" | "solid",
       "value": "<css-gradient-string>" | "<image-url>" | "<hex-color>",
       "overlay_opacity": 0.0-1.0
     },
     "font": {
       "display": "<google-font-name>",
       "body": "<google-font-name>"
     },
     "accent_color": "<hex-color>",
     "effect": "none" | "confetti" | "sparkles" | "snow" | "fireflies" | "aurora",
     "card_style": "glass" | "solid" | "outline"
   }

   RLS: only the organizer can UPDATE the theme column. All participants can read it.

2. Create src/components/trip/TripThemeProvider.tsx:
   - Context provider that wraps the trip page
   - Reads the trip's theme JSON
   - Dynamically loads Google Fonts if custom fonts are specified (use the Web Fonts API or add <link> tags dynamically)
   - Sets CSS custom properties on the trip page container to override the global theme:
     --trip-bg, --trip-accent, --trip-font-display, --trip-font-body, --trip-card-style
   - Children components use these CSS variables, falling back to the global theme defaults

3. Create src/components/trip/BackgroundEffects.tsx:
   - Renders the selected background effect as a fixed, pointer-events-none overlay on the trip page
   - Effects (all using lightweight CSS/Canvas animations — keep performance in mind):
     - "confetti": colorful confetti pieces falling slowly (CSS animation with random delays)
     - "sparkles": small twinkling dots that fade in and out at random positions
     - "snow": white particles drifting down gently
     - "fireflies": warm yellow dots floating with organic movement paths
     - "aurora": subtle color waves across the top of the page (CSS gradient animation)
     - "none": no effect (default)
   - All effects should be subtle and not distracting — they're ambient background decoration
   - Must be performant on mobile: use CSS animations where possible, limit particle count, use will-change and transform for GPU acceleration
   - Respect prefers-reduced-motion: disable all effects if the user has reduced motion enabled

4. Create src/app/trip/[tripId]/customize/page.tsx — Theme editor page:
   - Only accessible to the trip organizer. Redirect non-organizers to the trip page.
   - Live preview: the page shows a mini preview of the trip page with the current theme applied
   - Sections:
     a. **Background**: three options — Gradient (color picker for start/end colors + direction), Image (upload custom background image to Supabase Storage), Solid Color (single color picker). Overlay opacity slider.
     b. **Fonts**: dropdowns for display and body fonts. Offer a curated list of 15-20 Google Fonts that look good: "Space Grotesk", "Clash Display", "DM Sans", "Plus Jakarta Sans", "Playfair Display", "Libre Baskerville", "Sora", "Outfit", "Inter Tight", "Bricolage Grotesque", "Crimson Pro", "Oswald", "Raleway", "Work Sans", "Archivo". Preview the font name in its own font.
     c. **Accent Color**: color picker for the accent/highlight color used for buttons, badges, and links
     d. **Special Effect**: visual picker showing a small animated preview of each effect (confetti, sparkles, snow, fireflies, aurora, none)
     e. **Card Style**: three options — Glass (glassmorphism), Solid (opaque dark), Outline (transparent with border)
   - "Save" and "Reset to Default" buttons
   - Save updates the trips.theme JSON column
   - Add a link to the customize page from the trip edit page (/trip/[tripId]/edit) — "Customize Theme" button

5. Update the trip page (/trip/[tripId]/page.tsx) to wrap content in TripThemeProvider and render BackgroundEffects.

6. Update the view-only page to also apply the custom theme — view-only visitors should see the styled trip page. The theme data should be included in the /api/trip/[tripId]/view endpoint response.
```

**After this:** Customize a trip's theme — change the background, fonts, accent color, and add a sparkle effect. Verify the theme applies to the trip page for all participants and view-only visitors. Test on mobile and desktop.

**Tests to write for this session:**

```
Write the following tests:

tests/api/trip-theme.test.ts (Vitest):
- Organizer can update the theme column with valid JSON
- Non-organizer cannot update the theme column → returns 403
- Invalid theme JSON structure is rejected
- View endpoint includes the theme data

e2e/trip-theme.spec.ts (Playwright):
- Organizer can access /trip/{tripId}/customize
- Non-organizer visiting /trip/{tripId}/customize is redirected to the trip page
- Background section: selecting "Gradient" shows color pickers, selecting "Solid" shows single picker
- Font section: changing display font updates the preview in real-time
- Effect section: selecting "sparkles" shows animated sparkles in the preview
- Card style section: selecting "glass" updates card appearance in preview
- Saving the theme → trip page reflects the new background, fonts, accent, and effect
- "Reset to Default" clears the theme and reverts to the global theme
- View-only page also shows the custom theme
- On mobile: theme editor is usable (scrollable, all inputs accessible)
- prefers-reduced-motion: effects are disabled (set via Playwright's emulateMedia)
- Trip page with no custom theme (empty JSON) uses the global defaults correctly
- Custom font loads correctly (verify via computed font-family)

Seed a trip with a pre-existing theme JSON for some tests. Use a trip with no theme for the default fallback tests.
```

---

## Session 22: Integration Tests & Final V2 Review

```
Run a comprehensive integration test pass across all V2 features to make sure they work together correctly.

1. Run ALL existing tests and fix any that broke due to V2 changes:
   - npm run test:db (RLS policy tests — including the new 002, 003, 004 migrations)
   - npm run test:unit (Vitest — all API and component tests)
   - npm run test:e2e (Playwright — all E2E tests)

2. Write cross-feature integration tests in e2e/v2-integration.spec.ts:
   - Create a trip → customize its theme → invite a user → user sees the invite landing page with the custom theme background → user joins → RSVPs to an event → comments on the event with a GIF → all data appears correctly
   - Organizer creates an event with an end time → participant RSVPs "going" → another participant comments → organizer changes the first participant's nickname → all changes reflected in real-time across two browser contexts
   - Planner kicks a member → member's RSVPs and comments remain (they're not deleted on kick, just orphaned with "Former participant" display) → verify the member can no longer access the trip
   - View-only visitor sees: trip with custom theme, events with end times displayed, RSVP counts, but NO comments, NO RSVP buttons, and NO editing capabilities

3. Security review for V2 features:
   - Verify the Tenor API key is only used server-side (in /api/gifs/* routes, not in client code)
   - Verify RSVP and comment RLS policies work correctly by testing direct Supabase calls as different roles
   - Verify the invite preview endpoint doesn't leak sensitive trip data
   - Verify custom theme JSON is sanitized (no script injection in font names or background values)
   - Check that BackgroundEffects doesn't cause performance issues on low-end mobile (test with Playwright CPU throttling)

4. Clean up:
   - Remove any console.log statements added during V2 development
   - Ensure all new env vars (TENOR_API_KEY) are documented in .env.local.example
   - Verify TypeScript strict mode passes with no errors
   - Run the linter and fix any issues

All tests must pass.
```

---

# Parallelization Guide

Here's which sessions can be worked on simultaneously without conflicts:

```
ROUND 1 — These are all independent and touch different parts of the codebase:
┌──────────────────────────────────────────────────────────────────┐
│  Session 14 (End Times)         — touches: event forms, cards   │
│  Session 17 (Invite Landing)    — touches: join flow, new page  │
│  Session 18 (User Info / Names) — touches: participants page    │
│  Session 19 (Planner Kick)      — touches: kick API, RLS       │
│  Session 20 (Theme Overhaul)    — touches: global CSS, layout   │
└──────────────────────────────────────────────────────────────────┘

⚠️  Session 20 (Theme Overhaul) changes global styles, so if you run
it in parallel with others, expect some merge conflicts in CSS classes.
Consider running Session 20 FIRST or LAST in Round 1 to minimize conflicts.

ROUND 2 — These depend on Round 1 completions:
┌──────────────────────────────────────────────────────────────────┐
│  Session 15 (RSVP)              — after Session 14 (end times   │
│                                    are in the event detail view  │
│                                    where RSVPs also appear)     │
│  Session 16 (Comments + GIFs)   — after Session 14 (same        │
│                                    event detail view)           │
│  Session 21 (Per-Trip Themes)   — after Session 20 (needs the   │
│                                    new global theme as a base)  │
└──────────────────────────────────────────────────────────────────┘

⚠️  Sessions 15 and 16 both add UI to the event detail view.
They CAN run in parallel but will likely have merge conflicts in
ItineraryDetail.tsx. Safer to run them sequentially: 15 then 16.

ROUND 3 — After everything else:
┌──────────────────────────────────────────────────────────────────┐
│  Session 22 (Integration Tests) — after ALL other sessions      │
└──────────────────────────────────────────────────────────────────┘

RECOMMENDED SEQUENCE (maximizing parallelism):

  Batch 1:  14 + 17 + 18 + 19    (4 parallel sessions)
  Batch 2:  20                    (solo — global CSS changes)
  Batch 3:  15 + 21              (2 parallel sessions)
  Batch 4:  16                    (solo — builds on 15's event detail)
  Batch 5:  22                    (integration tests)

ALTERNATIVE (most aggressive parallelism, higher merge conflict risk):

  Batch 1:  14 + 17 + 18 + 19 + 20   (5 parallel — resolve CSS conflicts after)
  Batch 2:  15 + 16 + 21              (3 parallel — resolve event detail conflicts after)
  Batch 3:  22                         (integration tests)
```

