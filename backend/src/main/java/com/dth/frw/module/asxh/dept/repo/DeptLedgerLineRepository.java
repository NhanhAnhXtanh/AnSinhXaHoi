package com.dth.frw.module.asxh.dept.repo;

import com.dth.frw.domain.asxh.dept.DeptLedgerLine;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Dòng số liệu Sở. Đơn vị nạp kèm ({@code left join fetch}) vì dòng điều chỉnh chung không có đơn vị.
 */
public interface DeptLedgerLineRepository extends JpaRepository<DeptLedgerLine, Long> {

    /** Dòng còn hiệu lực của một biểu. */
    @Query("select l from DeptLedgerLine l left join fetch l.unit "
            + "where l.sheet.id = :sheetId and l.versionTo is null")
    List<DeptLedgerLine> findCurrent(@Param("sheetId") Long sheetId);

    /** Dòng có hiệu lực ở phiên bản {@code version} của một biểu. */
    @Query("select l from DeptLedgerLine l left join fetch l.unit "
            + "where l.sheet.id = :sheetId and l.versionFrom <= :version "
            + "and (l.versionTo is null or l.versionTo > :version)")
    List<DeptLedgerLine> findAt(@Param("sheetId") Long sheetId, @Param("version") int version);

    /** Dòng có hiệu lực ở phiên bản {@code version} của nhiều kỳ (số liệu năm). */
    @Query("select l from DeptLedgerLine l left join fetch l.unit "
            + "where l.report.id in :reportIds and l.versionFrom <= :version "
            + "and (l.versionTo is null or l.versionTo > :version)")
    List<DeptLedgerLine> findAtForReports(@Param("reportIds") Collection<Long> reportIds,
                                          @Param("version") int version);
}
