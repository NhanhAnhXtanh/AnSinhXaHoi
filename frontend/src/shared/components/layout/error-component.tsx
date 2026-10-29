import { Button } from "@/shared/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { StatusPage } from "@/shared/components/layout/status-page";
import { useGo, useResourceParams, useTranslate } from "@refinedev/core";
import { FileQuestionMark, House, InfoIcon } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * When the app is navigated to a non-existent route, refine shows a default error page.
 * A custom error component can be used for this error page.
 *
 * Deliberately no big "404": the reader is a commune officer, not a developer,
 * and a status code says nothing to them (`trang-thai-chung.md` §0, §8).
 *
 * @see {@link https://refine.dev/docs/packages/documentation/routers/} for more details.
 */
export function ErrorComponent() {
  const [errorMessage, setErrorMessage] = useState<string>();

  const translate = useTranslate();
  const go = useGo();

  const { resource, action } = useResourceParams();

  useEffect(() => {
    if (resource && action) {
      setErrorMessage(
        translate(
          "pages.error.info",
          {
            action: action,
            resource: resource?.name,
          },
          `You may have forgotten to add the "${action}" component to "${resource?.name}" resource.`
        )
      );
    }
  }, [resource, action, translate]);

  return (
    <StatusPage
      icon={FileQuestionMark}
      title={translate("pages.error.title", "Không tìm thấy trang")}
      description={
        <>
          {translate(
            "pages.error.description",
            "Địa chỉ này không có trong hệ thống, có thể do gõ nhầm hoặc đường dẫn đã cũ."
          )}
          {/* The hint names a resource and an action — a developer's clue,
              so it only exists in a development build. */}
          {import.meta.env.DEV && errorMessage && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoIcon
                    className="ms-1 inline size-4 cursor-help align-text-bottom"
                    data-testid="error-component-tooltip"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{errorMessage}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </>
      }
      actions={
        <Button variant="outline" onClick={() => go({ to: "/" })}>
          <House />
          {translate("pages.error.backHome", "Về trang chủ")}
        </Button>
      }
    />
  );
}

ErrorComponent.displayName = "ErrorComponent";
