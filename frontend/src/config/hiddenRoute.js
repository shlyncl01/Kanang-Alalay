// Single source of truth for the non-public staff login URL.
//
// IMPORTANT: this is OBSCURITY, not SECURITY. Anyone who reads the built
// JS bundle (view-source, devtools, network tab) can find this string.
// The actual protection is the backend: /api/auth/login still requires a
// valid username + password, role checks happen server-side, and every
// admin/head-caregiver route is wrapped in ProtectedRoute + a `protect`
// JWT check on the API. This constant only stops people from finding the
// login form by guessing "/login".
//
// If you ever suspect this path has leaked (e.g. shared publicly), just
// change the string below to a new one and redeploy — nothing else
// needs to change, because both HomePage.js and App.js import from here.

export const HIDDEN_LOGIN_PATH = '/entry-a96cc8350c56e2d3';