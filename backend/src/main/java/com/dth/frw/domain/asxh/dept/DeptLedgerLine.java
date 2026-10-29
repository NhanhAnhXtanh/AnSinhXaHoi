package com.dth.frw.domain.asxh.dept;

import com.dth.frw.domain.asxh.unit.ReportUnit;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.Objects;

/**
 * Một dòng số liệu Sở (port {@code QtDeptLedger}): số của MỘT đơn vị cho MỘT chỉ tiêu trong một
 * biểu của một kỳ, ở một khoảng phiên bản năm.
 *
 * <p><b>Phiên bản</b>: dòng có hiệu lực ở phiên bản {@code k} khi
 * {@code versionFrom <= k < versionTo} ({@code versionTo} null = còn hiệu lực). Sửa một dòng KHÔNG
 * ghi đè: đóng dòng cũ ({@code versionTo = k}) và mở dòng mới ({@code versionFrom = k}). Nhờ vậy
 * đọc lại được số liệu ở mọi phiên bản cũ (UC-56) và báo cáo năm đã nộp luôn thấy đúng số đã ghim.
 *
 * <p><b>Đơn vị</b> (BR-55.1): {@link #unitKey} = mã quan hệ ngân sách của đơn vị (có {@link #unit});
 * {@link #MERGED_UNIT_KEY} = dòng "Sở điều chỉnh chung" mang PHẦN CHÊNH không gắn đơn vị nào.
 *
 * <p>{@code sourceQuantity}/{@code sourceAmount} = số gốc tổng hợp từ phiếu đơn vị lúc lưu;
 * {@code quantity}/{@code amount} = số Sở chốt. Khác nhau là "Sở đã điều chỉnh".
 */
@Entity
@Table(
        name = "asxh_dept_ledger_lines",
        indexes = {
                @Index(name = "ix_asxh_dept_ledger_lines_sheet", columnList = "sheet_id, version_to"),
                @Index(name = "ix_asxh_dept_ledger_lines_report", columnList = "report_id, version_from")
        })
public class DeptLedgerLine {

    /** Khoá đơn vị của dòng "Sở điều chỉnh chung". */
    public static final String MERGED_UNIT_KEY = "*";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "report_id", nullable = false, updatable = false)
    private DeptReport report;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sheet_id", nullable = false, updatable = false)
    private DeptReportSheet sheet;

    @Column(name = "sheet_id", insertable = false, updatable = false)
    private Long sheetId;

    @Column(name = "unit_key", nullable = false, length = 100, updatable = false)
    private String unitKey = MERGED_UNIT_KEY;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_id", updatable = false)
    private ReportUnit unit;

    @Column(name = "unit_id", insertable = false, updatable = false)
    private Long unitId;

    @Column(name = "indicator_code", nullable = false, length = 100, updatable = false)
    private String indicatorCode;

    @Column(name = "indicator_name", nullable = false, length = 4000)
    private String indicatorName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10, updatable = false)
    private DeptLedgerSlot slot = DeptLedgerSlot.ALL;

    @Enumerated(EnumType.STRING)
    @Column(name = "measure_kind", length = 20)
    private MeasureKind measureKind;

    @Column(name = "source_quantity", columnDefinition = "numeric")
    private BigDecimal sourceQuantity;

    @Column(name = "source_amount", columnDefinition = "numeric")
    private BigDecimal sourceAmount;

    @Column(name = "quantity", columnDefinition = "numeric")
    private BigDecimal quantity;

    @Column(name = "amount", columnDefinition = "numeric")
    private BigDecimal amount;

    /** "Kinh phí đã bố trí trong dự toán NSĐP" — chỉ Sở nhập. */
    @Column(name = "allocated_amount", columnDefinition = "numeric")
    private BigDecimal allocatedAmount;

    @Column(name = "adjust_reason", columnDefinition = "text")
    private String adjustReason;

    @Column(name = "order_no")
    private Integer orderNo;

    @Column(name = "version_from", nullable = false, updatable = false)
    private int versionFrom;

    @Column(name = "version_to")
    private Integer versionTo;

    /** Mốc lịch sử ({@link DeptChange}) đã sinh ra dòng này. */
    @Column(name = "change_id", updatable = false)
    private Long changeId;

    protected DeptLedgerLine() {
        // for JPA
    }

    public DeptLedgerLine(DeptReport report, DeptReportSheet sheet, String unitKey, ReportUnit unit,
                          String indicatorCode, DeptLedgerSlot slot, int versionFrom) {
        this.report = report;
        this.sheet = sheet;
        this.unitKey = unitKey;
        this.unit = unit;
        this.indicatorCode = indicatorCode;
        this.slot = slot == null ? DeptLedgerSlot.ALL : slot;
        this.versionFrom = versionFrom;
    }

    public Long getId() {
        return id;
    }

    public DeptReport getReport() {
        return report;
    }

    public DeptReportSheet getSheet() {
        return sheet;
    }

    public Long getSheetId() {
        if (sheetId != null) {
            return sheetId;
        }
        return sheet == null ? null : sheet.getId();
    }

    public String getUnitKey() {
        return unitKey;
    }

    public boolean isMerged() {
        return MERGED_UNIT_KEY.equals(unitKey);
    }

    public ReportUnit getUnit() {
        return unit;
    }

    public Long getUnitId() {
        if (unitId != null) {
            return unitId;
        }
        return unit == null ? null : unit.getId();
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

    public DeptLedgerSlot getSlot() {
        return slot;
    }

    public MeasureKind getMeasureKind() {
        return measureKind;
    }

    public void setMeasureKind(MeasureKind measureKind) {
        this.measureKind = measureKind;
    }

    public BigDecimal getSourceQuantity() {
        return sourceQuantity;
    }

    public void setSourceQuantity(BigDecimal sourceQuantity) {
        this.sourceQuantity = sourceQuantity;
    }

    public BigDecimal getSourceAmount() {
        return sourceAmount;
    }

    public void setSourceAmount(BigDecimal sourceAmount) {
        this.sourceAmount = sourceAmount;
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

    public BigDecimal getAllocatedAmount() {
        return allocatedAmount;
    }

    public void setAllocatedAmount(BigDecimal allocatedAmount) {
        this.allocatedAmount = allocatedAmount;
    }

    public String getAdjustReason() {
        return adjustReason;
    }

    public void setAdjustReason(String adjustReason) {
        this.adjustReason = adjustReason;
    }

    public Integer getOrderNo() {
        return orderNo;
    }

    public void setOrderNo(Integer orderNo) {
        this.orderNo = orderNo;
    }

    public int getVersionFrom() {
        return versionFrom;
    }

    public Integer getVersionTo() {
        return versionTo;
    }

    public void setVersionTo(Integer versionTo) {
        this.versionTo = versionTo;
    }

    public Long getChangeId() {
        return changeId;
    }

    public void setChangeId(Long changeId) {
        this.changeId = changeId;
    }

    /** Dòng có hiệu lực ở phiên bản {@code version} không. */
    public boolean visibleAt(int version) {
        return versionFrom <= version && (versionTo == null || versionTo > version);
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof DeptLedgerLine that)) {
            return false;
        }
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
