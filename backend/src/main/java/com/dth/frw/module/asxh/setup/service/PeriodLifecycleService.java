package com.dth.frw.module.asxh.setup.service;

import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.module.asxh.dept.service.DeptPeriodService;
import com.dth.frw.module.asxh.dept.service.DeptYearLockService;
import com.dth.frw.module.asxh.inputreport.service.InputReportService;
import com.dth.frw.module.asxh.period.service.ReportPeriodService;
import com.dth.frw.shared.exception.ConflictException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Điều hành đợt của một kỳ: chốt (UC-27), gia hạn &amp; mở lại (UC-28), thu hồi &amp; thiết lập
 * lại (UC-29), cùng trạng thái tổng hợp cho màn "Thiết lập &amp; điều hành". Port
 * {@code ReportPeriodLifecycleService} của bản Jmix.
 *
 * <p>Kỳ là thực thể của slice kỳ báo cáo; slice này chỉ đổi {@code status} / {@code deadline}
 * trên bản đã nạp qua {@link ReportPeriodService} trong cùng giao dịch.
 */
@Service
@Transactional(readOnly = true)
public class PeriodLifecycleService {

    private static final Set<PeriodStatus> CLOSABLE = EnumSet.of(PeriodStatus.OPEN, PeriodStatus.OVERDUE);

    private static final Set<PeriodStatus> WITHDRAWABLE =
            EnumSet.of(PeriodStatus.PUBLISHED, PeriodStatus.OPEN, PeriodStatus.OVERDUE);

    /**
     * Trạng thái điều hành của một kỳ, đủ để màn hình bật/tắt nút mà không phải tự suy luật.
     * Các cờ {@code can…} chỉ là gợi ý cho giao diện — máy chủ vẫn kiểm lại khi bấm.
     */
    public record SetupState(
            ReportPeriod period,
            boolean locked,
            String lockReason,
            Long lockSourceId,
            String lockSourceName,
            long assignmentCount,
            List<IssuedCell> issuedCells,
            boolean initialPublished,
            boolean canAssign,
            boolean canRemove,
            boolean canPublish,
            boolean canPublishSupplemental,
            boolean canClose,
            boolean canExtend,
            boolean canWithdraw,
            String readOnlyReason) {
    }

    /** Một ô (đơn vị × biểu) đã phát phiếu — ô này không bỏ tích được nữa (UC-22 5a). */
    public record IssuedCell(Long unitId, Long templateId) {
    }

    /**
     * Lý do khoá cả kỳ của một kỳ (UC-31), kèm kỳ gây khoá để màn hình nêu tên
     * ("Hãy thiết lập ở …").
     */
    public record PeriodLockInfo(Long periodId, String kind, String reason, Long sourcePeriodId,
                                 String sourcePeriodName) {
    }

    private final ReportPeriodService periodService;
    private final PeriodSetupLockService lockService;
    private final PublicationService publicationService;
    private final PeriodAssignmentService assignmentService;
    private final InputReportService inputReportService;
    // Số liệu tổng hợp Sở (slice dept): lưu số liệu khi chốt đợt, chặn thu hồi kỳ đang là nguồn,
    // khoá năm đã nộp báo cáo năm lên UBND.
    private final DeptPeriodService deptPeriodService;
    private final DeptYearLockService yearLockService;

    public PeriodLifecycleService(ReportPeriodService periodService,
                                  PeriodSetupLockService lockService,
                                  PublicationService publicationService,
                                  PeriodAssignmentService assignmentService,
                                  InputReportService inputReportService,
                                  DeptPeriodService deptPeriodService,
                                  DeptYearLockService yearLockService) {
        this.periodService = periodService;
        this.lockService = lockService;
        this.publicationService = publicationService;
        this.assignmentService = assignmentService;
        this.inputReportService = inputReportService;
        this.deptPeriodService = deptPeriodService;
        this.yearLockService = yearLockService;
    }

    public SetupState setupState(Long periodId) {
        ReportPeriod period = periodService.get(periodId);
        Optional<PeriodSetupLockService.PeriodLock> lock = lockService.lock(period);
        long assignments = assignmentService.countForPeriod(periodId);
        boolean initial = publicationService.hasInitialPublication(periodId);
        PeriodStatus status = period.getStatus();
        boolean locked = lock.isPresent();

        boolean configurable = status == PeriodStatus.DRAFT || status == PeriodStatus.READY;
        boolean open = status == PeriodStatus.OPEN;
        String readOnlyReason = null;
        if (locked) {
            readOnlyReason = lock.get().reason();
        } else if (!configurable && !open) {
            readOnlyReason = "Kỳ này đã chốt hoặc đã khoá nên chỉ xem được, không tích thêm biểu mẫu.";
        }

        return new SetupState(
                period,
                locked,
                lock.map(PeriodSetupLockService.PeriodLock::reason).orElse(null),
                lock.map(PeriodSetupLockService.PeriodLock::sourceId).orElse(null),
                lock.map(PeriodSetupLockService.PeriodLock::sourceName).orElse(null),
                assignments,
                issuedCells(periodId),
                initial,
                !locked && (configurable || open),
                configurable && assignments > 0,
                !locked && !initial && status == PeriodStatus.READY && assignments > 0,
                !locked && initial && open,
                CLOSABLE.contains(status),
                // Năm đã nộp UBND thì không mở lại kỳ nào (UC-28 3b); máy chủ kiểm lại khi bấm.
                status == PeriodStatus.OVERDUE
                        && lock.map(found -> found.kind() != PeriodSetupLockService.LockKind.YEAR).orElse(true),
                WITHDRAWABLE.contains(status),
                readOnlyReason);
    }

    /** Khoá cả kỳ của nhiều kỳ một lượt — cho nhãn "Đã khoá" ở danh sách kỳ. */
    public List<PeriodLockInfo> locks(List<Long> periodIds) {
        List<ReportPeriod> periods = new ArrayList<>();
        for (Long id : new LinkedHashSet<>(periodIds)) {
            periods.add(periodService.get(id));
        }
        Map<Long, PeriodSetupLockService.PeriodLock> locks = lockService.locks(periods);
        List<PeriodLockInfo> result = new ArrayList<>();
        locks.forEach((id, lock) -> result.add(new PeriodLockInfo(
                id, lock.kind().name(), lock.reason(), lock.sourceId(), lock.sourceName())));
        return result;
    }

    /** Các ô đã phát phiếu của kỳ, đọc từ dạng {@code "unitId:templateId"} của slice phiếu. */
    private List<IssuedCell> issuedCells(Long periodId) {
        List<IssuedCell> cells = new ArrayList<>();
        for (String pair : inputReportService.issuedPairs(periodId)) {
            int colon = pair.indexOf(':');
            if (colon <= 0) {
                continue;
            }
            try {
                cells.add(new IssuedCell(Long.valueOf(pair.substring(0, colon)), Long.valueOf(pair.substring(colon + 1))));
            } catch (NumberFormatException ignored) {
                // cặp hỏng không thể khớp ô nào trên ma trận
            }
        }
        return cells;
    }

    /**
     * Chốt đợt (UC-27): kỳ Đang mở / Quá hạn → Đã đóng; phiếu Đang nhập / Bị trả lại → Đã chốt.
     * Phiếu đã duyệt giữ nguyên; còn phiếu chờ duyệt thì không chốt (3a). Kỳ đã chốt không mở lại
     * được (BR-27.4).
     *
     * <p>Chốt đợt = lưu số liệu tổng hợp của kỳ (BR-27.1) trong CÙNG giao dịch: chụp số tổng hợp
     * mọi biểu theo từng đơn vị ({@code DeptPeriodService.snapshotClosedPeriod}). Bỏ qua (không lỗi)
     * khi kỳ đã có số liệu, trùng thời gian với kỳ khác đã lưu (3b), năm đang khoá, hoặc không có
     * biểu — khi đó màn Tổng hợp còn nút "Lưu số liệu" kèm lý do.
     */
    @Transactional
    public ReportPeriod close(Long periodId) {
        ReportPeriod period = periodService.get(periodId);
        if (!CLOSABLE.contains(period.getStatus())) {
            throw new ConflictException("Chỉ chốt được kỳ đang mở hoặc quá hạn; kỳ " + period.getName()
                    + " đang ở trạng thái " + PublicationService.statusLabel(period.getStatus()) + ".");
        }
        List<String> awaiting = inputReportService.unitsAwaitingReview(periodId);
        if (!awaiting.isEmpty()) {
            String names = String.join(", ", awaiting.stream().limit(5).toList());
            if (awaiting.size() > 5) {
                names += " và " + (awaiting.size() - 5) + " đơn vị khác";
            }
            throw new ConflictException("Kỳ " + period.getName() + " còn " + awaiting.size()
                    + " đơn vị đã nộp nhưng chưa được duyệt hoặc trả lại: " + names
                    + ". Duyệt hoặc trả lại hết trước khi chốt đợt.");
        }
        inputReportService.lockOpenReports(periodId);
        ReportPeriod closed = periodService.transition(periodId, PeriodStatus.CLOSED);
        deptPeriodService.snapshotClosedPeriod(closed);
        return closed;
    }

    /**
     * Gia hạn &amp; mở lại (UC-28): dời hạn nộp và đưa kỳ Quá hạn về Đang mở trong CÙNG giao dịch
     * — chỉ đổi trạng thái mà giữ hạn cũ (đã qua) thì việc tự chuyển trạng thái hằng đêm lại đóng
     * kỳ ngay hôm sau (BR-28.1).
     *
     * <p>Khoá năm (3b, UC-60): năm đã nộp báo cáo lên UBND thì không mở lại kỳ nào của năm.
     */
    @Transactional
    public ReportPeriod extend(Long periodId, LocalDate newDeadline) {
        ReportPeriod period = periodService.get(periodId);
        if (period.getStatus() != PeriodStatus.OVERDUE) {
            throw new ConflictException("Chỉ gia hạn được kỳ đã quá hạn; kỳ " + period.getName()
                    + " đang ở trạng thái " + PublicationService.statusLabel(period.getStatus()) + ".");
        }
        if (period.getYear() != null) {
            yearLockService.assertOpen(period.getYear());
        }
        if (newDeadline == null || newDeadline.isBefore(LocalDate.now())) {
            throw new ConflictException("Hạn nộp mới phải từ hôm nay trở đi.");
        }
        // Dời hạn TRƯỚC rồi mới mở lại, cùng giao dịch.
        periodService.changeDeadline(periodId, newDeadline);
        return periodService.transition(periodId, PeriodStatus.OPEN);
    }

    /**
     * Thu hồi &amp; thiết lập lại (UC-29) — thao tác phá huỷ cao nhất (mất cả số đã duyệt) nên phải
     * gõ đúng tên kỳ (BR-29.1). Trong một giao dịch: huỷ mọi đợt còn hiệu lực, xoá mọi phiếu và
     * tờ biểu của kỳ, đưa kỳ về Đã thiết lập. Thiết lập (đơn vị × biểu) giữ nguyên; lần mở sau
     * tính là lần đầu (BR-29.2).
     *
     * <p>Chặn khi kỳ đang là nguồn số liệu tổng hợp đã lưu (3a) — của chính nó hoặc của kỳ dài hơn
     * chứa nó: xoá phiếu lúc đó là rút mất nguồn của số đã lưu / đã nộp UBND.
     */
    @Transactional
    public ReportPeriod withdraw(Long periodId, String confirmName) {
        ReportPeriod period = periodService.get(periodId);
        if (!WITHDRAWABLE.contains(period.getStatus())) {
            throw new ConflictException(period.getStatus() == PeriodStatus.READY
                    ? "Chỉ thu hồi được sau khi đã mở đợt."
                    : "Không thể thu hồi kỳ đang ở trạng thái "
                            + PublicationService.statusLabel(period.getStatus()) + ".");
        }
        if (deptPeriodService.isUsedBy(period)) {
            throw new ConflictException("Kỳ " + period.getName() + " đã được lưu vào số liệu tổng hợp "
                    + "(của chính kỳ này hoặc của kỳ dài hơn chứa nó) nên không thu hồi được.");
        }
        String typed = confirmName == null ? "" : confirmName.trim();
        if (!typed.equals(period.getName() == null ? "" : period.getName().trim())) {
            throw new ConflictException("Tên kỳ gõ vào không khớp với \"" + period.getName() + "\". Chưa thu hồi.");
        }
        // Phiếu trước (chúng trỏ về đợt), đợt sau, trạng thái kỳ cuối cùng.
        inputReportService.deleteAllForPeriod(periodId);
        publicationService.cancelAll(periodId);
        return periodService.transition(periodId, PeriodStatus.READY);
    }
}
