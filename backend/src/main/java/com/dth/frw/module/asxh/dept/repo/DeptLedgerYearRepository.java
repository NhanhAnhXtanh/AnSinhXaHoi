package com.dth.frw.module.asxh.dept.repo;

import com.dth.frw.domain.asxh.dept.DeptLedgerYear;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DeptLedgerYearRepository extends JpaRepository<DeptLedgerYear, Long> {

    Optional<DeptLedgerYear> findByYear(int year);

    List<DeptLedgerYear> findByYearIn(Collection<Integer> years);

    /**
     * Tạo dòng của năm nếu chưa có. {@code on conflict do nothing}: hai giao dịch cùng tạo thì người
     * sau CHỜ người trước rồi bỏ qua — không làm hỏng giao dịch như bắt lỗi trùng khoá.
     */
    @Modifying
    @Query(value = "insert into asxh_dept_ledger_years (year_no, current_version, lock_state, created_at) "
            + "values (:year, 0, 'OPEN', now()) on conflict (year_no) do nothing", nativeQuery = true)
    int ensureYear(@Param("year") int year);

    /** Khoá dòng của năm đến hết giao dịch — mọi lượt ghi số liệu Sở trong năm xếp hàng tại đây. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select y from DeptLedgerYear y where y.year = :year")
    Optional<DeptLedgerYear> lockByYear(@Param("year") int year);
}
