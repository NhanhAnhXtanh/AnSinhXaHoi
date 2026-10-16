package com.dth.frw.module.asxh.ledger.query;

import com.dth.frw.domain.asxh.report.ReportStatus;
import java.util.List;
import java.util.Set;

/**
 * Đọc số liệu ĐÃ DUYỆT còn hiệu lực — cổng duy nhất mà phần tổng hợp được dùng để lấy số liệu
 * (port {@code EffectiveLedger} + các truy vấn đọc {@code rf_ReportLedger} của bản Jmix).
 *
 * <p><b>"Còn hiệu lực"</b> (BR-41.4, BR-47.2): dòng thuộc phiếu {@link ReportStatus#APPROVED},
 * hoặc {@link ReportStatus#LOCKED} mà đã có ngày duyệt (khoá sau khi duyệt). Phiếu nháp / chờ duyệt /
 * bị trả lại (bản cũ {@code SUPERSEDED}) / đã huỷ / khoá khi chốt đợt mà chưa duyệt đều KHÔNG được
 * tính — kể cả khi có dòng do nạp BHXH (UC-49). Hiệu lực suy từ trạng thái phiếu nên trả lại hay
 * huỷ phiếu không cần sửa dòng số liệu nào.
 *
 * <p>Mọi phương thức là truy vấn chiếu (không nạp thực thể), không áp phạm vi dữ liệu theo người
 * gọi — người gọi tự kiểm quyền của màn mình.
 *
 * <p>Số trả về là giá trị lưu nguyên (BigDecimal, không làm tròn); dòng có {@code quantity} /
 * {@code amount} null nghĩa là ô trống chứ không phải 0.
 */
public interface EffectiveLedgerQuery {

    /** Trạng thái phiếu có thể mang số liệu còn hiệu lực (LOCKED còn cần {@code approvedAt}). */
    Set<ReportStatus> EFFECTIVE_STATUSES = Set.of(ReportStatus.APPROVED, ReportStatus.LOCKED);

    /**
     * Mọi dòng số liệu còn hiệu lực khớp điều kiện, xếp theo kỳ, biểu, đơn vị, thứ tự dòng, mã chỉ
     * tiêu.
     */
    List<EffectiveLedgerRow> find(LedgerCriteria criteria);

    /**
     * Tổng theo (biểu, đơn vị số liệu, chỉ tiêu), cộng qua mọi kỳ trong {@code criteria.periodIds}
     * — dùng cho tổng hợp nhiều kỳ (vd cộng 4 quý thành năm). Xếp theo biểu, đơn vị, thứ tự dòng.
     */
    List<LedgerTotal> sumByUnitAndIndicator(LedgerCriteria criteria);

    /**
     * Tổng theo (biểu, chỉ tiêu), cộng mọi đơn vị và mọi kỳ trong điều kiện ({@code unitId} của
     * kết quả là {@code null}).
     */
    List<LedgerTotal> sumByIndicator(LedgerCriteria criteria);

    /** Id các phiếu có số liệu còn hiệu lực khớp điều kiện — để biết đơn vị nào đã có số liệu. */
    Set<Long> reportIdsWithData(LedgerCriteria criteria);
}
