package com.dth.frw.module.asxh.summary.repo;

import com.dth.frw.domain.asxh.dept.SummarySnapshot;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SummarySnapshotRepository extends JpaRepository<SummarySnapshot, Long> {

    @Query("select s from SummarySnapshot s where s.period.id = :periodId and s.templateVersion.id = :versionId")
    Optional<SummarySnapshot> findOne(@Param("periodId") Long periodId, @Param("versionId") Long versionId);
}
