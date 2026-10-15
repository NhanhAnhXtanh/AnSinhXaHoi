/**
 * Base URL of the REST API backing every resource.
 *
 * <p>Read from `VITE_API_URL` so a deployment can repoint it without a code
 * change; the fallback is the `backend/` Spring Boot app in this repo running
 * with its default port and context path. `.env` is gitignored, so the fallback
 * — not the env file — is what a fresh checkout gets.
 */
export const API_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:8080/api";
