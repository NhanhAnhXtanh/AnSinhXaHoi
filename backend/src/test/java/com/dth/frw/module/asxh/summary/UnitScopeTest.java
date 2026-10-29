package com.dth.frw.module.asxh.summary;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.dth.frw.domain.asxh.unit.ReportBlock;
import com.dth.frw.domain.asxh.unit.ReportUnitType;
import com.dth.frw.module.asxh.summary.query.ScopeKind;
import com.dth.frw.module.asxh.summary.query.UnitNode;
import com.dth.frw.module.asxh.summary.service.UnitScope;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Phạm vi đơn vị của bảng tổng hợp (UC-51) trên cây đơn vị dựng tay:
 * Sở (1) → UBND huyện Long Thành (2) → xã Phú Hữu (3), xã Long Tân (4); UBND huyện Nhơn Trạch (5) → xã
 * Đại Phước (6).
 */
class UnitScopeTest {

    private static final List<UnitNode> UNITS = List.of(
            new UnitNode(1L, "1000001", "Sở Lao động", null, ReportUnitType.SO, ReportBlock.TINH),
            new UnitNode(2L, "1000002", "UBND huyện Long Thành", 1L, ReportUnitType.UBND_HUYEN, ReportBlock.HUYEN),
            new UnitNode(3L, "1000003", "UBND xã Phú Hữu", 2L, ReportUnitType.UBND_XA, ReportBlock.XA),
            new UnitNode(4L, "1000004", "UBND xã Long Tân", 2L, ReportUnitType.UBND_XA, ReportBlock.XA),
            new UnitNode(5L, "1000005", "UBND huyện Nhơn Trạch", 1L, ReportUnitType.UBND_HUYEN, ReportBlock.HUYEN),
            new UnitNode(6L, "1000006", "UBND xã Đại Phước", 5L, ReportUnitType.UBND_XA, ReportBlock.XA));

    @Test
    @DisplayName("Tất cả đơn vị = không lọc (null)")
    void allMeansNoFilter() {
        assertNull(UnitScope.resolve(ScopeKind.ALL, null, null, null, UNITS));
        assertNull(UnitScope.resolve(null, null, null, null, UNITS), "không chọn gì = toàn tỉnh");
    }

    @Test
    @DisplayName("Chỉ truyền organizationId (script cũ) = một đơn vị")
    void organizationIdAloneMeansOneUnit() {
        assertEquals(Set.of(3L), UnitScope.resolve(null, 3L, null, null, UNITS));
    }

    @Test
    @DisplayName("Cây đơn vị: chính nó và mọi cấp dưới")
    void treeIncludesDescendants() {
        assertEquals(Set.of(2L, 3L, 4L), UnitScope.resolve(ScopeKind.ORG_TREE, 2L, null, null, UNITS));
        assertEquals(Set.of(1L, 2L, 3L, 4L, 5L, 6L), UnitScope.resolve(ScopeKind.ORG_TREE, 1L, null, null, UNITS));
    }

    @Test
    @DisplayName("Loại đơn vị: nhận cả mã kiểu bản Jmix (XA) lẫn tên mới (ubnd_xa)")
    void typeAcceptsLegacyCodes() {
        assertEquals(Set.of(3L, 4L, 6L), UnitScope.resolve(ScopeKind.ORG_TYPE, null, "XA", null, UNITS));
        assertEquals(Set.of(3L, 4L, 6L), UnitScope.resolve(ScopeKind.ORG_TYPE, null, "ubnd_xa", null, UNITS));
        assertEquals(Set.of(1L), UnitScope.resolve(ScopeKind.ORG_TYPE, null, "SO", null, UNITS));
    }

    @Test
    @DisplayName("Khối: tỉnh / huyện / xã")
    void blockFilter() {
        assertEquals(Set.of(2L, 5L), UnitScope.resolve(ScopeKind.BLOCK, null, null, "huyen", UNITS));
    }

    @Test
    @DisplayName("Phạm vi một đơn vị mà không chọn đơn vị / đơn vị không còn → lỗi tiếng Việt")
    void missingUnitIsRejected() {
        IllegalArgumentException none = assertThrows(IllegalArgumentException.class,
                () -> UnitScope.resolve(ScopeKind.ORGANIZATION, null, null, null, UNITS));
        assertEquals("Hãy chọn đơn vị cho phạm vi tổng hợp.", none.getMessage());
        assertThrows(IllegalArgumentException.class,
                () -> UnitScope.resolve(ScopeKind.ORG_TREE, 99L, null, null, UNITS));
    }
}
