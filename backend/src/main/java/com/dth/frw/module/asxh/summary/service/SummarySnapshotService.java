package com.dth.frw.module.asxh.summary.service;

import com.dth.frw.domain.asxh.dept.SummarySnapshot;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.period.service.ReportPeriodService;
import com.dth.frw.module.asxh.summary.repo.SummarySnapshotRepository;
import com.dth.frw.module.asxh.template.service.TemplateVersionService;
import com.dth.frw.shared.security.CurrentUser;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ảnh chụp workbook tổng hợp (UC-57, chỉ REST — script gọi qua {@code ctx.api.post}). Ghi đè một bản
 * cho mỗi (kỳ × phiên bản mẫu). Không dùng để tính (BR-57.1).
 */
@Service
public class SummarySnapshotService {

    /** Giới hạn thô chống gửi nhầm tệp khổng lồ (≈ 20 MB ký tự). */
    private static final int MAX_WORKBOOK_CHARS = 20_000_000;

    public record SnapshotResult(Long id, Instant renderedAt) {
    }

    private final SummarySnapshotRepository repository;
    private final ReportPeriodService periodService;
    private final TemplateVersionService versionService;

    public SummarySnapshotService(SummarySnapshotRepository repository,
                                  ReportPeriodService periodService,
                                  TemplateVersionService versionService) {
        this.repository = repository;
        this.periodService = periodService;
        this.versionService = versionService;
    }

    @Transactional
    public SnapshotResult save(Long periodId, Long templateVersionId, String workbookJson) {
        if (periodId == null || templateVersionId == null || workbookJson == null || workbookJson.isBlank()) {
            throw new IllegalArgumentException("Cần đủ kỳ, phiên bản mẫu và bảng tính để lưu ảnh chụp.");
        }
        if (workbookJson.length() > MAX_WORKBOOK_CHARS) {
            throw new IllegalArgumentException("Bảng tính quá lớn, không lưu được ảnh chụp.");
        }
        ReportPeriod period = periodService.get(periodId);
        TemplateVersion version = versionService.get(templateVersionId);
        SummarySnapshot snapshot = repository.findOne(period.getId(), version.getId())
                .orElseGet(() -> new SummarySnapshot(period, version));
        snapshot.setWorkbookJson(workbookJson);
        snapshot.setRenderedAt(Instant.now());
        snapshot.setRenderedBy(CurrentUser.username().orElse(null));
        SummarySnapshot saved = repository.save(snapshot);
        return new SnapshotResult(saved.getId(), saved.getRenderedAt());
    }
}
