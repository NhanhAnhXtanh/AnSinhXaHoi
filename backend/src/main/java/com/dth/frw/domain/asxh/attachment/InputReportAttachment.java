package com.dth.frw.domain.asxh.attachment;

import com.dth.frw.domain.asxh.report.InputReport;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;

/**
 * Giấy tờ đính kèm phiếu nhập — trọng tâm là xác nhận của Kho bạc (port
 * {@code QtReportAttachment} của bản Jmix).
 *
 * <p><b>Nội dung file nằm NGOÀI cơ sở dữ liệu</b>, trong thư mục cấu hình
 * {@code asxh.attachments.storage-dir}; bảng này chỉ giữ siêu dữ liệu và đường dẫn tương đối.
 * Ảnh chụp điện thoại 3–8MB một tấm, hơn trăm đơn vị mỗi kỳ — nhồi vào CSDL làm phình sao lưu.
 * Đổi lại, <b>sao lưu phải gồm cả thư mục file</b>.
 *
 * <p>Gỡ file là xoá MỀM ({@link #deletedAt}) và không đụng file vật lý (BR-38.3): giữ chứng từ
 * phòng khi cần đối chiếu.
 *
 * <p>Gắn với một PHIÊN BẢN phiếu: trả lại sinh phiếu mới nên file không được chép sang — đơn vị
 * phải tải lại chứng từ khi nộp lại (UC-43).
 */
@Entity
@Table(name = "asxh_input_report_attachments")
public class InputReportAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "report_id", nullable = false)
    private InputReport report;

    /** Cùng cột với {@code report}, chỉ đọc — trả id ra API mà không chạm proxy lười. */
    @Column(name = "report_id", insertable = false, updatable = false)
    private Long reportId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private AttachmentKind kind = AttachmentKind.TREASURY_CONFIRMATION;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "content_type", length = 255)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    /** Đường dẫn tương đối trong thư mục lưu file (do máy chủ sinh, không lấy từ tên file gửi lên). */
    @Column(name = "storage_path", nullable = false, length = 500)
    private String storagePath;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "created_by", length = 255)
    private String createdBy;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "deleted_by", length = 255)
    private String deletedBy;

    protected InputReportAttachment() {
        // for JPA
    }

    public InputReportAttachment(InputReport report, AttachmentKind kind, String fileName, String contentType,
                                 long fileSize, String storagePath) {
        this.report = report;
        this.kind = kind;
        this.fileName = fileName;
        this.contentType = contentType;
        this.fileSize = fileSize;
        this.storagePath = storagePath;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public InputReport getReport() {
        return report;
    }

    public Long getReportId() {
        if (reportId == null && report != null) {
            return report.getId();
        }
        return reportId;
    }

    public AttachmentKind getKind() {
        return kind;
    }

    public String getFileName() {
        return fileName;
    }

    public String getContentType() {
        return contentType;
    }

    public long getFileSize() {
        return fileSize;
    }

    public String getStoragePath() {
        return storagePath;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(Instant deletedAt) {
        this.deletedAt = deletedAt;
    }

    public String getDeletedBy() {
        return deletedBy;
    }

    public void setDeletedBy(String deletedBy) {
        this.deletedBy = deletedBy;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof InputReportAttachment attachment)) {
            return false;
        }
        return id != null && id.equals(attachment.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
