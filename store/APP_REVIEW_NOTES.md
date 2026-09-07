# App Review — 1.7.1 rejections and what was done

## The rejections

Both are Guideline 2.1 "Information Needed — New App Submission", the
boilerplate Apple sends to accounts with a short review history. Neither
reports a defect in the build.

- iOS 1.7.1 (6) — submission `372d3160-3fd9-488f-ab9c-84b283afc089`,
  rejected 2026-09-06.
- macOS 1.7.1 (6) — submission `b6337b4c-c5c8-43fb-898e-102409660ce7`,
  rejected 2026-09-07.

Apple asks for six things: a screen recording from a physical device, the
app's purpose and audience, setup instructions, a list of external services,
regional differences, and documentation for regulated industries or protected
third-party material.

## Done

The Notes field in App Review Information already covered the setup steps and
the absence of accounts and data collection, separately for each platform.
Four sections were appended to both (iOS notes now 3481 chars, macOS 2693, of
4000 allowed) and saved:

- **Purpose and audience** — restyles superteam.fun/earn, the public bounty
  and grant board; for people who read that board regularly and prefer a dark
  interface.
- **External services: none** — no backend, no data provider, no auth, no
  payments, no analytics or advertising SDK, no AI service. Permissions are
  `storage` and `alarms` plus host access to superteam.fun/earn.
- **Regional differences: none** — English-only, no region-gated content or
  locale-dependent behaviour.
- **Regulated industries and third-party material: none** — restyles a public
  website in the user's own browser; redistributes nothing.

Point 3 (credentials) needed nothing new: the app has no sign-in, so the
existing "no account or test credentials are needed" line answers it.

TestFlight internal group "Internal" was created and dedpul3000a@gmail.com
invited, so builds 3-6 can be installed on a device for the recording.

## Left to do

The screen recording, which has to be made by hand, and the reply to App
Review, which should be sent with the recording attached rather than before
it.

### What to film

One iPhone recording covers the iOS submission; film the macOS flow
separately for the macOS one.

1. Launch the container app from the home screen; hold on the instructions
   screen long enough to read it.
2. Enable the extension — Settings > Apps > Safari > Extensions > Superteam
   Earn Dark. Film this; it is the step reviewers most often miss.
3. Open `https://superteam.fun/earn` in Safari.
4. Tap the extensions button in the address bar (the puzzle icon right of the
   URL on iOS 18+, *not* the AA menu), then Always Allow > Always Allow on
   This Website. The page turns dark.
5. Open the panel: switch two or three presets, change an element color, set a
   wallpaper, change font size — showing the page update each time.
6. Toggle the extension off, reload to show the site's own light appearance,
   then turn it back on.
