package com.dth.frw.module.asxh.attachment;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.module.asxh.attachment.service.AttachmentStorage;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import java.io.InputStream;
import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Kho file đính kèm trên đĩa.
 *
 * <p>Dữ liệu thật có 203 file xác nhận Kho bạc chuyển từ bản Jmix mà chỉ có siêu dữ liệu
 * ({@code storage_path = jmix-fs/...}), nội dung chưa chép sang. Mở một file như thế từng ném
 * {@code IllegalStateException} → 500 "Hệ thống gặp sự cố"; phải là 404 nói rõ không tìm thấy nội
 * dung file.
 */
class AttachmentStorageTest {

    @TempDir
    Path root;

    @Test
    @DisplayName("File có bản ghi mà không có nội dung trên đĩa → 404 tiếng Việt, không phải lỗi hệ thống")
    void missingContentIsNotFound() {
        AttachmentStorage storage = new AttachmentStorage(root.toString());

        ResourceNotFoundException e = assertThrows(ResourceNotFoundException.class,
                () -> storage.open("jmix-fs/2026/04/02/79f02fdd-5a10-4160-9c0e-cb392cc24a8e.png"));
        assertTrue(e.getMessage().startsWith("Không tìm thấy nội dung file đính kèm."), e.getMessage());
    }

    @Test
    @DisplayName("File vừa lưu đọc lại được; đường dẫn thoát ra ngoài thư mục gốc bị chặn")
    void savedContentRoundTripsAndTraversalIsRefused() throws Exception {
        AttachmentStorage storage = new AttachmentStorage(root.toString());
        byte[] content = {(byte) 0x89, 0x50, 0x4E, 0x47, 1, 2, 3};

        String path = storage.save(content, "png");
        try (InputStream in = storage.open(path)) {
            assertArrayEquals(content, in.readAllBytes());
        }
        assertThrows(IllegalArgumentException.class, () -> storage.open("../ngoai-thu-muc.png"));
    }
}
