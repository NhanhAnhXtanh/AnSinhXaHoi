/**
 * The landing screen.
 *
 * Deliberately empty apart from the name. It exists so the application opens on
 * something of its own rather than dropping straight into a resource's table,
 * and so there is a place for the summaries and charts a dashboard eventually
 * grows -- but nothing has been invented here that nobody asked for yet.
 *
 * Not a data resource: no API behind it, no rows, no id in the URL. It is
 * declared in `app/resources` only so the sidebar has something to render, and it
 * is listed in `UNGUARDED_RESOURCES` (see `shared/lib/permissions.ts`) because
 * a screen that reads nothing the API guards has no permission to derive.
 */
export const Dashboard = () => {
  return (
    <div className="flex min-h-[70dvh] items-center justify-center">
      <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        DTH-FRAMEWORK
      </h1>
    </div>
  );
};
