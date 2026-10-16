package com.dth.frw.module.asxh.ledger.repo;

import com.dth.frw.domain.asxh.ledger.LedgerEntry;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.shared.data.SecuredRepository;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Số liệu đã lưu. Các phương thức khai thêm là đường ghi / kiểm tra của nghiệp vụ duyệt — chạy
 * trong service đã kiểm quyền và phải thấy MỌI dòng bất kể người gọi (chống cộng đôi mà bỏ sót
 * dòng ngoài tầm nhìn người bấm là chống sai).
 */
public interface LedgerEntryRepository extends SecuredRepository<LedgerEntry, Long> {

    /** Các dòng hiện có của một tờ biểu — để thay toàn bộ khi ghi lại. */
    @Query("select l from LedgerEntry l where l.sheet.id = :sheetId")
    List<LedgerEntry> findBySheetId(@Param("sheetId") Long sheetId);

    /**
     * Chống cộng đôi (UC-41 3.1): đếm dòng CÒN HIỆU LỰC của cùng đơn vị (số liệu hoặc nộp), cùng
     * biểu, ở một phiếu khác thuộc kỳ KHÁC trong cùng năm mà khoảng thời gian giao nhau.
     */
    @Query("select count(l) from LedgerEntry l join l.report r join l.period p "
            + "where (l.unit.id = :unitId or l.submitterUnit.id = :unitId) "
            + "and (r.status = :approved or (r.status = :locked and r.approvedAt is not null)) "
            + "and r.id <> :selfId "
            + "and l.template.id in :templateIds "
            + "and p.id <> :periodId "
            + "and p.calendar.year = :year "
            + "and p.fromDate <= :to and p.toDate >= :from")
    long countOverlappingEffective(@Param("unitId") Long unitId,
                                   @Param("selfId") Long selfReportId,
                                   @Param("templateIds") Collection<Long> templateIds,
                                   @Param("periodId") Long periodId,
                                   @Param("year") Integer year,
                                   @Param("from") LocalDate from,
                                   @Param("to") LocalDate to,
                                   @Param("approved") ReportStatus approved,
                                   @Param("locked") ReportStatus locked);
}
