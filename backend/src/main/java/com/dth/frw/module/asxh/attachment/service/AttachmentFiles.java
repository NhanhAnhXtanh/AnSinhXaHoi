package com.dth.frw.module.asxh.attachment.service;

import java.util.List;
import java.util.Locale;

/**
 * Kiểm một file đính kèm trước khi lưu (port {@code AttachmentFiles} của bản Jmix, BR-38.2).
 *
 * <p>Kiểm ở máy chủ chứ không chỉ ở trình duyệt: gọi thẳng REST là bỏ qua được mọi ràng buộc của
 * ô chọn file.
 */
public final class AttachmentFiles {

    /** Ảnh điện thoại đời mới thường 3–8MB; 10MB đủ rộng mà vẫn chặn được file nhầm. */
    public static final long MAX_FILE_BYTES = 10L * 1024 * 1024;

    private static final int FILE_NAME_MAX_LENGTH = 255;

    /** Ảnh / PDF xem được ngay trên trình duyệt; Word / Excel phải tải về. */
    public static final List<String> ALLOWED_EXTENSIONS =
            List.of("jpg", "jpeg", "png", "pdf", "doc", "docx", "xls", "xlsx");

    private AttachmentFiles() {
    }

    /**
     * @return tên file đã cắt khoảng trắng (bỏ phần đường dẫn nếu trình duyệt gửi kèm)
     * @throws IllegalArgumentException tên / đuôi / dung lượng / nội dung không hợp lệ (→ 400)
     */
    public static String validate(String originalFileName, byte[] content) {
        String fileName = baseName(originalFileName);
        if (fileName.isEmpty()) {
            throw new IllegalArgumentException("Thiếu tên file đính kèm.");
        }
        if (fileName.length() > FILE_NAME_MAX_LENGTH) {
            throw new IllegalArgumentException("Tên file dài quá " + FILE_NAME_MAX_LENGTH + " ký tự.");
        }
        if (content == null || content.length == 0) {
            throw new IllegalArgumentException("File đính kèm rỗng.");
        }
        if (content.length > MAX_FILE_BYTES) {
            throw new IllegalArgumentException("File \"" + fileName + "\" nặng quá "
                    + (MAX_FILE_BYTES / (1024 * 1024)) + "MB.");
        }
        String extension = extensionOf(fileName);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("Chỉ nhận file ảnh (JPG, PNG), PDF, Word hoặc Excel.");
        }
        // Kiểm NỘI DUNG thật, không chỉ đuôi: đổi tên "x.exe" thành "x.jpg" là thao tác một giây.
        if (!contentMatchesExtension(extension, content)) {
            throw new IllegalArgumentException("Nội dung file \"" + fileName + "\" không khớp với đuôi file.");
        }
        return fileName;
    }

    public static String extensionOf(String fileName) {
        int dot = fileName.lastIndexOf('.');
        return dot < 0 || dot == fileName.length() - 1
                ? "" : fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    /** Kiểu nội dung trả về khi tải xuống — suy từ đuôi đã kiểm, không tin giá trị trình duyệt gửi. */
    public static String contentTypeOf(String fileName) {
        return switch (extensionOf(fileName)) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "pdf" -> "application/pdf";
            case "doc" -> "application/msword";
            case "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case "xls" -> "application/vnd.ms-excel";
            case "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            default -> "application/octet-stream";
        };
    }

    private static String baseName(String originalFileName) {
        String name = originalFileName == null ? "" : originalFileName.trim();
        int slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        return slash >= 0 ? name.substring(slash + 1).trim() : name;
    }

    /** Word / Excel hiện đại là ZIP (PK), bản cũ là OLE2 — nhận cả hai cho mọi đuôi văn phòng. */
    private static boolean contentMatchesExtension(String extension, byte[] content) {
        return switch (extension) {
            case "jpg", "jpeg" -> startsWith(content, 0xFF, 0xD8, 0xFF);
            case "png" -> startsWith(content, 0x89, 0x50, 0x4E, 0x47);
            case "pdf" -> startsWith(content, 0x25, 0x50, 0x44, 0x46);
            case "doc", "docx", "xls", "xlsx" ->
                    startsWith(content, 0x50, 0x4B, 0x03, 0x04)
                            || startsWith(content, 0x50, 0x4B, 0x05, 0x06)
                            || startsWith(content, 0xD0, 0xCF, 0x11, 0xE0);
            default -> false;
        };
    }

    private static boolean startsWith(byte[] content, int... signature) {
        if (content.length < signature.length) {
            return false;
        }
        for (int i = 0; i < signature.length; i++) {
            if ((content[i] & 0xFF) != signature[i]) {
                return false;
            }
        }
        return true;
    }
}
