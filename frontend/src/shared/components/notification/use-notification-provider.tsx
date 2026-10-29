import type { NotificationProvider } from "@refinedev/core";
import { toast } from "sonner";
import { UndoableNotification } from "@/shared/components/notification/undoable-notification";

/**
 * Refine raises its own notifications for every save, delete and failed read,
 * and with no i18n provider configured they arrive in English and name the
 * resource by its internal plural ("Successfully created Blog posts",
 * "Error (status code: 500)"). Those fixed sentences are recognised here and
 * replaced with the wording of `trang-thai-chung.md`; anything else — a
 * message a screen wrote itself, or the server's own explanation in the
 * description — passes through untouched.
 */
function localise(
  message: string,
  description: string | undefined
): { message: string; description: string | undefined } {
  // Refine's generic second line ("Success" / "Successful") adds nothing, and a
  // transport error ("Request failed with status code 500: GET http://…",
  // "Failed to fetch") is a developer's sentence, not an explanation.
  const quietDescription =
    description &&
    (/^(Success|Successful|Error)$/i.test(description.trim()) ||
      /status code|request failed|failed to fetch|networkerror|https?:\/\//i.test(
        description
      ))
      ? undefined
      : description;

  const rules: [RegExp, string, string?][] = [
    [/^Successfully created\b/i, "Đã thêm mới."],
    [/^Successfully (updated|edited)\b/i, "Đã lưu."],
    [/^Successfully deleted\b/i, "Đã xoá."],
    [/^Error when creating\b/i, "Chưa thêm mới được."],
    [/^Error when (updating|editing)\b/i, "Chưa lưu được thay đổi."],
    [/^Error when deleting\b/i, "Chưa xoá được."],
    [
      /^Error \(status code: [^)]*\)$/i,
      "Chưa tải được dữ liệu.",
      "Có thể do mạng chập chờn hoặc hệ thống đang bận. Bạn thử lại sau ít phút.",
    ],
  ];

  for (const [pattern, text, fallbackDescription] of rules) {
    if (pattern.test(message)) {
      return {
        message: text,
        description: quietDescription ?? fallbackDescription,
      };
    }
  }

  const undo = /^You have (\d+) seconds? to undo/i.exec(message);
  if (undo) {
    return {
      message: `Còn ${undo[1]} giây để hoàn tác.`,
      description: quietDescription,
    };
  }

  return { message, description: quietDescription };
}

export function useNotificationProvider(): NotificationProvider {
  return {
    open: ({
      key,
      type,
      message: rawMessage,
      description: rawDescription,
      undoableTimeout,
      cancelMutation,
    }) => {
      const { message, description } = localise(rawMessage, rawDescription);

      switch (type) {
        case "success":
          toast.success(message, {
            id: key,
            description,
          });
          return;

        case "error":
          toast.error(message, {
            id: key,
            description,
          });
          return;

        case "progress": {
          const toastId = key || Date.now();

          toast(
            () => (
              <UndoableNotification
                message={message}
                description={description}
                undoableTimeout={undoableTimeout}
                cancelMutation={cancelMutation}
                onClose={() => toast.dismiss(toastId)}
              />
            ),
            {
              id: toastId,
              duration: (undoableTimeout || 5) * 1000,
              unstyled: true,
            }
          );
          return;
        }

        default:
          return;
      }
    },
    close: (id) => {
      toast.dismiss(id);
    },
  };
}
