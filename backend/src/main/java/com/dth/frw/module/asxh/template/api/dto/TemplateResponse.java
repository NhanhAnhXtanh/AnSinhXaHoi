package com.dth.frw.module.asxh.template.api.dto;

import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.domain.asxh.template.TemplateSet;
import com.dth.frw.domain.asxh.template.TemplateStatus;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Biểu trên dây.
 *
 * <p>{@code code} là mã nội bộ — trả ra để các màn khác tham chiếu, nhưng
 * <b>không hiển thị</b> cho người dùng. {@code currentVersion} là bản đang áp
 * dụng hôm nay theo quy tắc UC-19 (trống nếu chưa có bản đã ban hành nào áp
 * dụng tới hôm nay); {@code latestVersion} là bản có số thứ tự lớn nhất, bất kể
 * trạng thái — thứ màn "Lịch sử phiên bản" cần để biết nút nào hiện.
 */
public record TemplateResponse(
        Long id,
        String code,
        String shortName,
        String name,
        TemplateKind kind,
        int sortOrder,
        SetSummary set,
        long versionCount,
        VersionSummary currentVersion,
        VersionSummary latestVersion,
        Instant createdAt,
        Instant updatedAt) {

    /** Khai báo riêng, không dùng lại {@code TemplateSetResponse}, theo luật của base. */
    public record SetSummary(Long id, String name) {

        static SetSummary from(TemplateSet set) {
            return new SetSummary(set.getId(), set.getName());
        }
    }

    public record VersionSummary(Long id, int versionNo, TemplateStatus status, LocalDate effectiveFrom) {
    }

    public static TemplateResponse from(Template template, long versionCount,
                                        VersionSummary currentVersion, VersionSummary latestVersion) {
        return new TemplateResponse(
                template.getId(),
                template.getCode(),
                template.getShortName(),
                template.getName(),
                template.getKind(),
                template.getSortOrder(),
                SetSummary.from(template.getTemplateSet()),
                versionCount,
                currentVersion,
                latestVersion,
                template.getCreatedAt(),
                template.getUpdatedAt());
    }
}
