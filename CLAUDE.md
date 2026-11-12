# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two independent projects in one git repository, with no root-level build. Each has its own toolchain and its own commands; nothing at the root ties them together:

- `frontend/` — Refine + React 19 admin dashboard (Vite, TypeScript, Tailwind v4, shadcn/ui).
- `backend/` — Spring Boot 4.1.1 / Java 25 REST API over PostgreSQL, serving the resources the dashboard uses and the JWT authentication behind them. Schema and seed data are Liquibase changelogs.

The frontend talks to the backend over HTTP; there is no shared build step or generated client between them, so the API contract is upheld by hand on both sides (see *The API contract is the data provider's dialect* below).

## Commands

All frontend commands run from `frontend/`:

```bash
npm run dev            # refine dev — Vite dev server
npm run build          # tsc && refine build
npm run start          # serve the production build
npx tsc --noEmit       # typecheck only
npx eslint .           # lint (eslint.config.js exists; there is no npm script for it)
npm run verify:arch    # layer dependency rules (scripts/verify-architecture.mjs)
```

There is no frontend test runner installed.

Backend commands run from `backend/` (`.\gradlew.bat` on Windows, `./gradlew` under Bash):

```bash
./gradlew build
./gradlew bootRun
./gradlew test
./gradlew test --tests "com.dth.frw.DthFrameworkApplicationTests"          # single class
./gradlew test --tests "com.dth.frw.DthFrameworkApplicationTests.contextLoads"  # single method
```

Gradle wrapper 9.7.1, Java toolchain 25. Both `bootRun` and `test` need the PostgreSQL database reachable — `contextLoads` starts the full context, so it fails on a datasource it cannot open.

Running the stack means two terminals: `./gradlew bootRun` in `backend/` (port 8114), `npm run dev` in `frontend/` (port 8765, the origin the backend's CORS config allows). Each side has its own env file, copied from its `.env.example`: `backend/.env` (loaded by `bootRun` as environment variables; real environment variables win, empty values mean "use the default", `gradlew test` never reads it) and `frontend/.env` (read by Vite: `FRONTEND_PORT`, `FRONTEND_HOST`, `VITE_*`).

## Frontend architecture

### Refine resources and routes are two halves of one declaration

`src/app/resources/index.tsx` holds the `resources` array passed to `<Refine>`, and `src/app/router/routes.tsx` the `<Route>` tree. Refine infers the current resource from the URL — that is what lets `useTable`, `useForm` and the `*Button` components work without being told which resource they operate on. **Adding a resource means editing both files**; if the action paths in `resources` and the `<Route>` paths drift apart, buttons and breadcrumbs silently navigate nowhere.

Two `meta` conventions beyond Refine's own: `meta.group: true` marks a route-less resource that the sidebar renders as a section header, and `meta.badge` renders a badge on the nav row. Both are conventions of `shared/components/layout/sidebar.tsx`, not Refine APIs.

### Two page patterns coexist deliberately

- **`blog_posts` — dialog routes.** `create`/`edit`/`show`/`clone` are nested *under* the list route, so `<BlogPostList />` stays mounted (filters, sorting, pagination survive) while its `<Outlet />` renders the open dialog. `shared/components/views/route-dialog.tsx` is the piece that makes the dialog *be* the route: every dismissal path (close button, `Esc`, overlay click, `<DialogClose>`) navigates back to the list with `type: "replace"`. Because the submit button lives in the dialog footer outside the `<form>`, it is wired back with a `FORM_ID` and the HTML `form` attribute.
- **`categories`, `organizations`, `departments`, `users`, `roles`, `permissions`, `row_level_policies` — plain pages.** Standard `CreateView`/`EditView`/`ShowView` full-page routes. The admin forms are the reason this pattern earns its keep here: a role's permission picker and a user's role picker need more vertical room than a dialog gives them. `permissions` declares only `list` and `show` of them, which is the whole of what the API offers — a permission means nothing until an endpoint checks for it, so the catalogue is written by migrations and read here. Its show page answers "which roles grant this" by filtering the role list client-side, because each role's payload already carries its permissions and no endpoint filters roles by one; that read is a separate grant, so it is gated with `useCan` and explains its own absence rather than rendering an empty list.

`organizations` and `departments` are the pair to read first when adding a resource of your own: they are the plain-page pattern with nothing special about them, and between them they exercise every part of the contract — a parent with a `RESTRICT` foreign key behind it, a child with a `useSelect` picker and the merged-option and `reset` workarounds the blog post dialog documents, a status enum, and three levels of grant (ADMIN writes both, MANAGER writes only departments, USER reads both). The organization's show page lists its departments through the API's `organization.id` filter rather than client-side, which is what `permissions` would do if an endpoint let it.

`row_level_policies` is the newest of them and needs the room most: its condition builder is a recursive tree editor, and every input in it is a dropdown fed by `GET /api/row_level_policies/metadata`. **There is no free-text expression box anywhere on that screen, and its absence is the feature** — it is the UI-side shape of there being no expression language at runtime, so a condition the screen will not let you write is one the API would refuse.

`roles` is where the two halves of what a role grants are read and written together. Its create, edit and show screens each carry a **Permissions** and a **Data scopes** tab — a permission decides whether an endpoint answers this role at all, a scope decides which rows it answers with, and reading one without the other gives half the picture. The scopes tab (`features/administration/roles/data-scopes.tsx`) lists `row_level_policies` filtered by `role.id` and edits them through the same `PolicyForm` the standalone screen uses, with `lockRole` and `lockKind` set: a `FILTER` names no role by design, so there is no such thing as a filter *of* a role.

**The tabs do not share a save, and that is the decision worth knowing.** Permissions are a field of the role form and go up when Save is pressed; each data scope is written the moment its dialog is submitted, through `POST`/`PATCH /api/row_level_policies`. Folding them into the role's payload would mean re-implementing the policy compiler's refusals — a `422` naming the node at fault — inside a form that saves several rules at once, and losing which rule was rejected. The footer says so in one line while the scopes tab is open, because that is the only place the ambiguity exists.

Two things fall out of putting a form inside a form. The scopes tab renders inside the role's `<form>`, which is legal only because `DialogContent` portals out of it — every button that is *not* portaled has to say `type="button"`, or it submits the role. And role **create** now redirects to `edit` rather than to the list: a scope needs a role id to belong to, so the tab is present but empty until the role exists, and landing on the edit screen is the difference between the second half of the job being in front of you and being something you have to go and find.

**The three role screens spend their height on the tab, not on the identity.** The three fields that name a role are typed once and read at a glance afterwards; the matrix and the scope list are what somebody is actually working in. So the fields sit on one 12-column row (`3 / 4 / 5` — a code, a few words, a sentence), the read-only facts that used to fill an 18rem card beside them are a divided strip in the panel's header band (`features/administration/roles/meta.tsx`), and on **edit** the whole strip collapses. Each tab's explanation moved onto the band the tabs already occupy, so the panel below starts at its own toolbar rather than under a `CardHeader` repeating the tab's own name.

Each tab panel is one sheet with the same three zones a list screen has: a toolbar on `--surface-subtle`, then rows. `PermissionMatrix` and `RoleDataScopes` therefore *are* the panel — the caller wraps them in a `Card` with `py-0` and no padding, and wrapping either in a padded `CardContent` draws two borders around the same table. The matrix scrolls inside that panel with its header row and its resource column both sticky, and its cap is `calc(100svh - var(--panel-reserve))`: only the page knows how much of the viewport everything above the rows is using, so the page states it (`[--panel-reserve:28rem]` and so on) and collapsing the details strip hands its height straight to the rows.

The show screen draws the same matrix with `readOnly`, opening on the resources that actually grant something with the whole catalogue one button away. A wall of `{resource}:{action}` badges flattens away one of the two axes a permission code *is*, which is the same reason the edit screen draws a grid.

The scope dialog spans the content column rather than sitting at a centred `sm:max-w-lg`, because the condition builder indents once per nesting level and wraps into unreadability when narrow. Two things make that harder than it sounds. A portaled dialog lands on `document.body`, outside the element carrying `--sidebar-width`, so the rail's width cannot be read from CSS and is handed in from `SHELL_SIDEBAR_WIDTH`/`_ICON` (exported by `layout.tsx`, chosen by `useSidebar()` — React context does travel through a portal). And **`tailwind-merge` treats a bare utility and its `sm:` variant as separate groups**: `max-w-none` alone leaves the stock `sm:max-w-lg` in force from `sm` upwards, which is every screen this shell runs on, so the dialog comes out looking exactly as narrow as before. Override both halves.

`users` is the same language applied to a form rather than a table. Its create and edit screens are a **sectioned panel** — `Identity`, `Placement and status`, `Roles`, each an `<h3 class="text-overline">` zone hairlined from the next, fields on a 12-column grid (`shared/components/form/form-section.tsx`). Eight inputs in one column is a list of things to fill in; the same eight under three headings is a description of the account, and somebody who came to change a department can find it without reading the rest. `PlacementPicker` takes `className="contents"` there so its two fields join the section's own grid instead of stacking in a wrapper of their own, and `RolePicker` lays its cards out two or three to a row — a column of full-width cards on this shell's width is a stack of banners with half a metre of nothing to the right of each.

Edit puts the read-only facts and the **Reset password** card in a 20rem aside instead of between two inputs: neither is a field of the form, and setting a password is a separate endpoint that ends every session under the account. Show is three `DetailPanel`s side by side — identity, placement, activity — over a full-width Roles panel, with every row that names another record linking to it, because the question after "which role does she hold" is almost always "and what does that role grant".

`shared/components/views/record-detail.tsx` is where the pieces both of those are built from live — `MetaItem`/`MetaStrip` for the facts strip along the top of a screen, `DetailPanel`/`DetailList`/`DetailRow`/`EmptyValue` for a panel of read-only fields. Each page used to write its own `Field` helper with `text-xs font-medium uppercase tracking-wide` copied verbatim, and the copies drifted. A new detail screen gets the house style by importing rather than by remembering it.

Copy whichever pattern the resource you are extending already uses.

### Leaving a form with unsaved edits

`options.warnWhenUnsavedChanges` is on, and `shared/components/form/unsaved-changes-guard.tsx` is what answers it. Refine ships an `UnsavedChangesNotifier` for this, but it asks with `window.confirm` — browser chrome that carries the origin, ignores the theme, and offers "OK" / "Cancel" for a decision about losing work. The guard asks with the application's own `AlertDialog` instead.

**The mechanism could not change, only the surface.** `App.tsx` mounts a `<BrowserRouter>` rather than a data router, so `useBlocker` does not exist here; the only place to intervene is the history `navigator`, whose `push` and `go` are synchronous and expect an answer *now*. A dialog cannot answer synchronously — so the guard refuses the navigation outright, keeps the call in state, and replays it if the user says to leave.

**`replace` is not patched, and must not be.** It is not the user saying "go somewhere else": `useTable`'s `syncWithLocation` writes filters, sorting and pagination back to the URL with it *from inside an effect*, and every `<Navigate replace>` redirect in `routes.tsx` uses it too. Patching it puts the dialog in front of a session that just expired, and in front of a list quietly syncing its own query string behind an open dialog.

That leaves one real gap, because a `RouteDialog` dismisses with exactly that `replace` — so closing the blog post dialog over a dirty form threw the edits away in silence. It asks for itself instead, through `useConfirmDiscard`: a call somebody wrote at the one site that knows the navigation is a user's dismissal, rather than a class of navigation guessed at. With no unsaved edits it runs straight through, so the dismissal path is unchanged.

Closing the tab still gets the browser's own dialog. `beforeunload` is the one prompt no page may style or replace, and browsers stopped honouring a custom message years ago precisely so a page could not dress it up.

### Source layout: four layers, one direction

`src/` is laid out like the sibling *sandulieundc* frontend — feature-first, with the data model lifted out:

```
src/
├── app/        composition: App.tsx, index.tsx (the entry), providers/ (auth, access-control,
│               authorities-sync), resources/ (the Refine resources array), router/ (the route tree)
├── features/   one folder per screen area, each exporting only through its index.ts —
│               dashboard, tasks, blog-posts, categories, organizations, departments, notifications,
│               administration/{users,roles,permissions,row-level-policies},
│               identity/{login,profile,register,forgot-password}
├── domains/    plain TypeScript: the API's payload types, their labels and option lists, pure
│               helpers — user, role, permission, organization, department, task, row-level-policy
├── shared/     ui/ (shadcn primitives), components/ (the Refine-aware layer: views, buttons,
│               data-table, form, layout shell, notification, tabs, theme), hooks/, lib/,
│               api/ (API_URL, the session store, the data provider, the live channel)
└── styles/     theme.css (the tokens) and index.css (Tailwind bridge, base, utilities, print)
```

The dependency rules are what make those folder names mean something, and `npm run verify:arch` fails on any import that breaks one. Nothing else would: a feature reaching into another feature compiles and runs, and the only symptom is a layout that has stopped describing the code.

| Layer | May import | May not import |
| --- | --- | --- |
| `app/` | everything | — |
| `features/X` | `shared/`, `domains/`, itself | `app/`, any other `features/Y` |
| `shared/` | `shared/`, `domains/` | `features/`, `app/` |
| `domains/` | `domains/` | anything else — no React, no Refine, no UI package |

Three placements follow from those rules, and they are the ones easiest to undo by reflex:

- **The transport is `shared/api/`, not `app/providers/`.** The session store, `API_URL`, the authenticated ky instance and the live channel are needed by features (every `useCustom` URL, the profile screen) and by shared components (the notification bell, the data table's scoped-empty message), and neither may import `app/`. What stays in `app/providers/` is only what `<Refine>` is handed — `authProvider`, `accessControlProvider` — and the component that keeps react-query in step with the authorities. `permissionFor` lives in `shared/lib/permissions.ts` for the same reason: the sidebar asks it too.
- **Payload types live in `domains/`; badge colours live in `shared/lib/status-variants.ts`.** Several features read another resource's shape — a task names a department and a user — and a feature may not import another feature, so the types needed a neutral home. That home may not know about React, so what a status *looks like* is kept apart from what it *is*: one table for every resource, which is also what lets an organization draw its departments' statuses.
- **`users`, `roles`, `permissions` and `row-level-policies` are one feature, `administration`.** The role screens edit data scopes through the row-level policy screens' own `PolicyForm`; as separate features that import would break the rules. The sign-in forms went the other way, into `features/identity/components/`, because nothing outside that feature uses them.

File names stay kebab-case (`list.tsx`, `use-notifications.ts`) rather than *sandulieundc*'s PascalCase: the layout was adopted, the renaming was not. `shared/ui/` is stock shadcn/ui (`new-york` style, `neutral` base, lucide icons, `@` → `src`), and `components.json` points the generator there — regenerate rather than hand-edit. Project-specific behaviour belongs in `shared/components/`.

### Data layer

`src/shared/api/data.ts` builds a `@refinedev/rest` simple-REST provider from `API_URL` in `src/shared/api/constants.ts`, which reads `VITE_API_URL` and falls back to `http://localhost:8114/api` — the `backend/` in this repo. `frontend/.env` is gitignored, so the fallback, not the env file, is what a fresh checkout gets; `frontend/.env.example` records the variables.

**A Radix `Select` cannot render a value whose option has not arrived.** It draws its label from the matching `SelectItem`, so a value the form receives *after* mount — or one whose option list is still in flight — shows the placeholder and reads as an empty field. Two separate causes, both on edit screens, and both need handling:

- `reset` can only run from an effect, which is always after a render, so a form mounted before it holds the record mounts holding the defaults. `row-level-policies/edit.tsx` therefore does not render the form at all until the record is in it. The symptom is deceptive: only the fields whose value actually *changed* go blank, so a default that happens to equal the record's value looks fine and hides the pattern.
- Option lists fed by `useSelect` or `useCustom` resolve later still. Merge the current value into the list (`row-level-policies/policy-form.tsx` does this for both pickers) rather than trusting it to be there.

**`useCustom` reports "no data yet" as a frozen empty object, not `undefined`.** Its return is literally `result: { data: queryResponse.data?.data || EMPTY_OBJECT }`, and that object is *truthy* — so the obvious guard passes and the next property access reads `undefined.length`. It is worst on a query with `enabled: false`, because a disabled react-query is not "loading" either, so neither natural guard catches it and the component throws on its first render: a blank screen with one line in the console. Every custom read here goes through `shared/hooks/use-custom-result.ts`, which names a key the real payload always carries and turns the sentinel back into `undefined`.

### Auth: three providers, one permission vocabulary

`app/providers/auth.ts` talks to `/api/auth/*` and stores the token pair; `shared/api/data.ts` attaches it to every data request; `app/providers/access-control.ts` decides what the UI offers. All three read the same module, `shared/api/session.ts`, which is the only place tokens, the cached identity and the cached permissions live — no page, resource or hook ever handles a token.

The route tree in `routes.tsx` has two halves: everything inside `<Authenticated>` renders in the shell, and `/login` sits outside it. `<Authenticated>` calls `authProvider.check`, which is what turns an expired access token into a silent refresh rather than a bounce to the login form.

**The permission code is derived, not mapped.** A code is `{resource}:{read|write|delete}`, where the resource half is verbatim the resource name in `app/resources/index.tsx` — so `blog_posts:read`, underscore included. That is why `accessControlProvider.can` can build the code it needs from the resource and action Refine already hands it, and why there is no lookup table on either side to drift. Refine's six actions collapse to three: `list`/`show` → `read`, `create`/`edit`/`clone` → `write`, `delete` → `delete`. Adding a resource means seeding its three permissions in a migration and granting them to a role. **One exception, for ASXH screens:** a menu entry that is a *screen* over another resource's data (e.g. `report_review` over `input_reports`, `period_setup` over `period_assignments`) is listed in `SCREEN_PERMISSIONS` in `shared/lib/permissions.ts`, which names the backend code that opens it; every other resource still derives its code verbatim.

Access control hides; it does not protect. Every endpoint re-checks the same code with `@PreAuthorize`, so a hand-edited URL gets a 403 rather than a result. `can` asks a second question when it is handed a record: the `_can` flags a row-level resource stamps on each row decide whether Edit and Delete are offered for *that row*, and the server answers a write outside the caller's data scope with a `422` regardless of which buttons were rendered. Only `write` and `delete` are asked — a row the caller may not read was never in the response to begin with. The `*Button` components hide themselves through `options.buttons.hideIfUnauthorized`, and the admin routes are wrapped in `<CanAccess>` so a bookmarked URL explains itself instead of rendering an empty table behind a toast.

That is also what decides which actions a screen offers, and it is the reason `meta.canDelete` in `app/resources/index.tsx` is inert: it is a Refine type with no runtime consumer here, so both the list action columns and `ShowViewHeader` render a `<DeleteButton>` outright and let `{resource}:delete` settle it. Honouring it in one view and not the other is the trap — a resource would get a delete on its table and none on its detail page.

**A `*View` renders no header of its own.** `ShowView`, `ListView`, `CreateView` and `EditView` are containers; the breadcrumb, the back arrow and the action buttons live in a sibling `ShowViewHeader` / `ListViewHeader` / `CreateViewHeader` / `EditViewHeader` that the page has to render itself. Forgetting it costs nothing at build time — no type error, no lint warning, no runtime complaint — and produces a screen with no breadcrumb and no way out. Every page in this repo except the lists shipped that way until it was noticed: the show pages had no Edit, Delete or Refresh, and the create and edit pages had no breadcrumb at all. **A new page is not finished until its header is rendered.**

The one exception is `blog_posts`, whose create, edit and show are `RouteDialog`s rather than routed pages. A dialog opens on top of its own list, so it needs no breadcrumb and no back arrow; its actions live in the dialog footer instead.

`ListViewHeader` titles itself in the plural and the other three in the singular, because a list is about the collection and the other three screens are each about one record. Create and Edit asked for the plural until their headers were first rendered and the mistake became visible.

**`useMenu` does not apply access control** — it only drops items marked `meta.hide` or with neither a list route nor children — so `sidebar.tsx` filters the tree it returns (`useAccessibleMenuItems`, using the same `permissionFor` helper the provider uses). A section header survives only if something under it did, which is what makes the whole Administration group vanish rather than leaving an empty heading. Forget this on a new admin resource and it is offered to everyone, then refused on arrival.

**The token says who, not what.** The access token is a short-lived (15 min) HS256 JWT carrying a subject and a username — no roles and no permission codes. Stamping them in used to make authorising a request a pure signature check, but it also made every request carry the whole permission model in a header, which stops scaling the moment an application has a few hundred codes.

Each side gets what it needs from its own source instead:

- **The API** resolves authorities from `module/security/auth/service/AuthorityCache`, which `SecurityConfig`'s `JwtAuthenticationConverter` reaches through `AuthorizationService` with the token's `sub`. The cache reaches the user feature through `UserService`, never its repository. Neither cost is paid: nothing rides in the token, and nothing is read per request — measured at **0 SQL statements** for authorisation on a warm entry.
- **The UI** fetches them from `GET /api/auth/permissions` and caches them in `session.ts` under `dth-auth-authorities`, which is what keeps `accessControlProvider.can` a synchronous local read rather than a request per button. A session whose permissions cannot be loaded is treated as no session at all (an empty shell is indistinguishable from a revoked account); a *failed* load falls back to the cached copy, so a network blip does not sign anyone out.

**`authProvider.check` re-fetches once per page load — not never, and not every time.** Both extremes are wrong, and each was shipped before the other was:

- *Never* (serve the cache) is a bug that hides well: everything works, and a role an administrator changed simply never appears until the user signs out and back in. A reload will not do it.
- *Every time* is a request per window focus. Refine's `useIsAuthenticated` has react-query's default `staleTime: 0`, so `check` re-runs whenever the window regains focus or a new observer mounts — and `routes.tsx` mounts `<Authenticated>` twice under the same query key. None of those runs learns anything a page load did not.

`revalidateAuthorities` in `session.ts` holds the once-per-page-load flag; it resets on reload and on `clearSession`. Anything beyond the first read is served from the cache, because `X-Auth-Version` on every response is already keeping that cache honest.

Three things keep the cached copy current, and all three are needed:

| When | What does it |
| --- | --- |
| A change arrives on the live channel | `/user/queue/auth` → `applyAuthorities`, **no request at all** |
| Every API response whose `X-Auth-Version` differs | the `afterResponse` hook in `data.ts` |
| Once per page load, before the shell renders | `authProvider.check` → `revalidateAuthorities` |
| Every token refresh (~15 min on an open tab) | `performRefresh` in `session.ts` |

**The first two are two mechanisms converging on the same client state, and both are wanted.**

`AuthorityChangePublisher` pushes the account's grants down `/user/queue/auth` the moment they change — and pushes the *grants themselves*, not a nudge to go and re-read them, because they are already in memory in the cache that was just refilled. So an open tab updates with **zero requests**, even one sitting completely idle. Each node pushes only to its own sessions, which is what makes it correct across nodes with the in-memory broker: only the fact of the change crosses `PostgresEventBus`, never the message.

`X-Auth-Version` is the path that still works when that socket is reconnecting, blocked by a proxy, or was never established. Every response carries the stamp; the client compares it to the one stored with the codes it holds and re-reads only when they differ, so ordinary traffic — a navigation, a table, a refetch — becomes the fallback channel at the cost of **no extra requests while nothing changes**. It is a header on a response that was already being sent, so keeping it costs nothing.

Neither replaces the other, and they cannot fight: both write the same version stamp, so whichever arrives first makes the other a no-op. That only works because the stamp travels **inside** `AuthoritiesResponse` as well as in the header — a push has no headers to read, and updating the codes without the stamp would make the very next response's header look like a further change.

`applyAuthorities` in `session.ts` is the single place authorities are written, so a payload fetched from `/auth/permissions` and one pushed over the socket land identically; the client cannot tell which arrived.

The stamp is a hash of the account's own sorted permission codes **and the row-level policy generation**, not a counter, and that is what makes it work with no coordination between nodes: every node computes the same stamp for the same grants, so a client moving between them sees a change only when there is one. The permission half is per-account, so editing one role does not send every signed-in user off to re-read permissions that did not move; the policy half is deliberately global, because making it per-account would need the account's roles — which is what the cache computing the stamp is in the middle of building. See *Row-level security* for that trade.

`AuthoritiesResponse` carries a third field beside the codes and the stamp: `scopedResources`, the resources this account is genuinely narrowed on. It changes no decision — it is what lets an empty list say *why* it is empty.

It is set by `AuthVersionAdvice`, a `ResponseBodyAdvice` rather than a `HandlerInterceptor`, and that choice matters. An interceptor would have to write the header in `preHandle` — `postHandle` is too late, the response is usually committed and the header silently dropped — but `preHandle` runs *before* the handler, so the one response that matters most, the answer to the request that just changed somebody's roles, would carry the stamp from before the change. `ResponseBodyAdvice` runs after the handler and before the body is written, the only window where the value is both current and still settable.

Rewriting the cache is not enough on its own, though — `can` is read outside React and Refine holds every answer in react-query — so `loadAuthorities` notifies subscribers **only when the codes actually changed**, and `app/providers/authorities-sync.tsx` drops the `["access"]` and `["auth","permissions"]` query caches. Those keys are Refine's internals; it has `useInvalidateAuthStore` for exactly this but does not export it, so if an upgrade moves them the symptom is that file quietly doing nothing.

Nothing is left uncovered: an idle tab is reached by the push, and a tab whose socket is down is reached by the header on its next request.

**Two token lifetimes, doing different jobs.** The refresh token is opaque, long-lived (7 days) and recorded in `refresh_tokens` as a SHA-256 digest, which is what makes ending a session possible at all. It is rotated on every use, so the `refreshSession` helper in `session.ts` de-duplicates concurrent refreshes — several lists 401-ing at once would otherwise each burn the token the others were about to present.

**There is no staleness window on the API side**: a revoked permission, a re-scoped role, a disabled or deleted account all bite on the very next request, and the last two are answered `401` from the converter so the client stops using the token rather than puzzling over a 403. `app.security.jwt.access-token-ttl` no longer bounds anything but the token's own life.

That holds because the cache is invalidated by the features that change the data, not by a timer. `AuthoritiesChanged` (in `shared/security/`) is published by `UserService` when an account's roles or status move and by `RoleService` when a role's grants do; `AuthorityCache` consumes it with `@TransactionalEventListener(AFTER_COMMIT)`.

**It has to be an event, not a method call.** The cache needs `UserService` to populate itself; if `UserService` in turn needed the cache to evict it, Spring would refuse to construct either. This is the same cycle that made `token/` its own slice. `AFTER_COMMIT` matters too — evicting before the commit lets a concurrent request re-populate the cache with the very rows that are about to change — and `fallbackExecution = true` covers a publisher that is not inside a transaction, since without it such an event is dropped in silence, the worst possible failure mode for an invalidation.

A role change evicts **everything**, deliberately. Working out who holds the role means reading the user feature's table from inside the role feature, which is the coupling this layout exists to prevent. Editing a role is a rare administrative act and the cost is one lookup per active account on its next request — cheaper than the coupling, and far easier to reason about than a partial eviction that is subtly wrong.

**Across nodes, `AuthorityChangeChannel` carries the same events over Postgres `LISTEN`/`NOTIFY`.** The cache lives in one JVM's memory, so without this a permission edited on one node leaves every other node serving what it cached. It travels over the database the application already depends on, so there is no broker to run. Two things to know: it holds **one connection outside the pool** per node, because `LISTEN` is a property of a session and a pooled connection is handed back after every query; and notifications arrive at the sender too, which is why the payload carries a node id the sender skips. `AuthorityChangeChannel.Received` is a distinct type from `AuthoritiesChanged` on purpose — if the cache could not tell them apart it would re-broadcast what it had just received, and two nodes would notify each other forever.

The three invalidation paths are layered from precise to blunt so a gap in one is covered by the next: local events, then remote notifications, then a 60-second expiry on every entry. Nothing should ever need the expiry; it exists so that a path somebody forgets to publish an event from degrades to *wrong for a minute* rather than *wrong until the next restart*.

Three things that break quietly:

- **`app.security.jwt.secret` must be at least 32 bytes**, or the application refuses to start. The default in `application.properties` is a development value that is in version control; override it per deployment with `APP_SECURITY_JWT_SECRET`.
- **The security filter chain needs its own JSON error body.** Spring Security answers a bad token from the filter chain with no body at all, which the data provider reads as an unparseable response rather than "session expired" — and never refreshes. `shared/security/RestAuthenticationEntryPoint` pushes those back through the MVC exception resolver so `ApiExceptionHandler` stays the one place that decides what an error looks like.
- **`login`, `refresh` and `logout` are the only open endpoints.** They are exactly the three things you must be able to do without a valid access token.

`features/identity/register`, `features/identity/forgot-password` and the `sign-up-form` / `forgot-password-form` components are unused scaffolding: accounts are created by an administrator on the Users screen and passwords are reset there, so the sign-in form links to neither. They are left in place for anyone who wants to enable self-registration later, and would need `authProvider.register` / `forgotPassword` plus a public endpoint to work.

Seeded development accounts (`005-seed-security.sql`): `admin` / `Admin@123`, `manager` / `Manager@123`, `viewer` / `User@123`. Change them on anything reachable by anyone else.

### The live channel: STOMP over WebSocket

`/ws`, configured in `config/WebSocketConfig`. Built for notifications, and deliberately **not** for permissions — `X-Auth-Version` already carries those on ordinary traffic for no extra connection, and it stays the path that still works when a socket is down. What this exists for is the class of thing an HTTP response cannot carry, because the server has something to say when the client was not asking.

**Server to client only.** There is no `@MessageMapping` anywhere and `StompAuthChannelInterceptor` refuses a client `SEND` outright. Not a limit of the transport but a decision about surface area: every inbound destination is an endpoint to authorise, and nothing built so far needs one. Presence and record locking will, and they are why this is WebSocket rather than SSE.

**Authentication happens one frame in, not at the handshake.** `WebSocketConfig.ENDPOINT` is `permitAll` in the filter chain because the browser cannot put an `Authorization` header on a WebSocket handshake — the same limitation that makes `EventSource` awkward to secure. STOMP sidesteps it: the token travels in the `CONNECT` frame, which is message content rather than an HTTP header, so it never lands in an access log, a browser history or a `Referer` the way a token in a query string would. Opening a socket therefore proves nothing and grants nothing.

**The trap the interceptor exists to avoid.** An access token lives 15 minutes; a socket lives for hours. Authenticating once at `CONNECT` and trusting the resulting `Principal` afterwards would put back exactly the staleness the token redesign removed, with a window measured in hours — someone whose role was revoked at lunchtime would go on receiving until they closed the tab. So the `Principal` is an identity claim and nothing more: **every authorisation decision after `CONNECT` re-asks `AuthorityCache`** — this interceptor on each `SUBSCRIBE`, and `NotificationPublisher` on each message it sends. That is affordable at message rates precisely because it is a memory read; against the database it would not be, which is why the cache is load-bearing infrastructure here rather than an optimisation.

**The destination's permission is derived, not mapped.** `/user/queue/notifications` needs `notifications:read` — the third path segment plus `:read`, reached the same way `accessControlProvider.can` reaches it from a resource name. One permission vocabulary across HTTP and WebSocket; a lookup table would be a second copy of a rule that already exists, free to drift.

The one exception is `/user/queue/auth`, which carries the account's own grants and needs only a signed-in caller — mirroring `/api/auth/*`, which follows exactly that rule on the HTTP side. Deriving a code for it would mean inventing an `authorities:read` that guards nothing, and requiring a permission to receive your own permissions is circular.

**The principal's name is the user id as a string.** `convertAndSendToUser` matches on it, so if `StompAuthChannelInterceptor` set anything else, every message would be addressed to somebody the broker considers absent.

The broker is `enableSimpleBroker`, so subscriptions live in one JVM. User-targeted messages are still correct across nodes because `NotificationPublisher` fans out over `PostgresEventBus` and each node delivers to its own sessions. What is **not** correct across nodes is a broadcast `/topic`, which only reaches subscribers on the node that sent it — adding one means fanning it out the same way or moving to `enableStompBrokerRelay` with RabbitMQ behind it.

Behind a reverse proxy the handshake needs the upgrade headers passed through (`proxy_set_header Upgrade $http_upgrade` and `Connection "upgrade"` in nginx). Without them everything works locally and nothing works in production.

### Notifications

A resource with a list and a delete, and no create or edit screen. A person does not write a notification — the application raises one — and the only change a recipient may make is marking it read, which is a button rather than a form.

**`NotificationService.notify(...)` is the API the rest of the application calls**, in the same transaction as whatever warranted the notification. Everything else on that service serves the bell, and every one of those methods takes the recipient's id and applies it itself. That scoping is an invariant, not a filter: `NotificationSpecifications` deliberately has no `recipient` case, so no query string can widen it, and `get`/`delete` answer 404 rather than 403 for somebody else's row — the id of a notification you may not see should not be distinguishable from one that was never issued.

**The row is the record; the socket is only delivery.** Whoever was offline finds the notification waiting at their next sign-in. That framing is what keeps the failure modes boring: a closed socket, a downed bus, or a client on a node the message never reached costs a page refresh, never a lost notification. The frontend follows the same order — `use-notifications.ts` reads over HTTP and lets the socket keep it current, never the reverse.

`NotificationPublisher` listens `AFTER_COMMIT`. Pushing from inside the transaction would announce a row the client cannot read yet, or — if the caller's own work then rolled back — one that never existed.

Two permissions, `notifications:read` and `notifications:delete`, granted to **all three system roles** unlike everything else in the schema. They gate the bell rather than access to anyone else's rows, and an account that could not read its own notifications would simply never be told anything. There is no `notifications:write`: raising one for somebody else is `POST /api/notifications`, guarded by `users:write`, because reaching another account is what that endpoint really does.

### Tasks

The one feature that both consumes the rest and does something other than store what it was handed, which makes it the example to read for either.

**It is the only caller of `NotificationService.notify` outside the notification feature itself**, and it is what that API was built for: assigning work to somebody is exactly the case where the application has something to say when the recipient was not asking. The call sits inside the task's own transaction, so a save that rolls back announces nothing, and the row it writes — not the socket — is the record.

Two things keep that from becoming noise. The previous assignee is captured *before* the update runs, so a save that left the assignee alone sends nothing; without it every edit to a task would ring the holder's bell. And nobody is told when they assign a task to themselves, because a notification for your own action is a bell for something you just did.

**`completedAt` is derived, never accepted.** It is not on either request DTO. `TaskService.applyCompletion` stamps it on the transition *into* `DONE` and clears it on any move away, which is what stops the timestamp and the status from ever contradicting each other — and why re-saving a task finished last week does not move the date it was finished on. `CANCELLED` deliberately does not stamp it: an abandoned task was never completed, and recording a completion date for one makes "how long did this take" quietly wrong.

**`overdue` is computed by the API and reported on every row**, rather than left to the client. It is also a filter field with no column behind it — "is this late?" is a null check, a date comparison against today, and a status test, which no single column could answer. Both resolve *today* on the server, so a browser in another timezone cannot disagree with the filter about which tasks are late.

**Neither `status` nor `priority` is sortable, on purpose.** Both are stored as their enum names, so ordering by either orders alphabetically — priority sorts `HIGH, LOW, MEDIUM, URGENT` — which looks like a working sort and answers a different question from the one that was asked. They are absent from `SORTABLE` on the service and marked `enableSorting: false` on the columns. Ordering by importance needs a rank column beside the name; nothing has needed one yet.

**`tasks:write` is not ownership-scoped, and it is not meant to be.** Any account holding it may edit or reassign anybody's task, and the seed grants it to `USER` — because without it somebody cannot tick their own task done, which is most of what a task list is for. Narrowing *which rows* that reaches is a different layer's job: `tasks` is the first resource under **row-level security** (below), so a scope decides which tasks a role can see and write, while this code decides whether the endpoint answers at all. Folding the two together would mean a permission code per department.

The two foreign keys that describe the work now (`assignee_id`, `department_id`) are `RESTRICT` like the rest of the schema. `created_by_id` is `ON DELETE SET NULL`, which is the exception: who filed a task is worth keeping, but not worth refusing to delete a leaver's account over, and unlike the assignee nothing is waiting on it.

### Row-level security

Two layers of authorisation, in series, answering different questions. The resource permission decides *may you call `GET /api/tasks` at all* — `@PreAuthorize`, reading `AuthorityCache`, refusing with `403`. The row-level scope decides *within `tasks`, which rows* — a `Specification` folded into the query, refusing by the row simply not being there, which surfaces as `404`.

Without `tasks:read` the second layer is never reached. With `tasks:read` and an empty scope you get an empty list, and that is the correct answer rather than a fault.

**One vocabulary, no mapping table.** A policy names a `resource` (verbatim, as `app/resources/index.tsx` and the permission codes spell it), one of the three `action`s the six Refine actions already collapse to, and — for a scope — a foreign key to `roles`. There is nothing in between to fall out of step, so a mistake is a foreign key error or a startup failure rather than a rule that silently applies to nothing.

#### Two kinds, and why they combine differently

|  | `SCOPE` | `FILTER` |
| --- | --- | --- |
| Attached to | one role | the resource — everybody |
| Answers | "which rows can this role reach" | "which rows may nobody touch" |
| Combined with | **`OR`** across the caller's roles | **`AND`**, always |
| Absent means | that role is not narrowed | no global restriction |

`SCOPE` unions because roles here are additive — `AuthorityCache` already unions their permission codes, so their data scopes have to union too. Someone holding both `MANAGER` (their department's work) and `USER` (their own) must see both. Intersecting would mean that **adding a role removes rows**, which nobody predicts and no administrator can reason about; `ScopeAlgebraTest` generates role sets to keep that from being re-introduced.

`FILTER` intersects and is attached to no role, because a prohibition tied to a role is escaped by not holding that role — and a role created tomorrow would not carry it at all.

```
VISIBLE = ( OR over the SCOPEs of the roles held )  AND  ( AND over every FILTER )
```

**There is no priority and no ordering.** An authorisation algorithm that depends on the order its rules were written in is one nobody can verify by reading it. A `FILTER` always wins because intersection always wins, not because it sorted first.

#### `defaultScope` is declared in code, and is a decision

`RowLevelPolicySet.defaultScope()` is mandatory — there is no implicit default, because this is a choice to be made at the moment a resource is brought under management, not something to inherit by forgetting. `FULL` means a role with no scope is not narrowed; `NONE` means it sees nothing.

`FULL` is what makes switching an **already running** resource on a no-op: nobody loses a row on the day it ships and no migration seeds a policy to keep it that way. That is exactly why `016` inserts no `row_level_policy` rows at all. The cost is that a role somebody forgot to write a policy for is unrestricted rather than empty — and the design does not hide that, it *renders* it: `GET /coverage` colours every such cell red and `/explain` says so in `warnings`. `NONE` is the destination for every resource, and the recommendation for a new one, because a forgotten policy then shows up as an empty screen somebody reports within the hour.

`tasks` ships on `FULL`. Moving it to `NONE` is one line in `TaskRowLevelPolicies` once the coverage grid has no red cells — and from then on `ADMIN` needs an explicit `{"all": []}` scope of its own.

#### Three-valued logic, and the one line of code it all rests on

A policy is **data, not a language**: `ScopeTree` is four node shapes (`all`, `any`, `not`, a leaf) over a closed operator set. Nothing in that grammar can call a method, construct a type or name a bean, which is what makes a table an administrator edits a configuration surface rather than an execution surface — and why no sandbox is needed, and therefore no switch to turn one off.

SQL evaluates a `WHERE` clause in three values and drops a row whose predicate is `NULL`. Java has two. Left unspecified, the in-memory evaluator would answer differently from the query — quietly, and on exactly the rows with a null foreign key. So `Tri` is specified rather than inherited, with one rule at both compilers:

> A row is accepted **only** when the result is `TRUE`. `UNKNOWN` is a refusal.

The consequence has to be explained to whoever writes a policy: `not(assignee.id = 42)` does **not** match a task with no assignee. Wanting that means writing the `isNull` branch out, and the condition builder offers to do it the moment a `not` lands on a nullable field.

**`PolicyCompiler` normalises every tree to NNF, and that is a security property rather than tidiness.** A condition on an association compiles to a correlated `EXISTS`, and `EXISTS` is two-valued — it never yields `UNKNOWN`. Leave a `not` wrapped around one and `NOT EXISTS (… WHERE d.id = t.department_id AND d.id = ?)` is *true* for a task whose `department_id` is null, so the row is shown. Three-valued semantics say `UNKNOWN`, so the evaluator refuses it, and the two compilers part company in the direction that leaks. After normalisation the `not` sits inside the subquery, which is empty for a null foreign key, and both refuse.

`CompilerAgreementTest` is the test that keeps them honest: same tree, same rows, the id set from SQL must equal the id set from the evaluator — over a fixture built specifically from negations, null foreign keys, null context values and empty sets. **Do not delete it.**

#### `EXISTS`, never a join

Every condition not on the root compiles to a correlated `EXISTS`. Four things fall out at once: there is no inner-versus-left join to choose wrongly (the trap `TaskSpecifications.relationSpec` has to carry a comment about simply cannot occur); rows are not multiplied, so `Page.getTotalElements()` and `X-Total-Count` stay accurate with no `distinct`; Spring Data's separate count query keeps its meaning; and it maps one-to-one onto what the in-memory evaluator does, which is what makes the two agreeable at all. The cost is a subquery on an indexed foreign key, which PostgreSQL generally rewrites into a semi-join.

The exception is `isNull` / `isNotNull` on a reference: those compile against the root's foreign key, because a subquery over the target table can never find a row whose own id is null.

#### `SecuredRepository` — the unsafe read paths do not exist

`TaskRepository` extends `SecuredRepository`, not `JpaRepository`. `findById`, `findAll()`, `findAllById`, `count()`, `existsById` and every derived query are therefore **not there to be called by mistake**; `JpaSpecificationExecutor` contributes only methods that take a `Specification`, so every read has to be handed a scope. Three write methods are added back by `SecuredRepositoryImpl`, which is registered globally through `@EnableJpaRepositories(repositoryBaseClass = …)` on the application class and contains **no authorisation logic at all** — filtering is the `Specification`'s job and checking a write is the service's.

An unrestricted read is still possible: declare a method on the sub-interface. That is a thing a reviewer sees, which is the opposite of calling one that was inherited. `SecuredRepositoryApiTest` asserts the absent methods are still absent.

#### `USING` and `WITH CHECK`

| Action | `USING` — the old state | `WITH CHECK` — the new state |
| --- | --- | --- |
| `read` | ✔ folded into `WHERE` | — |
| `write` / create | — (no row yet) | ✔ after `flush()` |
| `write` / update | ✔ | ✔ |
| `delete` | ✔ | — |

`WITH CHECK` is what stops a row being pushed **out of its own scope** — moving a task to another department to hide it from your own. Without it, `USING` alone is privilege escalation by laundering. It runs in memory on an entity already loaded, so it costs nothing.

**The two clauses are separate conditions, and `WITH CHECK` defaults to `USING`** — Postgres's model exactly. `row_level_policy.check_scope` is null almost always, and null is the safe answer: the same condition on both sides is the anti-laundering guarantee.

It has to be *separable* because the two clauses stop asking the same question the moment a policy is about **workflow state** rather than **ownership**:

- Over an ownership field (`department`, `category`, `createdBy`) they should match. "You may edit your department's work" applied to the saved row is precisely what stops a move to another department.
- Over a state field (`status`) they must not. "You may edit drafts" applied to the saved row also forbids *publishing* one — the field the rule is about is the field the work changes, so a single condition makes it immutable. The rule silently becomes "you may edit drafts, and never finish one".

That second case is not hypothetical; it is the first thing anybody writes. The admin screen therefore shows a second builder for `write` policies, defaulting to "apply the same condition to the saved record" and explaining in one sentence when to turn it off.

**`notCheckSafe` belongs to the check clause only**, and separating the clauses is what made that precise. A field whose value appears at flush is perfectly usable in `USING`, which only ever runs against a row already loaded from the database; it is the check on a freshly created row that would read a value that is not there yet.

**On create it must run after `flush()`.** Before that the identity key is null and `@PrePersist` has not run, so a harmless-looking policy such as `createdAt >= today` would refuse every insert. Throwing afterwards is safe — the exception marks the transaction rollback-only — and the wasted insert is worth it for a case meant to be rare. Two layers cover this: `notCheckSafe` refuses a `write` policy naming such a field *when the policy is saved*, with the reason spelled out, and the post-flush check catches anything a database default supplies that nobody listed.

`delete` reads through `Action.DELETE` rather than reusing the read scope: somebody may be allowed to see a row without being allowed to remove it.

A refusal is **`422`**, not `403` or `404` — the row does exist for this caller and the request is meaningful; what is refused is the target state. The message names the *field and the value* that were refused, and never the policy behind them: echoing back what the writer just chose tells them which change to undo, while the rule that refused it belongs to whoever may read policies. *"Your data scope does not allow `status` to become `PUBLISHED`"* ends an investigation that *"the status field puts this record outside your data scope"* only starts.

#### Cache, propagation, and the version stamp

`RowLevelPolicyCache` is `AuthorityCache`'s shape exactly — the same events, the same `PostgresEventBus`, the same 60-second backstop that nothing should ever need. It loads the **whole** table (tens of rows), compiles all of it, and publishes one immutable snapshot behind a `volatile` reference, so invalidation is "load again, swap the pointer" with no partial eviction to be subtly wrong. `RowLevelPolicyChannel.Received` is a distinct type from `RowLevelPoliciesChanged` for the usual reason: without it two nodes would notify each other forever.

**The stamp travels inside `X-Auth-Version`, so no new header exists to forget.** `RowLevelPolicyCache` implements `RowLevelGeneration` (an interface in `shared/`), and `AuthorityCache` folds that string into the per-account stamp it already sends on every response. The dependency runs one way; reversing it is the cycle that forced `token/` into its own slice. A policy edit therefore reaches an open tab down the path that already existed — the socket push, or the header on the next request — with nothing added to `Access-Control-Expose-Headers`.

`RowLevelAuthoritySync` is what closes that loop, and its `@Order(2)` is load-bearing: it republishes a policy change as `AuthoritiesChanged.ForEveryone` *after* the policy cache has reloaded at `0` and the channel has broadcast at `1`. Going first would push grants whose stamp was computed from the policy set being replaced. It is blunt on purpose, for the same reason `ForEveryone` is: working out whose scope actually moved means reading the user table from in here.

**`RowLevelPrincipal` is not frozen at login.** It is built per request from the authority cache entry that authorised the request a moment ago — placement and role ids now travel on `AuthorityCache.Entry` — so it costs no query, and somebody moved to another department at lunchtime is scoped to the new one on their next request. That is why `UserService.update` now publishes `AuthoritiesChanged.ForUser` when `organization` or `department` moves, not only when roles or status do.

#### Two levels of checking, leaning opposite ways

**Metadata is source code**, so a mistake in it stops the application: `RowLevelRegistry`'s constructor refuses duplicate resource names, duplicate context keys, and a policy set whose entity is not annotated; `RowLevelMetadataValidator` then checks every declared field against the JPA metamodel at `ApplicationReadyEvent`. Same spirit as `ddl-auto=validate` — a drifted declaration fails at startup, not at the first query.

**A runtime policy is data**, so it is refused hard when *saved* (`422`, naming the node at fault — the one moment somebody is present to fix it) and **quarantined** when loaded. Refusing to boot over one row would turn a configuration mistake into an outage, at some arbitrary later restart, with nobody able to connect the two events. A quarantined policy is disabled, has `invalid_reason` written to its row, gets a `QUARANTINE` audit entry, and turns `RowLevelHealthIndicator` **`DOWN`** with the reason — and it *stays* reported on every later load, because an alert that disappears at the next restart is one nobody ever acts on. Re-enabling it without fixing the condition is refused rather than silently undone.

**The direction of quarantine depends on the kind, and this is the detail easiest to get wrong.** A broken `FILTER` that stops applying makes a prohibition *disappear*, which is a data leak — so quarantining one **also blocks its entire `(resource, action)`** until somebody fixes it. Losing the screen loudly is a worse day; leaking is a worse year. A broken `SCOPE` needs no such treatment: under `NONE` it stops widening anybody, which fails closed.

**Under `FULL` it does not fail closed, and that is worth saying plainly.** Disabling the only `SCOPE` a role had leaves that role with no scope at all — which under `FULL` means *unrestricted*. It is the same cost `FULL` charges everywhere else, and the same reason the coverage grid colours those cells; quarantine is still the right answer, because the alternative is a node that refuses to start. It is one more reason `FULL` is a migration setting rather than a destination.

**A resource this node does not know is not a broken policy, and must never be quarantined.** This is what makes a rolling deploy safe. While a new version is going out, the old nodes have no `RowLevelPolicySet` for a newly managed resource. If they treated that as a compile failure they would write `enabled = false` into the *shared* table — disabling the policy for every node including the new ones, and leaving it disabled long after the deploy finished. Combined with the paragraph above, the safety mechanism would be the leak. A node that does not know a resource cannot serve it under management either, so the policy is simply irrelevant there: it is skipped, logged at `WARN`, and the row is left untouched. Health stays `UP`, because otherwise every old node reports `DOWN` for the whole deploy window.

#### Design-time and runtime

| | Design-time | Runtime |
| --- | --- | --- |
| Lives in | a `RowLevelPolicySet` bean, in version control | `row_level_policy`, edited through the UI |
| For | business invariants; `FILTER`s; rules a `@PreAuthorize` depends on | organizational scope, which changes when the company does |
| Expressed as | a plain `Specification<T>` **and** a matching `TriPredicate` | a `ScopeTree` over a closed vocabulary |
| Editable / disablable | no | yes, with an audit trail |

This is where "policies must be expressive" and "policies must not be an execution surface" stop conflicting: full expressive power lives where it is *code* — reviewed, tested, deployed alongside whatever depends on it — and a closed vocabulary lives where it is *data*. A design-time policy must supply **both** halves, because nothing can generate one from the other, and it owes the cross-check test that runtime policies get for free. Both kinds land in the same two lists inside `EffectiveScope`, so the algebra does not know which is which.

#### Operating it

Four read-only endpoints, and they are what make the feature operable rather than merely correct. `/metadata` feeds the condition builder (and is why that screen has no expression box). `/explain` answers "which rule is doing this", naming the source of each rule and rendering it in its **compiled** form — the normalisation is the part most likely to surprise whoever wrote it. `/simulate` answers "why can this person not see that record" **in three values**, because `UNKNOWN` is both the commonest answer and the one nobody guesses; it is almost always a null foreign key (a `created_by_id` that went null when its owner left) turning a branch unknown. `/coverage` is the role × action grid that turns a policy gap from an invisible default into a red cell.

`/explain` and `/simulate` take somebody else's account id, so they require `users:read` **on top of** `row_level_policies:read` — simulating another person's access is reading about another person.

`RowLevelSecurity.asSystem(name, work)` is the explicit bypass, for a deliberate skip while somebody *is* signed in. It logs at `INFO` with the task's name and increments `rowlevel.bypass{task=…}`: in production a `DEBUG` line is the same as no line at all, and a request that skipped row-level filtering is the last thing that should leave no trace. Work with no authenticated caller at all — startup, the sign-in flow, scheduled jobs — already gets the full scope without asking, which is also what stops the principal resolver recursing if `users` is ever brought under management.

#### What each row and payload carries

Every task row carries `_can`, computed as `USING ∧ WITH CHECK` **on the state the row is in now** — the precise answer a button needs: "you may open the edit form, as long as you do not push this out of your scope". Reporting `USING` alone would render an Edit button that always ends in a `422`. `app/providers/access-control.ts` reads it, so `hideIfUnauthorized` hides Edit and Delete on exactly the rows where they would be refused. Flags are **not emitted** when an association a policy needs was not fetched: better a missing flag than a silent N+1.

`GET /auth/permissions` carries `scopedResources`, and it exists to answer one question. Somebody with `tasks:read` and a narrow scope sees exactly what a system with no data looks like — so the empty table says *"No records fall within your data scope"* instead of leaving them to guess. One field, one sentence, and a support ticket that never gets raised.

Embedded summaries are masked through `EntityEvaluator`: a row-level scope filters the **root** of the resource being served and does not follow into the summaries hanging off it, so a task a manager can see could otherwise carry the name of somebody they may not look up. `TaskResponse.summarize` asks `canRead`, which answers `true` for anything unmanaged and so costs nothing today.

#### Adding a resource

Five things, and the first four are the whole of it: annotate the entity `@RowLevelResource("name")`; add a `RowLevelPolicySet` bean in that feature's slice declaring `defaultScope()` and the closed field set; change its repository to `SecuredRepository`; route the service's reads through `rowLevel.scope(...)` **before** the caller's filters (`Specification.and` has no subtraction, so no query string can widen it) and its writes through `checkWritable`. Then seed nothing — `defaultScope = FULL` means the switch is a no-op — and watch the coverage grid until it is safe to move to `NONE`. Add the controller's `rowLevel` argument too, or the rows go out without `_can` and every button is offered on every row.

Under management today: `tasks`, `blog_posts`, `categories`, `organizations`, `departments`. Not `users` or `roles`, and not by oversight — both sit *inside* the authority cache's own dependency graph, so scoping them means deciding what happens when resolving who you are requires reading a row you may not be allowed to read. `notifications` is already scoped to its recipient by a deliberate, simpler mechanism, and `permissions` is a read-only catalogue written by migrations.

**The bean cycle you will hit, once.** `RowLevelSecurity` is infrastructure every feature calls, and the auth chain is itself made of features: `AuthorityCache → UserService → OrganizationService → RowLevelSecurity → RowLevelPrincipalResolver → AuthorizationService → AuthorityCache`. It did not appear while `tasks` was the only managed resource, because `TaskService` is a leaf nothing in that chain depends on. It appears the moment a resource *inside* the chain is managed. The cycle is about construction order only — authentication itself is never scoped, because it runs before a principal exists and `scope` answers the full scope when there is none — so it is broken in one place, `RowLevelPrincipalResolver`, which looks `AuthorizationService` up through an `ObjectProvider`. Fixing it there rather than at each call site is what stops the next feature rediscovering it.

### What is deliberately not built yet

**The other three real-time features.** Permissions already ride the channel (`/user/queue/auth`). Live dashboards and streamed job logs are one-way and straightforward now that it exists — for logs, batch or throttle server-side rather than pushing every line. Presence and record locking are last on purpose: the only one of the four that genuinely needs the *bidirectional* half, and the only one needing state shared between nodes. Redis is the likely convergence point, and once it is there it can also replace `PostgresEventBus`.

**Row-level security beyond `tasks`.** The engine is resource-agnostic; every other resource joins by annotating its entity, declaring a `RowLevelPolicySet`, and switching its repository to `SecuredRepository` — the last of which is the only change with any reach, because it is what removes the unscoped read methods and forces the service's reads through a scope. `tasks` is on `DefaultScope.FULL`, which is the migration setting rather than the destination; moving it to `NONE` is one line once the coverage grid is clear, and `ADMIN` then needs an explicit `{"all": []}`. Postgres's own `CREATE POLICY` was considered and not used — it needs `SET LOCAL` on every transaction on a pooled connection (one missed spot is a policy that does not apply, silently), it would mean a second copy of every rule in SQL, and Hibernate's caching and batch fetching do not know about it. The joining path is left open, though: the set of `RowLevelContextProvider`s is exactly the set of variables that would be pushed down as session GUCs.

**Cheap wins left on the cold path.** `AuthorityCache.load` fetches the whole `User` graph, so a miss returns |roles| × |permissions| wide rows; a projection (`select distinct p.code from User u join u.roles r join r.permissions p where u.id = :id`) would return only the codes. `/auth/me` still resolves the user twice, once in the converter and once in `AuthService.currentUser()`; `/auth/permissions` no longer does, being served from the cache. Both only affect requests that miss the cache, which is why neither is urgent.

### Theming — the token system is the design system

No component holds a colour of its own. Five orthogonal knobs live as state on `<html>` and are persisted to `localStorage`:

| Setting | Attribute | Values | Default |
| --- | --- | --- | --- |
| Mode | `class="dark"` | light / dark / system | system |
| Brand colour | `data-color-preset` | navy, blue, indigo, violet, emerald, teal, rose, orange, amber, slate | navy |
| Corner radius | `data-radius` | none / sm / md / lg / xl | md |
| Sidebar tone | `data-sidebar-tone` | dark / light | dark |
| Density | `data-density` | compact / comfortable / spacious | comfortable |

The chain: `src/styles/theme.css` declares a handful of raw OKLCH numbers per preset and derives every semantic token from them → `src/styles/index.css` bridges those tokens into Tailwind v4 via `@theme inline` → components only ever use `bg-primary`, `text-success`, `shadow-e1..e4`, etc. Density works the same way: it rescales Tailwind's base `--spacing` unit, so every `p-*`/`gap-*`/`h-*` utility tightens or loosens the whole shell with no per-component overrides.

**Three places must stay in sync** — `src/styles/theme.css` (the preset block), `src/shared/lib/theme.ts` (the union type plus `COLOR_PRESETS`/`STORAGE_KEYS`/`DEFAULTS`), and the inline bootstrap script in `index.html` (the allow-list, which replays the saved theme before first paint to avoid a flash). Omitting the third makes the setting silently reset on reload.

Read or change theme state anywhere with `useTheme()` from `shared/components/theme/theme-provider.tsx`. `ThemeProvider` wraps the whole app in `App.tsx`, not the `Layout`, so the unrouted auth screens would be themed too.

**A status is four tokens, not one, and that is the part most easily undone.** `success`, `warning`, `info`, `destructive` and `neutral` each carry a fill (`--x`), the text that sits *on* that fill (`--x-foreground`), a wash (`--x-subtle`), and the label that sits on the wash (`--x-text`). One value cannot do all three jobs: a solid fill under white text is the right answer for a button and the wrong one for a column of forty status chips, which is why `Badge`'s status variants are all the subtle family and `default` — the one solid — is the exception. The alternative that keeps reappearing is `bg-success/10 text-success`, and it is worse than it looks: an alpha wash takes its colour from whatever is behind it, so the same chip comes out one colour on a card and another on a hovered row.

Beyond that: `--surface-subtle` (the step off the card, for the one strip in a panel that is a different zone — the table's header band, a form's save bar; the filter zone and the pager sit on the card itself, so a list panel reads as one sheet with one strip across it rather than three stacked blocks), a fixed `gold-300..600` ramp, a five-step chart ramp rotated off the brand hue, `--primary-hover` (a real colour, so a solid button hovers the same on every surface), and four elevations as `shadow-e1`…`shadow-e4`.

**Gold does not follow the preset, and that is deliberate.** It is not the brand hue; it is the seal on the letterhead, and it appears in three places only — the brand mark, the marker on the active nav row, and the `gold` badge variant. A deployment that picks `rose` still gets a gold seal. On the light rail `--sidebar-primary` reverts to the brand colour, because a gold pill on white cannot carry white text.

**The typeface is Inter Variable, and it ships inside the bundle.** `--font-sans` in `styles/index.css` is `"Inter Variable", ui-sans-serif, system-ui, …`, and the font itself comes from `@fontsource-variable/inter`, imported once in `App.tsx`. The import is the half that is easy to lose: a font name with no `@font-face` behind it only takes effect on machines where somebody happened to install the font, and falls back to Segoe UI everywhere else, with nothing in the build to say so. Self-hosting rather than linking Google Fonts means no request to a third-party host and nothing to fail on a closed network.

**`text-overline` is the one small-caps style** — 11px, uppercase, semibold, tracked out — and it is a utility rather than four declarations copied into each place that needs a label: table headers, sidebar section headings, the caption over a field group. A new screen that needs a group label gets the right one by name instead of inventing an eleventh size.

**It also has to be registered with `tailwind-merge`, in `src/shared/lib/utils.ts`.** `tailwind-merge` resolves conflicts from a table of class groups it ships with; a custom utility is not in it, so it guesses from the prefix — and `text-overline` looks exactly like `text-<size>`/`text-<colour>`. `cn("text-overline", "text-muted-foreground")` therefore *dropped the overline*, silently, leaving every table header looking like body text with nothing wrong in the source and nothing missing from the stylesheet. `cn` is built with `extendTailwindMerge` for that reason; any future custom utility whose name starts with a Tailwind namespace belongs in the same list.

**A list screen is a header and a panel**, and it is the same on all ten. `ListViewHeader` carries the breadcrumb, the title, a one-line `description` and the action cluster. Everything else goes *inside* `DataTable`: `ListToolbar` (`search` on the left taking the room, `actions` against the right edge) and `DataTableFilterChips` are passed to its `toolbar` prop rather than rendered as siblings above it, because the panel is drawn inside `DataTable` and a toolbar outside it is a floating control belonging to nothing — the search narrows *this* table, so it sits on the same sheet as the rows it narrows. One panel, three zones divided by hairlines: filters, rows, pager.

`ListToolbar` has three zones and the split is the point: `search` takes the room, `filters` (the advanced filter) sits immediately beside it because narrowing a table is the same job as searching it, and the right edge carries the controls that act on the table *as a whole*. Pass `table` and those three come for free on every list — **Refresh**, **Columns**, **Export** (`data-table-actions.tsx`) — with `actions` reserved for the one-off beside them, like Notifications' "Mark all read". Right-alignment is `sm:ms-auto`, not `ms-auto`: wrapped, it would strand the controls against the right edge on their own line. `DataTableQuickFilter` carries no width of its own; the row decides.

Three things about that cluster:

- **Refresh is not the `RefreshButton` the detail screens use.** That one is built on `useRefreshButton`, which invalidates a *record* and needs an id. A list has no id — it has a query with the current filters, sorters and page already in it, so refetching that query is the whole operation. It spins on `isFetching`, not `isLoading`: the latter is only true on the first fetch, so refreshing data already on screen would give no sign it had happened.
- **Hiding a column has to reach three places, not one.** `DataTable` reads `getVisibleLeafColumns()` for the loading skeleton and for the empty row's `colSpan`; on `getAllLeafColumns()` the skeleton renders more cells than the header has and the "no data" cell spans past the last column. The actions column is excluded from the menu — it is not data, and hiding it takes the row's controls away with nothing to say where they went.
- **Export is two different operations.** *This page* is the rows already in the browser, through the visible columns in their current order, and costs no request. *All rows* goes back through `useExport`, page by page, carrying the current filters and sorters — and therefore through the same endpoint, so a row-level scope still applies. Both write the stored value rather than the rendered one (`2024-03-04`, not "Mar 4, 2024"), because a CSV is opened in a spreadsheet where a real date sorts and a formatted one is a string. `mapData` drops `_can`: it is the row-level flag object the UI reads to decide which buttons to offer, and in a spreadsheet it is a column of `[object Object]`.

**Every sortable column draws its own affordance, from `DataTable`.** `enableSorting: true` on a column now produces a clickable header with a `⇅` that becomes `↑`/`↓`, plus `aria-sort` on the `th`. Before this, ten lists declared sortable columns and *none of them could be sorted* — `DataTableSorter` existed and was imported by nothing, so the flag was inert and there was no affordance to notice was missing. Two things about the header button: it uses `getToggleSortingHandler()` (which honours shift-click multi-sort and cycles asc → desc → unsorted), and it restates `text-overline` on itself, because Tailwind's preflight resets `text-transform` on `button` and a sortable column otherwise comes out in sentence case beside its unsortable neighbours.

**A `*View` is a wrapper, not a panel.** A full-page form wraps its fields in `FormPanel` and its buttons in `FormActions` (`shared/components/form/form-panel.tsx`) — everything else on a screen is in a panel, and a form left loose on the page background is the one place where the boundary of the work is invisible. The dialog forms (`blog_posts`) deliberately do not use it: a dialog is already a panel.

**Dates go through `src/shared/lib/format.ts`.** `formatDate` and `formatDateTime` fix the *shape* and leave the *language* to the browser's locale. Two locally-written formatters had a detail card showing `Aug 23, 2026` two rows above `8/31/2026, 4:00:24 PM`.

Print is handled once, in `styles/index.css`: the rail, the sticky bar and every action cluster carry `data-print="hide"` and come off the page, leaving the record on white A4 with table headers repeating per page.

## Backend architecture

Feature-first, with the entity model lifted out into one central `domain/` tree that is itself split the same way:

```
com.dth.frw
├── config/                    WebMvcConfig (CORS), SecurityConfig (filter chain, JWT beans),
│                              WebSocketConfig (STOMP endpoint and broker)
├── shared/
│   ├── web/                   ListParams, ListResponse
│   ├── messaging/             PostgresEventBus — LISTEN/NOTIFY between nodes
│   ├── exception/             ApiExceptionHandler, ResourceNotFoundException, ConflictException
│   ├── data/                  SecuredRepository (no findById), SecuredRepositoryImpl
│   └── security/              Permissions, JwtService, JwtProperties, CurrentUser,
│       │                      RestAuthenticationEntryPoint, AuthoritiesChanged
│       └── rowlevel/          what a feature implements or annotates: RowLevelResource,
│                              RowLevelPolicySet, FieldDescriptor, ScopeTree, Op, Tri,
│                              Action, DefaultScope, RowLevelContextProvider,
│                              RowLevelPrincipal, RowLevelGeneration, TriPredicate,
│                              RowLevelViolationException, PolicyValidationException,
│                              RowLevelPoliciesChanged
├── domain/                    every @Entity lives here, grouped by area then feature
│   ├── bpm/
│   │   └── task/              Task, TaskStatus, TaskPriority
│   ├── catalog/
│   │   ├── organization/      Organization, OrganizationStatus
│   │   └── department/        Department, DepartmentStatus
│   ├── system/
│   │   └── notification/      Notification, NotificationLevel
│   ├── example/
│   │   ├── blogpost/          BlogPost, BlogPostStatus
│   │   └── category/          Category
│   └── security/
│       ├── user/              User, UserStatus
│       ├── role/              Role
│       ├── permission/        Permission
│       ├── rowlevel/          RowLevelPolicy, PolicyKind, RowLevelPolicyAudit
│       └── token/             RefreshToken
└── module/                    one slice per feature: api/ (+ dto/) · service/ · repo/
    ├── example/
    │   ├── blogpost/          BlogPostController, BlogPostService, BlogPostRepository,
    │   │                      BlogPostSpecifications
    │   └── category/          same shape
    ├── bpm/
    │   └── task/              TaskController, TaskService, TaskRepository,
    │                          TaskSpecifications — reaches users, departments and
    │                          notifications through their services
    │       └── security/      TaskRowLevelPolicies — what a policy on tasks may say.
    │                          Implements an interface from shared/, so this slice
    │                          never has to know the policy engine exists
    ├── catalog/
    │   ├── organization/      OrganizationController, OrganizationService,
    │   │                      OrganizationRepository, OrganizationSpecifications
    │   └── department/        same shape; reaches organizations through
    │                          OrganizationService, never its repository
    ├── system/
    │   └── notification/      NotificationController, NotificationService,
    │                          NotificationPublisher, NotificationRepository
    └── security/
        ├── user/              UserController (+ /{id}/password), UserService, UserRepository
        ├── role/              RoleController, RoleService, RoleRepository
        ├── permission/        PermissionController (read-only), PermissionService
        ├── rowlevel/          RowLevelPolicyController, RowLevelSecurity (the facade
        │                      every feature calls) + Impl, RowLevelPolicyService,
        │                      RowLevelPolicyInsights (metadata/explain/simulate/
        │                      coverage), RowLevelPolicyCache, RowLevelPolicyChannel,
        │                      RowLevelRegistry, PolicyCompiler, PredicateCompiler,
        │                      EntityEvaluator, ScopeTreeCodec, ScopePlan,
        │                      RowLevelPrincipalResolver, RowLevelMetadataValidator,
        │                      RowLevelAuthoritySync, RowLevelHealthIndicator
        ├── token/             RefreshTokenService — issue, rotate, revoke
        └── auth/              AuthController, AuthService, AuthorizationService,
                               AuthorityCache, AuthorityChangeChannel,
                               AuthorityChangePublisher, AuthVersionAdvice,
                               StompAuthChannelInterceptor (no repo of its own)
```

The entities are central because they are the one thing several features legitimately share — `BlogPost` holds a `@ManyToOne Category`, `Department` a `@ManyToOne Organization`, `User` a `@ManyToMany Role` — and no single feature owns those relations. Everything *else* stays inside its feature slice.

Two rules keep the slices from bleeding into each other, and both are easy to break by reflex:

- **A feature reaches another feature through its `service/`, never its `repo/`.** `BlogPostService` resolves a category via `CategoryService.get(id)`, `UserService` resolves roles via `RoleService.resolveAll(ids)` — which also means an unknown id produces the same 404 that resource's own endpoints would.
- **A feature does not import another feature's `api/dto/`.** `BlogPostResponse` declares its own nested `CategorySummary`, `UserResponse` its own `RoleSummary`, even where they are shape-identical today, so widening one endpoint's payload cannot silently widen the other's.

`token/` exists as its own slice rather than inside `auth/` for a concrete reason: `UserService` needs it too, because disabling an account or resetting its password has to end the sessions already open under it. Splitting it is what lets both `AuthService` and `UserService` depend on it without depending on each other — a cycle Spring would refuse to construct.

Where a check would need to cross a slice, the database answers instead. Deleting a role that users still hold is refused by the `RESTRICT` foreign key on `user_roles`, not by a count query in `RoleRepository`, because counting users from inside the role feature would mean reading the user feature's table directly. Deleting an organization that still has departments is refused the same way. `ApiExceptionHandler` turns both into the same 409 a category still in use produces.

**A user's placement is the fullest example of that, because the rule spans two tables.** `users` carries both `organization_id` and `department_id`, and the invariant is that the department belongs to that organization. It is held by a composite foreign key — `users (organization_id, department_id)` onto `departments (organization_id, id)`, which is why `departments` carries an otherwise-redundant unique constraint on that pair — rather than by code, and that buys three things at once: the two columns cannot disagree whoever writes them; moving a department to another organization while somebody is still in it is refused instead of silently stranding those accounts across company lines; and the department feature never has to read the user table to work any of that out. `UserService.resolvePlacement` checks the same pair before writing, but only to raise a message naming the organization and the department rather than a constraint.

A composite foreign key defaults to `MATCH SIMPLE`, which skips the check whenever *any* column is null. That is what makes "in an organization, in no department" legal — and it makes "in a department, in no organization" legal too, which is nonsense, so a `CHECK` closes it. `MATCH FULL` would close the second and forbid the first.

Placement is also where the patch contract needed a third state. Elsewhere a null field means "leave it unchanged", but a placement has to be clearable, and Jackson reports an omitted object and an explicit `null` identically. So `OrganizationRef` and `DepartmentRef` in the user slice carry a **nullable** id: absent leaves the field alone, `{"id": null}` clears it, `{"id": n}` sets it. Clearing the organization clears the department with it, and a department sent with no organization beside it supplies its own.

**A conflict check has to run before the entity is mutated, not after.** `DepartmentService.update` resolves the destination organization and the new code into locals, checks them, and only then writes to the entity. Doing it the other way round — set the organization, then query for a clash — lets Hibernate auto-flush the update ahead of the query, so the unique index raises the violation first and the caller gets the generic "still referenced by other records" 409 instead of a message naming the organization and the code. Both are 409s and both refuse the write, which is exactly why the wrong order survives a test that only checks the status.

Spring finds everything by scanning down from `DthFrameworkApplication`, so entities, repositories and controllers need no explicit `@EntityScan`/`@EnableJpaRepositories` despite living in separate trees.

### The API contract is the data provider's dialect

Nothing generates the endpoints from the frontend or vice versa, so the shape below is the contract, and both sides have to be changed together.

| Refine method | Request | Notes |
| --- | --- | --- |
| `getList` | `GET /{resource}?_start=&_end=&_sort=&_order=&{field}{op}=` | body is a **bare JSON array**; the unpaged total goes in `X-Total-Count` |
| `getMany` | `GET /{resource}?ids[0]=&ids[1]=` | bracket form comes from `qs`, so Spring cannot bind it to a `List` — same endpoint, answered unpaged |
| `getOne` | `GET /{resource}/{id}` | |
| `create` | `POST /{resource}` | |
| `update` | `PATCH /{resource}/{id}` | `PUT` is mapped to the same handler |
| `deleteOne` | `DELETE /{resource}/{id}` | **must return a body** — the provider parses one |

Filter operators arrive as a suffix on the field name: `_ne`, `_gte`, `_lte`, `_like` (from `contains`), or no suffix for equals. `q` is the quick filter's full-text term. `shared/web/ListParams` parses all of that; each feature's `*Specifications` class turns it into predicates.

Three things break quietly if changed:

- **The path segment is the resource name verbatim** — hence `/api/blog_posts`, underscore included, matching `app/resources/index.tsx`.
- **`X-Total-Count` and `X-Auth-Version` must stay in `Access-Control-Expose-Headers`** (`config/WebMvcConfig`). Neither is CORS-safelisted, so without them the browser hides the header — and the failure is silent both times, looking like a feature that was never built: every list renders as one page of zero, and a permission change never reaches an open tab.
- **Every error response needs a JSON body** (`shared/exception/ApiExceptionHandler`), because the provider calls `response.json()` on any non-2xx. An empty error body surfaces as an unparseable-response error instead of the real message.

Unknown filter fields and unknown sort properties are ignored rather than rejected: a sort property goes straight into a query, and a 400 on a filter would blank the table instead of merely failing to narrow it.

Resources answering that dialect today: `blog_posts`, `categories`, `tasks`, `organizations`, `departments`, `users`, `roles`, `permissions` (read-only), `notifications` (list and delete only, always scoped to the caller), `row_level_policies`.

`row_level_policies` speaks the dialect like any other, and hangs four read-only endpoints off it that are not part of it — `GET /metadata`, `GET /explain`, `POST /simulate`, `GET /coverage`. They are declared before `/{id}` on the controller so the literal paths win over the path variable. `explain` and `simulate` require `users:read` on top of `row_level_policies:read`, because they take somebody else's account id.

**`/api/auth/*` is not part of it.** Those endpoints are the *auth* provider's contract, not the data provider's, and their shapes are their own:

| Endpoint | Auth | Body in / out |
| --- | --- | --- |
| `POST /api/auth/login` | open | `{username, password}` -> `{accessToken, refreshToken, tokenType, expiresIn, user}`; `username` accepts an email too |
| `POST /api/auth/refresh` | open | `{refreshToken}` -> the same token pair. The token sent is burned either way, so the client must store what comes back |
| `POST /api/auth/logout` | open | `{refreshToken}` -> `{success: true}`, always — signing out has to work from a client whose token is already dead |
| `GET /api/auth/me` | any signed-in user | the identity — `{id, username, email, fullName}`, re-read from the database rather than from the token. Identity only; no roles, no permissions |
| `GET /api/auth/permissions` | any signed-in user | `{roles, permissions, version, scopedResources}` for the caller. The separate call that pays for the small token. `version` is the same stamp `X-Auth-Version` carries, in the body so that the live channel — which has no headers — can deliver the identical payload. `scopedResources` names the resources a row-level policy narrows for this account, so a list that comes back empty can say why |
| `POST /api/auth/change-password` | any signed-in user | `{currentPassword, newPassword}` -> a fresh token pair, because the change ends every *other* session |
| `POST /api/users/{id}/password` | `users:write` | `{password}` -> the user. An admin setting someone else's password; ends every session under that account |

Setting a password is a separate endpoint rather than a field on the user payload on purpose: it revokes sessions, and folding that into a profile save would sign someone out over a corrected surname.

### Schema and data are Liquibase's, not Hibernate's

`spring.jpa.hibernate.ddl-auto=validate` — Liquibase owns the schema and Hibernate only checks that the entities still agree with it, so a drifted mapping fails at startup rather than at the first query. A new migration goes in `db/changelog/changes/` and gets registered in `db.changelog-master.yaml`. Changeset `003` seeds demo content; `004` creates the identity tables and `005` seeds permissions, the three system roles and the development accounts; `006` creates `notifications` and `007` seeds its two permissions; `008` adds `permissions.system_permission` — the mirror of `roles.system_role`, marking a code that arrived in a migration alongside the `@PreAuthorize` that checks it — and backfills every code seeded so far as one; `009` creates `organizations` and `departments` and `010` seeds their six permissions, the role grants and demo rows; `011` adds `users.organization_id` and `users.department_id` with the composite foreign key and `CHECK` that keep the pair honest, and `012` places the three development accounts; `013` creates `tasks` and `014` seeds its three permissions, the role grants and demo rows; `015` creates `row_level_policy` and its append-only audit table, and `016` seeds only the three `row_level_policies:*` codes and grants them to `ADMIN` alone — **no policy row is seeded, deliberately**, because each resource declares its own `DefaultScope` in code, so switching a running resource on is a no-op with nothing to keep in step. A permission added after `005` is granted to **nobody** until a migration says so, including ADMIN: `005` gave ADMIN every permission that existed *when it ran*, which is a join over rows that did not yet exist. `010` therefore names ADMIN explicitly, as `007` did. Seed data joins by natural key — categories by title, organizations by code, roles and permissions by code, users by username — rather than by hardcoded id, because every id column is an identity and pinning ids would leave its sequence behind so that the first insert from the application collides.

The datasource points at `localhost:5433/dth-framework`; override with the usual `SPRING_DATASOURCE_*` environment variables rather than editing `application.properties` per machine.

