package com.dth.frw.module.asxh.summary.repo;

import com.dth.frw.domain.asxh.dept.IndicatorMeasure;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IndicatorMeasureRepository extends JpaRepository<IndicatorMeasure, Long> {

    List<IndicatorMeasure> findByIndicatorCodeIn(Collection<String> indicatorCodes);
}
