import { createSimpleRestDataProvider } from "@refinedev/rest/simple-rest";

import { API_URL } from "./constants";
import {
  AUTH_VERSION_HEADER,
  clearSession,
  getAccessToken,
  reconcileAuthVersion,
  refreshSession,
} from "./session";

/**
 * The REST data provider, with the bearer token attached to every request.
 *
 * The two ky hooks below are the whole of the authentication story for data
 * requests: no page, resource or hook ever sees a token.
 */
export const { dataProvider, kyInstance } = createSimpleRestDataProvider({
  apiURL: API_URL,
  kyOptions: {
    // ky retries failed requests by default. Retrying a 401 would race the
    // refresh below and burn the rotated token; retrying a 409 or a 422 would
    // repeat a write the server already rejected on purpose.
    retry: 0,
    hooks: {
      beforeRequest: [
        (request) => {
          const accessToken = getAccessToken();
          if (accessToken) {
            request.headers.set("Authorization", `Bearer ${accessToken}`);
          }
        },
      ],
      afterResponse: [
        /**
         * Recovers from an expired access token without the user noticing.
         *
         * Access tokens last minutes, so an open dashboard hits this routinely.
         * The request is replayed once with a fresh token; if the refresh
         * fails, the 401 is returned unchanged and the auth provider's
         * `onError` turns it into a sign-out.
         *
         * Only 401 is retried. A 403 means the token is valid and the
         * permission is missing, which no amount of refreshing will change.
         */
        async (request, _options, response) => {
          if (response.status !== 401) {
            return response;
          }

          // `refreshSession` de-duplicates concurrent callers, so the several
          // list requests a dashboard fires in parallel share one refresh
          // rather than each burning the rotated token in turn.
          const accessToken = await refreshSession(API_URL);
          if (!accessToken) {
            clearSession();
            return response;
          }

          // A fresh Request, because the original's body may already be
          // consumed and its Authorization header still holds the dead token.
          const retried = request.clone();
          retried.headers.set("Authorization", `Bearer ${accessToken}`);
          return fetch(retried);
        },

        /**
         * Notices when this account's permissions have moved.
         *
         * Every response carries `X-Auth-Version`, a stamp of what the server
         * currently says this account may do. Comparing it against the stamp
         * stored with the cached codes turns ordinary traffic into the
         * notification channel: no polling, no held connection, no extra
         * request while nothing changes.
         *
         * It catches every cause, not just this client's own edits — another
         * administrator changing your role reaches you on your next request.
         * That is why it replaced the earlier version of this hook, which
         * guessed from the URL that a write to `users` or `roles` might have
         * mattered: a guess that fired when nothing had changed and stayed
         * silent when somebody else changed everything.
         *
         * Nothing is awaited. The response is already correct — the server
         * enforced the real permissions when it answered — and all that is
         * outstanding is bringing the menu into line.
         */
        async (_request, _options, response) => {
          reconcileAuthVersion(response.headers.get(AUTH_VERSION_HEADER), API_URL);
          return response;
        },

        /**
         * Turns a non-2xx response into a thrown error.
         *
         * `@refinedev/rest` hard-codes `throwHttpErrors: false` on its ky
         * instance — after spreading `kyOptions`, so it cannot be overridden —
         * and then checks `response.ok` itself in `create`, `update`,
         * `deleteOne`, `getMany` and `custom`. It does not check it in
         * `getList` or `getOne`: those two pass the parsed body straight back
         * as the data.
         *
         * So a 403 arrives at the page as `{status, message, errors}` wearing
         * the shape of a record. The query reports success, no error
         * notification is raised, `authProvider.onError` never runs — and the
         * first `.map` or `for…of` over it takes the whole screen down. That
         * is what a revoked `categories:read` did to the blog posts list.
         *
         * This hook runs last, so the 401 retry above has already had its turn
         * and `X-Auth-Version` has already been read off the response. It
         * throws Refine's `HttpError` shape, which is what `onError` and the
         * notification provider already expect — and what the provider's own
         * `transformError` produces on the paths that do check.
         */
        async (_request, _options, response) => {
          if (response.ok) {
            return response;
          }

          // Cloned because a body read here would otherwise be unavailable to
          // anything that catches this, and tolerant of a non-JSON body: a
          // proxy or a gateway can answer where `ApiExceptionHandler` did not.
          const body = (await response
            .clone()
            .json()
            .catch(() => null)) as {
            message?: string;
            errors?: Record<string, string>;
          } | null;

          throw {
            message:
              body?.message || response.statusText || "Request failed",
            statusCode: response.status,
            errors: body?.errors,
          };
        },
      ],
    },
  },
});
