package com.dth.frw.module.asxh.summary.service;

import com.dth.frw.domain.asxh.unit.ReportBlock;
import com.dth.frw.domain.asxh.unit.ReportUnitType;
import com.dth.frw.module.asxh.summary.query.ScopeKind;
import com.dth.frw.module.asxh.summary.query.UnitNode;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Giải phạm vi đơn vị (UC-51) thành tập id đơn vị — HÀM THUẦN trên danh sách đơn vị phẳng. Port
 * {@code SummaryOrganizationScopeService}.
 *
 * <p>Kết quả {@code null} = mọi đơn vị (không lọc); tập rỗng = không đơn vị nào (bảng trống, không
 * phải lỗi). Đơn vị đã ngừng hoạt động vẫn được tính — số liệu lịch sử của chúng vẫn thuộc kỳ cũ.
 */
public final class UnitScope {

    private UnitScope() {
    }

    /**
     * @param kind           {@code null} → có {@code organizationId} thì một đơn vị, không thì tất cả
     *                       (tương thích script cũ chỉ truyền {@code organizationId})
     * @param organizationId đơn vị của phạm vi một đơn vị / cây đơn vị
     * @param orgType        loại đơn vị: tên {@link ReportUnitType} ({@code ubnd_xa}…) hoặc mã cũ của
     *                       bản Jmix ({@code XA}, {@code HUYEN})
     * @param block          khối: {@code tinh} / {@code huyen} / {@code xa}
     */
    public static Set<Long> resolve(ScopeKind kind, Long organizationId, String orgType, String block,
                                    List<UnitNode> units) {
        ScopeKind effective = kind != null ? kind
                : organizationId != null ? ScopeKind.ORGANIZATION : ScopeKind.ALL;
        return switch (effective) {
            case ALL -> null;
            case ORGANIZATION -> Set.of(requireUnit(organizationId, units).id());
            case ORG_TREE -> descendantsInclusive(requireUnit(organizationId, units).id(), units);
            case ORG_TYPE -> byType(parseType(orgType), units);
            case BLOCK -> byBlock(parseBlock(block), units);
        };
    }

    /**
     * Loại đơn vị từ tham số: tên hằng của bản mới, hoặc mã của bản Jmix mà script tổng hợp năm vẫn
     * gửi ({@code XA} = UBND xã, {@code HUYEN} = UBND huyện; {@code TINH}, {@code SO}, {@code TRUONG},
     * {@code KHAC} trùng tên).
     */
    public static ReportUnitType parseType(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("Hãy chọn loại đơn vị cho phạm vi tổng hợp.");
        }
        String value = raw.trim().toUpperCase(Locale.ROOT);
        return switch (value) {
            case "XA" -> ReportUnitType.UBND_XA;
            case "HUYEN" -> ReportUnitType.UBND_HUYEN;
            default -> ReportUnitType.from(value);
        };
    }

    public static ReportBlock parseBlock(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("Hãy chọn khối cho phạm vi tổng hợp.");
        }
        return ReportBlock.from(raw);
    }

    /** Một đơn vị và mọi đơn vị cấp dưới (duyệt cây theo {@code parentId}). */
    public static Set<Long> descendantsInclusive(Long rootId, List<UnitNode> units) {
        Map<Long, List<Long>> children = new HashMap<>();
        for (UnitNode unit : units) {
            if (unit.parentId() != null) {
                children.computeIfAbsent(unit.parentId(), key -> new ArrayList<>()).add(unit.id());
            }
        }
        Set<Long> result = new LinkedHashSet<>();
        Deque<Long> queue = new ArrayDeque<>();
        queue.add(rootId);
        while (!queue.isEmpty()) {
            Long id = queue.poll();
            // add() trả false khi đã thăm — chặn vòng lặp nếu dữ liệu cây lỡ có chu trình.
            if (result.add(id)) {
                queue.addAll(children.getOrDefault(id, List.of()));
            }
        }
        return result;
    }

    private static Set<Long> byType(ReportUnitType type, List<UnitNode> units) {
        Set<Long> result = new LinkedHashSet<>();
        for (UnitNode unit : units) {
            if (unit.unitType() == type) {
                result.add(unit.id());
            }
        }
        return result;
    }

    private static Set<Long> byBlock(ReportBlock block, List<UnitNode> units) {
        Set<Long> result = new LinkedHashSet<>();
        for (UnitNode unit : units) {
            if (unit.block() == block) {
                result.add(unit.id());
            }
        }
        return result;
    }

    private static UnitNode requireUnit(Long organizationId, List<UnitNode> units) {
        if (organizationId == null) {
            throw new IllegalArgumentException("Hãy chọn đơn vị cho phạm vi tổng hợp.");
        }
        return units.stream()
                .filter(unit -> organizationId.equals(unit.id()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Đơn vị được chọn không còn tồn tại."));
    }
}
