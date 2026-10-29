package com.dth.frw.module.asxh.dept.query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Cổng ĐỌC số liệu tổng hợp Sở đã lưu theo NĂM — dành cho agent BÁO CÁO NĂM (UC-58..67) và màn
 * Tổng hợp "Theo năm" khi năm đã có số liệu Sở (UC-52 bước 3). Bean: {@code DeptYearDataService}.
 *
 * <p><b>Mô hình</b> (bảng {@code asxh_dept_*}, entity ở {@code domain/asxh/dept}):
 * <ul>
 *   <li>{@code DeptReport} — số liệu Sở của MỘT kỳ đã chốt (một dòng / kỳ).</li>
 *   <li>{@code DeptLedgerLine} — số theo đơn vị × chỉ tiêu × biểu, có khoảng phiên bản
 *       {@code [versionFrom, versionTo)}; dòng {@code unitKey = "*"} là "Sở điều chỉnh chung".</li>
 *   <li>{@code DeptLedgerYear} — dãy phiên bản CHUNG của năm + trạng thái khoá năm
 *       ({@code DeptYearLockState}).</li>
 *   <li>{@code DeptChange} — lịch sử theo phiên bản (dùng chung cho mốc báo cáo năm).</li>
 * </ul>
 *
 * <p><b>Phiên bản</b>: mọi lần lưu ở bất kỳ kỳ / biểu nào lấy số kế tiếp của năm, nên "số liệu năm ở
 * phiên bản k" là một trạng thái nhất quán. Báo cáo năm nộp lên chỉ cần GHIM {@link #currentVersion}
 * lúc nộp rồi luôn đọc {@link #data} ở đúng phiên bản đó.
 *
 * <p><b>Khoá năm</b> (UC-60): ghi qua {@code module/asxh/dept/service/DeptYearLockService}
 * ({@code lock(year, state, note)} khi nộp / UBND duyệt, {@code unlock(year, note)} khi trả lại / mở
 * lại, {@code recordYearEvent(...)} để mốc hiện trong lịch sử năm). Số liệu kỳ chỉ ĐỌC khoá này để
 * chặn sửa.
 *
 * <p>Mọi phương thức chỉ đọc, không kiểm quyền — nơi gọi tự kiểm ({@code summary:read} /
 * {@code annual_reports:read}).
 */
public interface DeptYearDataQuery {

    /** Phiên bản số liệu Sở mới nhất của năm; 0 = năm chưa có kỳ nào lưu số liệu. */
    int currentVersion(int year);

    /**
     * Mọi kỳ của năm có biểu thiết lập, kèm tình trạng số liệu Sở, cũ trước. Kỳ chưa lưu mà trùng thời
     * gian với kỳ đã lưu không liệt kê (năm không cộng nó).
     */
    List<DeptYearPeriod> periods(int year);

    /**
     * Số liệu năm ở phiên bản {@code version}, đúng dạng {@code /api/summary/data} (script tổng hợp năm
     * dùng lại y nguyên). Chỉ kỳ nằm TRỌN trong {@code [from, to]} (null = cả năm); gộp qua các kỳ theo
     * bản chất chỉ tiêu (người = MAX, tiền = cộng, đơn giá = kỳ cuối; dòng điều chỉnh chung lấy kỳ cuối).
     *
     * @param version     phiên bản năm (1..{@link #currentVersion}); ngoài khoảng → danh sách rỗng
     * @param unitIds     {@code null} = mọi đơn vị (kể cả dòng điều chỉnh chung); có tập thì bỏ dòng điều chỉnh chung
     * @param templateId  chỉ số của một biểu; {@code null} = mọi biểu
     * @param groupByUnit {@code true} = mỗi đơn vị một dòng (điều chỉnh chung thành dòng {@code TONG_HOP}
     *                    tên "Sở điều chỉnh chung"); {@code false} = một dòng mỗi chỉ tiêu
     */
    List<DeptDataRow> data(int year, int version, LocalDate from, LocalDate to, Set<Long> unitIds,
                           Long templateId, boolean groupByUnit);

    /**
     * Các biểu Sở sửa được mà CHƯA "Kiểm tra &amp; hoàn tất" hoặc còn bảng sửa dở, dạng câu ngắn
     * ("biểu 1a của Quý I/2026") — điều kiện chặn nộp báo cáo năm (UC-59). Rỗng = nộp được.
     */
    List<String> unfinishedSheets(int year);

    /** Lịch sử số liệu Sở của năm (mọi kỳ + mốc báo cáo năm), mới trước. */
    List<DeptHistoryEntry> yearHistory(int year);

    /** Lý do năm đang khoá sửa (đã nộp / đã duyệt); rỗng = Sở còn sửa được. */
    Optional<String> lockReason(int year);
}
