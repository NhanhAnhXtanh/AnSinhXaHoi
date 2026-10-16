package com.dth.frw.module.asxh.summary.query;

import com.dth.frw.domain.asxh.unit.ReportBlock;
import com.dth.frw.domain.asxh.unit.ReportUnitType;

/**
 * Một đơn vị báo cáo dạng phẳng (id, mã, tên, cha, loại, khối) — đủ để giải phạm vi tổng hợp mà
 * không nạp thực thể.
 */
public record UnitNode(
        Long id,
        String budgetCode,
        String name,
        Long parentId,
        ReportUnitType unitType,
        ReportBlock block) {
}
