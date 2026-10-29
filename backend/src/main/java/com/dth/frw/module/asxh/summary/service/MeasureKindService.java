package com.dth.frw.module.asxh.summary.service;

import com.dth.frw.domain.asxh.dept.IndicatorMeasure;
import com.dth.frw.domain.asxh.dept.MeasureKind;
import com.dth.frw.module.asxh.summary.repo.IndicatorMeasureRepository;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bản chất đại lượng của các mã chỉ tiêu (bảng {@code asxh_indicator_measures}). Mã chưa khai rơi về
 * {@link MeasureKind#DEFAULT} ở nơi dùng — giữ hành vi bản Jmix với chỉ tiêu chưa phân loại.
 */
@Service
@Transactional(readOnly = true)
public class MeasureKindService {

    private final IndicatorMeasureRepository repository;

    public MeasureKindService(IndicatorMeasureRepository repository) {
        this.repository = repository;
    }

    /** Mã → bản chất, chỉ những mã đã khai. */
    public Map<String, MeasureKind> kindsOf(Collection<String> indicatorCodes) {
        Map<String, MeasureKind> result = new HashMap<>();
        if (indicatorCodes == null || indicatorCodes.isEmpty()) {
            return result;
        }
        for (IndicatorMeasure measure : repository.findByIndicatorCodeIn(indicatorCodes)) {
            if (measure.getMeasureKind() != null) {
                result.put(measure.getIndicatorCode(), measure.getMeasureKind());
            }
        }
        return result;
    }
}
