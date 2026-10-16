import { useSyncExternalStore } from "react";

/** true khi cửa sổ khớp câu truy vấn CSS (vd. "(min-width: 1600px)"); tự cập nhật khi đổi cỡ. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
