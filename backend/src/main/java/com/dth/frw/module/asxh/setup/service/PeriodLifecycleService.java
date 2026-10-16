package com.dth.frw.module.asxh.setup.service;

import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
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
            long assignmentCount,
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

    /** Lý do khoá cả kỳ của một kỳ (UC-31). */
    public record PeriodLockInfo(Long periodId, String kind, String reason) {
    }

    private final ReportPeriodService periodService;
    private final PeriodSetupLockService lockService;
    private final PublicationService publicationService;
    private final PeriodAssignmentService assignmentService;
    private final InputReportService inputReportService;

    public PeriodLifecycleService(ReportPeriodService periodService,
                                  PeriodSetupLockService lockService,
                                  PublicationService publicationService,
                                  PeriodAssignmentService assignmentService,
                                  InputReportService inputReportService) {
        this.periodService = periodService;
        this.lockService = lockService;
        this.publicationService = publicationService;
        this.assignmentService = assignmentService;
        this.inputReportService = inputReportService;
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
                assignments,
                initial,
                !locked && (configurable || open),
                configurable && assignments > 0,
                !locked && !initial && status == PeriodStatus.READY && assignments > 0,
                !locked && initial && open,
                CLOSABLE.contains(status),
                status == PeriodStatus.OVERDUE,
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
        locks.forEach((id, lock) -> result.add(new PeriodLockInfo(id, lock.kind().name(), lock.reason())));
        return result;
    }

    /**
     * Chốt đợt (UC-27): kỳ Đang mở / Quá hạn → Đã đóng; phiếu Đang nhập / Bị trả lại → Đã chốt.
     * Phiếu đã duyệt giữ nguyên; còn phiếu chờ duyệt thì không chốt (3a). Kỳ đã chốt không mở lại
     * được (BR-27.4).
     *
     * <p>TODO: chốt đợt = lưu sổ Sở (BR-27.1) — lập phiếu Sở kỳ và chụp số tổng hợp mọi biểu
     * theo từng đơn vị; bỏ qua khi kỳ giao thời gian với kỳ khác đã có sổ Sở (3b). Chưa port
     * phần tổng hợp / sổ cái.
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
        return periodService.transition(periodId, PeriodStatus.CLOSED);
    }

    /**
     * Gia hạn &amp; mở lại (UC-28): dời hạn nộp và đưa kỳ Quá hạn về Đang mở trong CÙNG giao dịch
     * — chỉ đổi trạng thái mà giữ hạn cũ (đã qua) thì việc tự chuyển trạng thái hằng đêm lại đóng
     * kỳ ngay hôm sau (BR-28.1).
     *
     * <p>TODO: khoá năm — năm đã nộp báo cáo lên UBND thì không mở lại (3b).
     */
    @Transactional
    public ReportPeriod extend(Long periodId, LocalDate newDeadline) {
        ReportPeriod period = periodService.get(periodId);
        if (period.getStatus() != PeriodStatus.OVERDUE) {
            throw new ConflictException("Chỉ gia hạn được kỳ đã quá hạn; kỳ " + period.getName()
                    + " đang ở trạng thái " + PublicationService.statusLabel(period.getStatus()) + ".");
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
     * <p>TODO: chặn khi kỳ đang là nguồn của phiếu Sở (3a) và xoá sổ cái của kỳ — chưa port.
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
