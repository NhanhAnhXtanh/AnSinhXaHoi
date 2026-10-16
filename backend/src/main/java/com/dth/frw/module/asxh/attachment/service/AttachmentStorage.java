package com.dth.frw.module.asxh.attachment.service;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Lưu nội dung file đính kèm trên đĩa, dưới thư mục {@code asxh.attachments.storage-dir}
 * (mặc định {@code ./data/attachments}).
 *
 * <p>Tên file trên đĩa do máy chủ sinh ({@code yyyy/MM/<uuid>.<đuôi>}), không dùng tên người dùng
 * gửi lên — không có đường nào để chèn {@code ../} ra ngoài thư mục. Mọi đường đọc đều kiểm lại
 * rằng đích nằm trong thư mục gốc.
 *
 * <p>Sao lưu hệ thống phải gồm cả thư mục này: CSDL chỉ giữ đường dẫn.
 */
@Component
public class AttachmentStorage {

    private final Path root;

    public AttachmentStorage(@Value("${asxh.attachments.storage-dir:./data/attachments}") String storageDir) {
        this.root = Path.of(storageDir).toAbsolutePath().normalize();
    }

    /** Ghi nội dung, trả đường dẫn tương đối (dấu "/") để lưu vào CSDL. */
    public String save(byte[] content, String extension) {
        LocalDate today = LocalDate.now();
        String relative = "%04d/%02d/%s.%s".formatted(
                today.getYear(), today.getMonthValue(), UUID.randomUUID(), extension);
        Path target = resolve(relative);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, content, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
        } catch (IOException e) {
            throw new UncheckedIOException("Không lưu được file đính kèm.", e);
        }
        return relative;
    }

    /** Mở luồng đọc; người gọi đóng luồng. */
    public InputStream open(String relativePath) {
        Path source = resolve(relativePath);
        if (!Files.isRegularFile(source)) {
            throw new IllegalStateException("Không tìm thấy nội dung file đính kèm trên máy chủ.");
        }
        try {
            return Files.newInputStream(source);
        } catch (IOException e) {
            throw new UncheckedIOException("Không đọc được file đính kèm.", e);
        }
    }

    /** Xoá file vật lý (chỉ dùng để dọn khi lưu bản ghi thất bại — gỡ file là xoá mềm). */
    public void deleteQuietly(String relativePath) {
        try {
            Files.deleteIfExists(resolve(relativePath));
        } catch (IOException | RuntimeException ignore) {
            // Dọn dẹp cố gắng hết sức; file mồ côi không hại gì.
        }
    }

    private Path resolve(String relativePath) {
        Path target = root.resolve(relativePath).normalize();
        if (!target.startsWith(root)) {
            throw new IllegalArgumentException("Đường dẫn file đính kèm không hợp lệ.");
        }
        return target;
    }
}
