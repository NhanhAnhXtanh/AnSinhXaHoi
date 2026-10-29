package com.dth.frw.module.asxh.unit.api.dto;

import com.dth.frw.domain.asxh.unit.ReportBlock;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.domain.asxh.unit.ReportUnitType;
import java.time.Instant;

/**
 * Hình dạng dây của một đơn vị.
 *
 * <p>{@code parent} lồng (không phẳng thành {@code parentId}) vì form chọn cấp trên
 * gắn vào {@code parent.id} và cột danh sách đọc {@code parent.name}. Cha phải đã
 * được khởi tạo trong transaction (service lo việc đó).
 */
public record ReportUnitResponse(
        Long id,
        String budgetCode,
        String name,
        ParentSummary parent,
        ReportUnitType unitType,
        ReportBlock block,
        boolean active,
        boolean receivesReports,
        Instant createdAt,
        Instant updatedAt) {

    /** Cấp trên theo cách endpoint này báo — khai riêng, không dùng chung với slice khác. */
    public record ParentSummary(Long id, String budgetCode, String name) {

        static ParentSummary from(ReportUnit parent) {
            return parent == null
                    ? null
                    : new ParentSummary(parent.getId(), parent.getBudgetCode(), parent.getName());
        }
    }

    public static ReportUnitResponse from(ReportUnit unit) {
        return new ReportUnitResponse(
                unit.getId(),
                unit.getBudgetCode(),
                unit.getName(),
                ParentSummary.from(unit.getParent()),
                unit.getUnitType(),
                unit.getBlock(),
                unit.isActive(),
                unit.isReceivesReports(),
                unit.getCreatedAt(),
                unit.getUpdatedAt());
    }
}
