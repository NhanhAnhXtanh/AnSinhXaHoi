import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router";

import { SystemError } from "@/shared/components/layout/system-error";

type BoundaryProps = {
  /** Đổi giá trị này (đường dẫn) là xoá lỗi và vẽ lại nội dung. */
  resetKey: string;
  children: ReactNode;
};

type BoundaryState = { error: Error | null; occurredAt: Date | null };

/**
 * Error boundary của vùng nội dung. React chỉ có cách viết boundary bằng class
 * (`getDerivedStateFromError` / `componentDidCatch`), nên phần này là class;
 * phần đọc đường dẫn ở hàm bọc bên dưới.
 */
class Boundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null, occurredAt: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error, occurredAt: new Date() };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Giữ dấu vết cho người hỗ trợ: "Mã báo lỗi" trên trang là thời điểm này.
    console.error("Màn hình gặp lỗi khi hiển thị", error, info.componentStack);
  }

  componentDidUpdate(prevProps: BoundaryProps) {
    // Người dùng bấm sang mục khác trên thanh bên: màn mới không dính lỗi của
    // màn cũ. Không dùng `key` theo đường dẫn, vì như thế mọi lần đổi đường dẫn
    // (kể cả mở hộp thoại lồng trong danh sách) đều dựng lại cả màn.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, occurredAt: null });
    }
  }

  render() {
    if (this.state.error) {
      return <SystemError occurredAt={this.state.occurredAt ?? undefined} />;
    }
    return this.props.children;
  }
}

/**
 * Bọc nội dung trong khung ứng dụng: một màn vỡ lúc hiển thị chỉ thay vùng nội
 * dung bằng trang "Có sự cố ngoài ý muốn" (có nút Tải lại trang), thanh bên và
 * thanh đầu vẫn còn để đi tiếp — thay vì trắng cả ứng dụng.
 *
 * Không bắt lỗi trong hàm xử lý sự kiện hay lời gọi bất đồng bộ (React không
 * đưa chúng tới boundary); những lỗi đó đã có thông báo nổi lo.
 */
export function ContentErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <Boundary resetKey={pathname}>{children}</Boundary>;
}

ContentErrorBoundary.displayName = "ContentErrorBoundary";
