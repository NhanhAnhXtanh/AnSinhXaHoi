package com.dth.frw.domain.asxh.annual;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * File phiếu nộp (bản ký, đóng dấu) gửi kèm một lần nộp báo cáo năm — ASX-140, port
 * {@code QtDeptReportAttachment}.
 *
 * <p>Nội dung file nằm NGOÀI cơ sở dữ liệu, trong thư mục {@code asxh.attachments.storage-dir}
 * (dùng chung {@code AttachmentStorage} với giấy tờ đính kèm phiếu đơn vị); bảng chỉ giữ siêu dữ
 * liệu và đường dẫn tương đối. File chỉ nhận lúc nộp, không gỡ được về sau — đó là chứng từ của lần
 * nộp.
 */
@Entity
@Table(name = "asxh_annual_report_attachments")
public class AnnualReportAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "report_id", nullable = false, updatable = false)
    private AnnualReport report;

    /** Cùng cột với {@code report}, chỉ đọc — trả id ra API mà không chạm proxy lười. */
    @Column(name = "report_id", insertable = false, updatable = false)
    private Long reportId;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "content_type", length = 255)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    /** Đường dẫn tương đối trong thư mục lưu file. */
    @Column(name = "storage_path", nullable = false, length = 500)
    private String storagePath;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "created_by", length = 255)
    private String createdBy;

    protected AnnualReportAttachment() {
        // for JPA
    }

    public AnnualReportAttachment(AnnualReport report, String fileName, String contentType, long fileSize,
                                  String storagePath) {
        this.report = report;
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

    public AnnualReport getReport() {
        return report;
    }

    public Long getReportId() {
        return reportId != null ? reportId : (report == null ? null : report.getId());
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

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof AnnualReportAttachment that)) {
            return false;
        }
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
