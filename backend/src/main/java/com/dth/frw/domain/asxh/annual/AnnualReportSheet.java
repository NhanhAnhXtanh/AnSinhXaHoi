package com.dth.frw.domain.asxh.annual;

import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.Objects;

/**
 * Một biểu tổng hợp năm trong phiếu năm, với phiên bản mẫu ĐÃ GHIM lúc nộp (port
 * {@code QtDeptReportSheet} của phiếu loại {@code YEAR}).
 *
 * <p>Chỉ giữ biểu + phiên bản: số trong bảng đọc lại từ số liệu tổng hợp ở phiên bản năm đã ghim
 * trên {@link AnnualReport#getLedgerVersion()}, nên không có cột số liệu.
 */
@Entity
@Table(
        name = "asxh_annual_report_sheets",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_asxh_annual_report_sheets_report_template", columnNames = {"report_id", "template_id"}))
public class AnnualReportSheet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "report_id", nullable = false, updatable = false)
    private AnnualReport report;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "template_id", nullable = false, updatable = false)
    private Template template;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_version_id", nullable = false, updatable = false)
    private TemplateVersion templateVersion;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    protected AnnualReportSheet() {
        // for JPA
    }

    public AnnualReportSheet(AnnualReport report, Template template, TemplateVersion templateVersion,
                             int displayOrder) {
        this.report = report;
        this.template = template;
        this.templateVersion = templateVersion;
        this.displayOrder = displayOrder;
    }

    public Long getId() {
        return id;
    }

    public AnnualReport getReport() {
        return report;
    }

    public Template getTemplate() {
        return template;
    }

    public TemplateVersion getTemplateVersion() {
        return templateVersion;
    }

    public int getDisplayOrder() {
        return displayOrder;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof AnnualReportSheet that)) {
            return false;
        }
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
