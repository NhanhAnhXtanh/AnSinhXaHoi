package com.dth.frw.domain.asxh.report;

import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.shared.security.rowlevel.RowLevelResource;
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
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.Objects;

/**
 * Tờ biểu: số liệu của MỘT biểu trong một phiếu (port {@code QtInputReportSheet}).
 *
 * <p>{@code templateVersion} là phiên bản đã ghim lúc mở đợt (theo ngày mở đợt) và không
 * đổi về sau. {@code template} chép lại từ phiên bản để khoá "mỗi biểu chỉ một lần trong một
 * phiếu" thành ràng buộc duy nhất {@code (report_id, template_id)} và để tra nhanh "cặp
 * (đơn vị, biểu) đã phát trong kỳ chưa" mà không phải nạp phiên bản.
 *
 * <p>Phiên bản LAZY: thực thể đó mang cả workbook (có thể vài MB) — danh sách tờ biểu chỉ cần
 * id của nó, mà proxy Hibernate trả id không cần nạp.
 *
 * <p>{@code @Version} là số hiệu bản lưu chống ghi đè giữa hai phiên làm việc (UC-34 5a).
 *
 * <p>TODO: chưa port dữ liệu workbook SpreadJS phía máy chủ — {@code dataJson} lưu nguyên
 * chuỗi JSON frontend gửi lên, máy chủ không đọc nội dung.
 */
@Entity
// Phạm vi dữ liệu theo đơn vị (UC-72): xem module/asxh/inputreport/security.
@RowLevelResource("input_report_sheets")
@Table(
        name = "asxh_input_report_sheets",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_asxh_input_report_sheets_report_template",
                columnNames = {"report_id", "template_id"}))
public class InputReportSheet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "report_id", nullable = false)
    private InputReport report;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "template_id", nullable = false)
    private Template template;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_version_id", nullable = false)
    private TemplateVersion templateVersion;

    /**
     * Cùng cột với {@code templateVersion}, chỉ đọc: cho phép trả id phiên bản ra API sau khi
     * giao dịch đã đóng ({@code open-in-view=false}) mà không đụng tới proxy lười.
     */
    @Column(name = "template_version_id", insertable = false, updatable = false)
    private Long templateVersionId;

    @Column(name = "data_json", columnDefinition = "text")
    private String dataJson;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SheetCompletion completion = SheetCompletion.NOT_STARTED;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "completed_by", length = 255)
    private String completedBy;

    @Column(name = "data_updated_at")
    private Instant dataUpdatedAt;

    @Column(name = "data_updated_by", length = 255)
    private String dataUpdatedBy;

    @Version
    @Column(nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected InputReportSheet() {
        // for JPA
    }

    public InputReportSheet(InputReport report, Template template, TemplateVersion templateVersion) {
        this.report = report;
        this.template = template;
        this.templateVersion = templateVersion;
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

    public Template getTemplate() {
        return template;
    }

    public TemplateVersion getTemplateVersion() {
        return templateVersion;
    }

    /**
     * Id phiên bản đã ghim. Trên thực thể vừa tạo (chưa nạp lại) cột chỉ-đọc còn trống, nên rơi
     * về id của tham chiếu — lúc đó tham chiếu là thực thể thật, không phải proxy.
     */
    public Long getTemplateVersionId() {
        if (templateVersionId == null && templateVersion != null) {
            return templateVersion.getId();
        }
        return templateVersionId;
    }

    public String getDataJson() {
        return dataJson;
    }

    public void setDataJson(String dataJson) {
        this.dataJson = dataJson;
    }

    public SheetCompletion getCompletion() {
        return completion;
    }

    public void setCompletion(SheetCompletion completion) {
        this.completion = completion;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public String getCompletedBy() {
        return completedBy;
    }

    public void setCompletedBy(String completedBy) {
        this.completedBy = completedBy;
    }

    public Instant getDataUpdatedAt() {
        return dataUpdatedAt;
    }

    public void setDataUpdatedAt(Instant dataUpdatedAt) {
        this.dataUpdatedAt = dataUpdatedAt;
    }

    public String getDataUpdatedBy() {
        return dataUpdatedBy;
    }

    public void setDataUpdatedBy(String dataUpdatedBy) {
        this.dataUpdatedBy = dataUpdatedBy;
    }

    public long getVersion() {
        return version;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof InputReportSheet sheet)) {
            return false;
        }
        return id != null && id.equals(sheet.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
