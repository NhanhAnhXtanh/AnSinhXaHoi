--liquibase formatted sql

--changeset dth:003-seed-content
--comment Demo content so the admin dashboard has something to page, sort and filter.

INSERT INTO categories (title) VALUES
  ('Architecture'),
  ('Frontend'),
  ('Backend'),
  ('DevOps'),
  ('Design System'),
  ('Security'),
  ('Performance'),
  ('Testing');

-- Categories are referenced by title rather than by a hardcoded id: the id
-- column is an identity, so pinning ids here would leave its sequence behind
-- and the first insert from the application would collide.
INSERT INTO blog_posts (title, content, status, category_id, created_at)
SELECT v.title, v.content, v.status, c.id, v.created_at
FROM (VALUES
  ('Resources and routes are two halves of one declaration',
   'Refine infers the current resource from the URL, which is what lets useTable, useForm and the *Button components work without being told which resource they operate on. Adding a resource therefore means editing both the resources array and the matching Route entries.',
   'PUBLISHED', 'Architecture', TIMESTAMP WITH TIME ZONE '2024-02-11 09:15:00+00'),
  ('Why the dialog is the route, not a piece of list state',
   'Nesting create, edit and show under the list route keeps the list mounted, so filters, sorting and pagination survive while the outlet renders the open dialog. Every dismissal path navigates back with a replace, which keeps the browser history clean.',
   'PUBLISHED', 'Architecture', TIMESTAMP WITH TIME ZONE '2024-03-04 14:02:00+00'),
  ('Layering stock primitives under a framework-aware shell',
   'Generated primitives stay regenerable only if nobody hand-edits them. Project behaviour belongs one layer up, where it survives the next regeneration.',
   'PUBLISHED', 'Architecture', TIMESTAMP WITH TIME ZONE '2024-06-21 11:40:00+00'),
  ('A first pass at modular monolith boundaries',
   'Package-by-feature keeps the seams visible without paying the operational cost of separate deployables. Draft: the section on cross-feature reads still needs a worked example.',
   'DRAFT', 'Architecture', TIMESTAMP WITH TIME ZONE '2025-09-02 08:30:00+00'),

  ('Column resizing that remembers what a default width meant',
   'Resizing is opt-in per column. A double-click on the divider goes back to the column default, which only works if the default is stored rather than recomputed from the current layout.',
   'PUBLISHED', 'Frontend', TIMESTAMP WITH TIME ZONE '2024-04-18 16:20:00+00'),
  ('Debouncing the quick filter without dropping the last keystroke',
   'Writing through the table column filters rather than the core keeps a single source of truth: the table rebuilds core filters on every change and drops anything it does not know about.',
   'PUBLISHED', 'Frontend', TIMESTAMP WITH TIME ZONE '2024-08-27 10:05:00+00'),
  ('Four labelled buttons made the widest column the least informative',
   'Icon-only actions with tooltips and aria-labels reclaimed a third of the table width. The label did not disappear, it moved.',
   'PUBLISHED', 'Frontend', TIMESTAMP WITH TIME ZONE '2025-01-14 13:55:00+00'),
  ('Submitting a form from outside the form element',
   'When the submit button lives in a dialog footer it sits outside the form. The HTML form attribute wires it back, which is cheaper than lifting the submit handler into a context.',
   'PUBLISHED', 'Frontend', TIMESTAMP WITH TIME ZONE '2025-05-30 09:45:00+00'),
  ('Notes on migrating the table to React 19',
   'Mostly uneventful. The ref-as-a-prop change removed a forwardRef layer from every wrapper. Still auditing the effect cleanup in the resize handler.',
   'DRAFT', 'Frontend', TIMESTAMP WITH TIME ZONE '2026-02-09 15:10:00+00'),
  ('Server components: an evaluation that went nowhere',
   'The admin shell is client-state heavy end to end. Rejected: the split would have bought nothing but a build-time cost.',
   'REJECTED', 'Frontend', TIMESTAMP WITH TIME ZONE '2025-11-19 12:00:00+00'),

  ('Speaking a REST dialect you did not design',
   'The data provider is the contract. It sends a start and end offset for the window, a sort field with an order for ordering, and a field with an operator suffix for each filter, and it reads the unpaged total from a response header.',
   'PUBLISHED', 'Backend', TIMESTAMP WITH TIME ZONE '2024-05-09 08:25:00+00'),
  ('Specifications beat a dozen optional query parameters',
   'Parsing the query string once and composing predicates keeps the controller down to a single request-parameter map, and makes an unknown filter field a no-op instead of a 400.',
   'PUBLISHED', 'Backend', TIMESTAMP WITH TIME ZONE '2024-07-16 17:30:00+00'),
  ('Patch semantics worth keeping honest',
   'The admin UI always sends the whole form, so a partial update is never exercised there. Implementing it properly anyway costs four null checks and makes the endpoint usable from anything else.',
   'PUBLISHED', 'Backend', TIMESTAMP WITH TIME ZONE '2025-03-22 11:11:00+00'),
  ('Every error response needs a body',
   'The client parses the response body on every non-2xx. An empty error payload surfaces in the UI as an unparseable response rather than the real message.',
   'PUBLISHED', 'Backend', TIMESTAMP WITH TIME ZONE '2025-07-08 14:47:00+00'),
  ('Draft: cursor pagination for the audit log',
   'Offset pagination is fine at admin-table scale and wrong for an append-only log read by a job. Sketching the keyset variant.',
   'DRAFT', 'Backend', TIMESTAMP WITH TIME ZONE '2026-04-27 09:00:00+00'),

  ('One command to bring the whole stack up',
   'A dev environment nobody can start is a dev environment nobody uses. Compose file, seeded database, one script.',
   'PUBLISHED', 'DevOps', TIMESTAMP WITH TIME ZONE '2024-09-12 07:50:00+00'),
  ('Migrations belong in the artifact, not in a runbook',
   'Shipping the changelog with the application means the schema and the code that assumes it can never be at different versions in the same deployment.',
   'PUBLISHED', 'DevOps', TIMESTAMP WITH TIME ZONE '2025-02-05 16:15:00+00'),
  ('Build cache hit rates after splitting the Gradle configuration',
   'Numbers from three weeks of CI. The short version: the toolchain declaration mattered more than the parallelism flags.',
   'PUBLISHED', 'DevOps', TIMESTAMP WITH TIME ZONE '2025-10-01 10:30:00+00'),
  ('Blue-green for a single-instance service',
   'Rejected on cost. Revisit when the service has more than one consumer that cannot tolerate a thirty-second restart.',
   'REJECTED', 'DevOps', TIMESTAMP WITH TIME ZONE '2026-01-23 13:20:00+00'),

  ('No component holds a colour of its own',
   'Raw values live in one stylesheet, every semantic token derives from them, and components only ever reference the semantic name. That is the whole discipline.',
   'PUBLISHED', 'Design System', TIMESTAMP WITH TIME ZONE '2024-01-30 09:05:00+00'),
  ('Density as a single scaled unit',
   'Rescaling the base spacing unit tightens or loosens the entire shell without a single per-component override, because every padding, gap and height utility is derived from it.',
   'PUBLISHED', 'Design System', TIMESTAMP WITH TIME ZONE '2024-11-07 15:40:00+00'),
  ('Replaying the saved theme before first paint',
   'An inline bootstrap script is the only thing standing between a saved preference and a flash of the default one. Forgetting it makes the setting look like it silently resets.',
   'PUBLISHED', 'Design System', TIMESTAMP WITH TIME ZONE '2025-04-16 08:55:00+00'),
  ('Three places a new colour preset has to be registered',
   'The preset block, the union type with its constant list, and the bootstrap allow-list. Miss the third and the preset works until you reload.',
   'PUBLISHED', 'Design System', TIMESTAMP WITH TIME ZONE '2025-08-21 12:35:00+00'),
  ('Draft: a chart ramp that survives a brand hue change',
   'Rotating the ramp off the brand hue keeps the series distinguishable, but the fourth and fifth steps collide at low chroma. Needs work.',
   'DRAFT', 'Design System', TIMESTAMP WITH TIME ZONE '2026-06-11 11:25:00+00'),

  ('Exposing a header the browser would otherwise hide',
   'A custom response header is invisible to fetch unless CORS names it explicitly. The symptom is subtle: every list renders as a single page with a total of zero.',
   'PUBLISHED', 'Security', TIMESTAMP WITH TIME ZONE '2024-10-25 14:10:00+00'),
  ('Allow-listing sort properties',
   'A sort property goes straight into a query. Whitelisting the four the UI actually offers turns a 500 on a hand-edited URL into a silently ignored parameter.',
   'PUBLISHED', 'Security', TIMESTAMP WITH TIME ZONE '2025-06-13 10:20:00+00'),
  ('Auth scaffolding without an auth provider',
   'The screens exist, nothing is wired. Writing down what wiring them actually requires, so the half-finished state does not read as a finished one.',
   'DRAFT', 'Security', TIMESTAMP WITH TIME ZONE '2026-07-30 16:45:00+00'),

  ('Eager loading a relation every row renders anyway',
   'The list shows a category title on every row. A lazy proxy there turns one query into N and buys nothing.',
   'PUBLISHED', 'Performance', TIMESTAMP WITH TIME ZONE '2025-01-28 09:35:00+00'),
  ('Indexing for the queries the UI actually issues',
   'Default sort, category filter, status filter. Three indexes, chosen by reading the list view rather than guessing.',
   'PUBLISHED', 'Performance', TIMESTAMP WITH TIME ZONE '2025-12-04 13:05:00+00'),
  ('Casting a bigint to text on every row to support a search box',
   'Only join the id into the full-text predicate when the search term parses as a number. Otherwise the database casts every row for a match that could never happen.',
   'PUBLISHED', 'Performance', TIMESTAMP WITH TIME ZONE '2026-05-19 15:50:00+00'),

  ('There is no frontend test runner installed',
   'Stating it plainly, because the absence of a test script reads as an oversight rather than a decision. This is the decision, and this is what it would take to reverse it.',
   'PUBLISHED', 'Testing', TIMESTAMP WITH TIME ZONE '2024-12-16 11:15:00+00'),
  ('A context-loads test is a smoke test, not a test suite',
   'It catches a broken bean graph and nothing else. Useful, and worth being honest about the size of what it covers.',
   'PUBLISHED', 'Testing', TIMESTAMP WITH TIME ZONE '2025-05-07 08:40:00+00'),
  ('Draft: contract tests against the data provider dialect',
   'The query-string format is an implicit contract between two repositories. A test that asserts the parsing would make it explicit.',
   'DRAFT', 'Testing', TIMESTAMP WITH TIME ZONE '2026-08-12 10:00:00+00')
) AS v(title, content, status, category_title, created_at)
JOIN categories c ON c.title = v.category_title;

--rollback DELETE FROM blog_posts;
--rollback DELETE FROM categories;
