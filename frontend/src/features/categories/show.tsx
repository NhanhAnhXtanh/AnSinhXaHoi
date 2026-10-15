import { useShow } from "@refinedev/core";
import React from "react";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import {
  ShowView,
  ShowViewHeader,
} from "@/shared/components/views/show-view";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";

export const CategoryShow = () => {
  const { result: record, query } = useShow({});
  const { isLoading } = query;

  return (
    <ShowView>
      <ShowViewHeader />
      <Card>
        <CardHeader>
          <CardTitle>{record?.title}</CardTitle>
          <CardDescription>Category ID: {record?.id}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoadingOverlay loading={isLoading}>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Title</h4>
                <p className="text-sm text-muted-foreground">
                  {record?.title || "-"}
                </p>
              </div>
            </div>
          </LoadingOverlay>
        </CardContent>
      </Card>
    </ShowView>
  );
};
