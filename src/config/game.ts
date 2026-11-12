// Working title is configurable so the project never has to ship the trademarked name (CLAUDE.md).
export const GAME_TITLE = process.env.NEXT_PUBLIC_GAME_TITLE || "High Noon";

/**
 * Google sign-in / account linking is offered only once the provider is set up in Supabase (docs/DEPLOY.md, "Google
 * later"); until then the buttons would only lead to "provider is not enabled".
 */
export const GOOGLE_AUTH = process.env.NEXT_PUBLIC_GOOGLE_AUTH === "true";
