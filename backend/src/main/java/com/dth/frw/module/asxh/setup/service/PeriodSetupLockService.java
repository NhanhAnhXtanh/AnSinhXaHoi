package com.dth.frw.module.asxh.setup.service;

import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.PublicationStatus;
import com.dth.frw.module.asxh.setup.repo.PublicationRepository;
import com.dth.frw.shared.exception.ConflictException;
import java.time.LocalDate;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Khoá CẢ KỲ (mọi đơn vị) — UC-31, port {@code PeriodSetupLockService} của bản Jmix.
 *
 * <p>Khác luật chống chồng kỳ THEO TỪNG ĐƠN VỊ của ma trận (BR-22.2, ở
 * {@link PeriodAssignmentService}): ở đây chỉ cần một kỳ KHÁC có thời gian giao nhau đã mở đợt
 * báo cáo là kỳ này không thiết lập thêm và không mở đợt được nữa cho bất kỳ đơn vị nào. Ví dụ
 * đã mở đợt Quý I thì Tháng 1, 2, 3, 6 tháng đầu năm và Năm bị khoá; Tháng 4, 5, 6 vẫn dùng được.
 *
 * <p>"Đã mở đợt" = còn đợt phát hành hiệu lực VÀ kỳ ở một trong {@link #OPENED_STATUSES} (từ lúc
 * phát phiếu trở đi, kể cả đã hết hạn / đã chốt). Thu hồi kỳ huỷ đợt và đưa kỳ về READY nên tự
 * gỡ khoá cho các kỳ trùng.
 *
 * <p>TODO: lý do thứ hai của bản Jmix — NĂM ĐÃ CHỐT (năm của kỳ có báo cáo năm đang chờ UBND hoặc
 * đã được duyệt) — chưa port vì chưa có báo cáo năm; khi có, xét lý do năm TRƯỚC lý do trùng kỳ.
 *
 * <p>Lý do trả về là câu chữ cho người dùng đọc (BR-31.2), không kèm mã lỗi.
 */
@Service
@Transactional(readOnly = true)
public class PeriodSetupLockService {

    public static final Set<PeriodStatus> OPENED_STATUSES = EnumSet.of(
            PeriodStatus.PUBLISHED, PeriodStatus.OPEN, PeriodStatus.OVERDUE, PeriodStatus.CLOSED, PeriodStatus.LOCKED);

    public enum LockKind {
        /** Năm đã nộp báo cáo lên UBND. TODO: chưa dùng — xem javadoc lớp. */
        YEAR,
        /** Có kỳ trùng thời gian đã mở đợt. */
        OVERLAP
    }

    public record PeriodLock(LockKind kind, String reason) {
    }

    private final PublicationRepository publicationRepository;

    public PeriodSetupLockService(PublicationRepository publicationRepository) {
        this.publicationRepository = publicationRepository;
    }

    /** Kỳ bị khoá trong các kỳ đưa vào (id kỳ → lý do); kỳ không có trong kết quả là còn dùng được. */
    public Map<Long, PeriodLock> locks(Collection<ReportPeriod> periods) {
        Map<Long, PeriodLock> locks = new LinkedHashMap<>();
        if (periods == null || periods.isEmpty()) {
            return locks;
        }
        LocalDate from = periods.stream().map(ReportPeriod::getFromDate)
                .filter(Objects::nonNull).min(Comparator.naturalOrder()).orElse(null);
        LocalDate to = periods.stream().map(ReportPeriod::getToDate)
                .filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
        if (from == null || to == null) {
            return locks;
        }
        List<ReportPeriod> opened = publicationRepository.findOpenedPeriodsOverlapping(
                        PublicationStatus.PUBLISHED, OPENED_STATUSES, from, to).stream()
                .sorted(Comparator.comparing(ReportPeriod::getFromDate, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(ReportPeriod::getToDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        for (ReportPeriod period : periods) {
            opened.stream()
                    .filter(other -> !Objects.equals(other.getId(), period.getId()))
                    .filter(other -> overlaps(period, other))
                    .findFirst()
                    .ifPresent(other -> locks.put(period.getId(), new PeriodLock(LockKind.OVERLAP,
                            "Kỳ " + period.getName() + " không thiết lập hay mở đợt được nữa vì kỳ "
                                    + other.getName() + " đã mở đợt báo cáo cho cùng khoảng thời gian.")));
        }
        return locks;
    }

    public Optional<PeriodLock> lock(ReportPeriod period) {
        return period == null ? Optional.empty() : Optional.ofNullable(locks(List.of(period)).get(period.getId()));
    }

    /** @throws ConflictException khi kỳ bị khoá cả kỳ */
    public void assertSetupAllowed(ReportPeriod period) {
        lock(period).ifPresent(found -> {
            throw new ConflictException(found.reason());
        });
    }

    /** Lý do gộp của nhiều kỳ, mỗi lý do một lần — cho câu báo lỗi khi ghi nhiều kỳ cùng lúc. */
    public static String joinReasons(Collection<PeriodLock> locks) {
        return locks.stream().map(PeriodLock::reason).distinct().collect(Collectors.joining(" "));
    }

    static boolean overlaps(ReportPeriod first, ReportPeriod second) {
        if (first.getFromDate() == null || first.getToDate() == null
                || second.getFromDate() == null || second.getToDate() == null) {
            return false;
        }
        return !first.getToDate().isBefore(second.getFromDate())
                && !second.getToDate().isBefore(first.getFromDate());
    }
}
