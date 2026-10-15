import { useShow } from "@refinedev/core";

import { EditButton } from "@/shared/components/buttons/edit";
import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { RouteDialog } from "@/shared/components/views/route-dialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DialogClose } from "@/shared/ui/dialog";
import { Separator } from "@/shared/ui/separator";

export const BlogPostShow = () => {
  // The post arrives with its category nested, so there is no second request
  // to make here.
  const { result: record, query } = useShow({});
  const { isLoading } = query;

  return (
    <RouteDialog
      title={record?.title || "Blog post"}
      description={
        <span className="flex items-center gap-3">
          <Badge
            variant={record?.status === "published" ? "default" : "secondary"}
          >
            {record?.status ?? "-"}
          </Badge>
          <span>ID: {record?.id ?? "-"}</span>
        </span>
      }
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
          <EditButton />
        </>
      }
    >
      <LoadingOverlay loading={isLoading}>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Category</h4>
            <p className="text-sm text-muted-foreground">
              {record?.category?.title || "-"}
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-2">Created At</h4>
            <p className="text-sm text-muted-foreground">
              {record?.createdAt
                ? new Date(record.createdAt).toLocaleDateString()
                : "-"}
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-4">Content</h4>
            <div className="prose prose-sm max-w-none">
              {record?.content ? (
                <div dangerouslySetInnerHTML={{ __html: record.content }} />
              ) : (
                <p className="text-muted-foreground">No content available</p>
              )}
            </div>
          </div>
        </div>
      </LoadingOverlay>
    </RouteDialog>
  );
};
