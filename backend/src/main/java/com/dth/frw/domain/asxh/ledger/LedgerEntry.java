package com.dth.frw.domain.asxh.ledger;

import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.unit.ReportUnit;
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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

/**
 * Một dòng số liệu đã lưu của một phiếu (port {@code ReportLedger} của bản Jmix — "sổ cái" chỉ
 * là tên kỹ thuật, chữ người dùng thấy là "số liệu đã duyệt / đã lưu").
 *
 * <p>Ghi khi Sở PHÊ DUYỆT phiếu: hook {@code getInputData} của phiên bản mẫu đọc workbook của
 * từng tờ biểu, mỗi dòng trả về thành một bản ghi ở đây. Thay toàn bộ theo tờ biểu
 * ({@code sheet}) — ghi lại biểu 1a không đụng dòng của biểu 1b cùng phiếu.
 *
 * <p><b>Hai đơn vị</b> (BR-41.3): {@link #unit} là đơn vị SỐ LIỆU (của ai), {@link #submitterUnit}
 * là đơn vị NỘP (phiếu của ai). Biểu thường hai giá trị trùng nhau; biểu nhập hộ (1g) lấy đơn vị
 * số liệu theo từng dòng.
 *
 * <p><b>Hiệu lực</b> không lưu ở bảng này mà suy từ trạng thái phiếu (như bản Jmix): dòng chỉ
 * được tổng hợp khi phiếu {@code APPROVED}, hoặc {@code LOCKED} mà đã có ngày duyệt. Phiếu trả lại
 * ({@code SUPERSEDED}), huỷ, khoá khi đóng đợt mà chưa duyệt đều tự hết hiệu lực — không phải sửa
 * dòng nào. Xem {@code module/asxh/ledger/query/EffectiveLedgerQuery}.
 *
 * <p>Kỳ, biểu và đơn vị lưu lặp lại (đã có qua phiếu / tờ biểu) để truy vấn tổng hợp không phải
 * nối bảng phiếu. Mọi quan hệ LAZY: truy vấn đọc dùng phép chiếu, không nạp thực thể.
 */
@Entity
// Phạm vi dữ liệu theo đơn vị (UC-72): xem module/asxh/ledger/security.
@RowLevelResource("ledger_entries")
@Table(
        name = "asxh_ledger_entries",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_asxh_ledger_entries_key",
                columnNames = {"sheet_id", "unit_id", "indicator_code"}))
public class LedgerEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "report_id", nullable = false)
    private InputReport report;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sheet_id", nullable = false)
    private InputReportSheet sheet;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_id", nullable = false)
    private Template template;

    /** Phiên bản mẫu đã ghim vào tờ biểu lúc ghi — chỉ lưu id. */
    @Column(name = "template_version_id", nullable = false)
    private Long templateVersionId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "period_id", nullable = false)
    private ReportPeriod period;

    /** Đơn vị số liệu. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private ReportUnit unit;

    /** Đơn vị nộp (đơn vị của phiếu). */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submitter_unit_id", nullable = false)
    private ReportUnit submitterUnit;

    @Column(name = "indicator_code", nullable = false, length = 100)
    private String indicatorCode;

    @Column(name = "indicator_name", nullable = false, length = 4000)
    private String indicatorName;

    /** Số đối tượng. {@code numeric} không giới hạn số lẻ — không tự làm tròn số thật. */
    @Column(name = "quantity", columnDefinition = "numeric")
    private BigDecimal quantity;

    /** Kinh phí. */
    @Column(name = "amount", columnDefinition = "numeric")
    private BigDecimal amount;

    @Column(name = "note", length = 4000)
    private String note;

    /** Thứ tự dòng trong biểu — giữ đúng vị trí người nhập khi tổng hợp. */
    @Column(name = "order_no")
    private Integer orderNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LedgerSource source = LedgerSource.SCRIPT;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected LedgerEntry() {
        // for JPA
    }

    public LedgerEntry(InputReport report, InputReportSheet sheet, Template template, Long templateVersionId,
                       ReportPeriod period, ReportUnit unit, ReportUnit submitterUnit, String indicatorCode) {
        this.report = report;
        this.sheet = sheet;
        this.template = template;
        this.templateVersionId = templateVersionId;
        this.period = period;
        this.unit = unit;
        this.submitterUnit = submitterUnit;
        this.indicatorCode = indicatorCode;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public InputReport getReport() {
        return report;
    }

    public InputReportSheet getSheet() {
        return sheet;
    }

    public Template getTemplate() {
        return template;
    }

    public Long getTemplateVersionId() {
        return templateVersionId;
    }

    public void setTemplateVersionId(Long templateVersionId) {
        this.templateVersionId = templateVersionId;
    }

    public ReportPeriod getPeriod() {
        return period;
    }

    public ReportUnit getUnit() {
        return unit;
    }

    public ReportUnit getSubmitterUnit() {
        return submitterUnit;
    }

    public String getIndicatorCode() {
        return indicatorCode;
    }

    public String getIndicatorName() {
        return indicatorName;
    }

    public void setIndicatorName(String indicatorName) {
        this.indicatorName = indicatorName;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public Integer getOrderNo() {
        return orderNo;
    }

    public void setOrderNo(Integer orderNo) {
        this.orderNo = orderNo;
    }

    public LedgerSource getSource() {
        return source;
    }

    public void setSource(LedgerSource source) {
        this.source = source;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof LedgerEntry entry)) {
            return false;
        }
        return id != null && id.equals(entry.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
