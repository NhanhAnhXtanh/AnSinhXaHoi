package com.dth.frw.module.asxh.period.service;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportCalendar;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.module.asxh.period.api.dto.ReportPeriodPatchRequest;
import com.dth.frw.module.asxh.period.repo.ReportPeriodRepository;
import com.dth.frw.module.asxh.period.repo.ReportPeriodSpecifications;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.rowlevel.Action;
import com.dth.frw.shared.web.ListParams;
import java.time.LocalDate;
import java.util.Collection;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Kỳ báo cáo: đọc, tinh chỉnh cửa sổ nhập, sinh kỳ theo lịch (UC-20), đổi trạng thái.
 *
 * <p>Port từ {@code AnnualReportingPeriodService} (sinh kỳ), {@code QtReportingPeriodEntityListener}
 * (kiểm mốc ngày), {@code ReportPeriodLifecycleService.transition} (bảng chuyển trạng thái)
 * và {@code ReportingPeriodStatusJob} (tự chuyển theo ngày) của bản Jmix.
 *
 * <p><b>API cho slice khác</b> (thiết lập kỳ, phiếu nhập — gọi service này, không gọi
 * repository): {@link #get(Long)}, {@link #getMany(Collection)}, {@link #transition},
 * {@link #changeDeadline}, {@link #findOverlapping(ReportPeriod)}.
 *
 * <p>Kỳ <b>đã dùng</b> = đã rời "Chưa thiết lập" ({@code DRAFT}). Bản cũ còn đếm dòng gán
 * đơn vị / phiếu / đợt phát hành; ở đây trạng thái {@code READY} trở lên đã hàm ý điều
 * đó, và nếu lọt thì khoá ngoại {@code RESTRICT} từ bảng thiết lập/phiếu chặn lần xoá.
 */
@Service
@Transactional(readOnly = true)
public class ReportPeriodService {

    private static final Logger log = LoggerFactory.getLogger(ReportPeriodService.class);

    private static final String RESOURCE = "Kỳ báo cáo";

    private static final Set<String> SORTABLE = Set.of(
            "id", "kind", "seq", "code", "name", "fromDate", "toDate", "openFrom", "deadline",
            "status", "createdAt", "updatedAt");

    private static final Sort DEFAULT_SORT = Sort.by(
            Sort.Order.asc("fromDate"), Sort.Order.asc("toDate"), Sort.Order.asc("id"));

    /** Trạng thái do job ngày tự cập nhật; các trạng thái khác thuộc máy trạng thái nghiệp vụ. */
    private static final Set<PeriodStatus> DATE_DRIVEN =
            EnumSet.of(PeriodStatus.PUBLISHED, PeriodStatus.OPEN, PeriodStatus.OVERDUE);

    private final ReportPeriodRepository repository;
    private final RowLevelSecurity rowLevel;

    public ReportPeriodService(ReportPeriodRepository repository, RowLevelSecurity rowLevel) {
        this.repository = repository;
        this.rowLevel = rowLevel;
    }

    /** Kết quả sinh kỳ: "Đã tạo N kỳ; bỏ qua M kỳ đã tồn tại." */
    public record GenerationResult(int created, int skipped) {
    }

    // ------------------------------------------------------------------
    // Đọc
    // ------------------------------------------------------------------

    public Page<ReportPeriod> list(ListParams params) {
        return repository.findAll(
                rowLevel.scope(ReportPeriod.class, Action.READ)
                        .and(ReportPeriodSpecifications.from(params)),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public ReportPeriod get(Long id) {
        return repository.findOne(rowLevel.byId(ReportPeriod.class, Action.READ, id))
                .orElseThrow(() -> new ResourceNotFoundException(RESOURCE, id));
    }

    public List<ReportPeriod> getMany(Collection<Long> ids) {
        return repository.findAll(rowLevel.byIds(ReportPeriod.class, Action.READ, ids));
    }

    public List<ReportPeriod> listByCalendar(Long calendarId) {
        return repository.findByCalendarId(calendarId);
    }

    public long countByCalendar(Long calendarId) {
        return repository.countByCalendarId(calendarId);
    }

    /** Số kỳ theo từng lịch, một câu truy vấn. Lịch không có kỳ vắng mặt trong map. */
    public Map<Long, Long> countByCalendars(Collection<Long> calendarIds) {
        Map<Long, Long> counts = new HashMap<>();
        if (calendarIds.isEmpty()) {
            return counts;
        }
        for (Object[] row : repository.countByCalendarIds(calendarIds)) {
            counts.put((Long) row[0], ((Number) row[1]).longValue());
        }
        return counts;
    }

    /** Kỳ đã đem ra dùng — không xoá, không đổi hạn nộp theo lịch. */
    public static boolean isUsed(ReportPeriod period) {
        return period.getStatus() != PeriodStatus.DRAFT;
    }

    /** Loại kỳ có ít nhất một kỳ đã dùng — không bỏ được khỏi lịch (UC-21 2c). */
    public Set<PeriodKind> usedKinds(Long calendarId) {
        return repository.findByCalendarId(calendarId).stream()
                .filter(ReportPeriodService::isUsed)
                .map(ReportPeriod::getKind)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(PeriodKind.class)));
    }

    /**
     * Các kỳ có khoảng số liệu giao với kỳ này (trừ chính nó) — đầu vào cho luật khoá
     * cả kỳ khi trùng thời gian với kỳ đã mở đợt (UC-31, slice thiết lập).
     */
    public List<ReportPeriod> findOverlapping(ReportPeriod period) {
        return repository.findOverlapping(period.getFromDate(), period.getToDate(), period.getId());
    }

    // ------------------------------------------------------------------
    // Sửa tay / xoá một kỳ
    // ------------------------------------------------------------------

    /**
     * Sở tinh chỉnh cửa sổ nhận nhập liệu. Chỉ cho kỳ chưa mở đợt (Chưa thiết lập / Đã
     * thiết lập): hạn của kỳ đã mở đã báo cho đơn vị, muốn dời thì dùng Gia hạn.
     */
    @Transactional
    public ReportPeriod update(Long id, ReportPeriodPatchRequest request) {
        ReportPeriod period = repository.findOne(rowLevel.byId(ReportPeriod.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException(RESOURCE, id));

        if (period.getStatus() != PeriodStatus.DRAFT && period.getStatus() != PeriodStatus.READY) {
            throw new ConflictException("Kỳ " + period.getName() + " đang ở trạng thái \""
                    + period.getStatus().label() + "\" nên không sửa được cửa sổ nhập liệu. "
                    + "Muốn dời hạn nộp, hãy dùng Gia hạn.");
        }

        LocalDate openFrom = request.openFrom() != null ? request.openFrom() : period.getOpenFrom();
        LocalDate deadline = request.deadline() != null ? request.deadline() : period.getDeadline();
        requireOrdered("Cửa sổ nhận nhập liệu", openFrom, deadline);

        period.setOpenFrom(openFrom);
        period.setDeadline(deadline);
        rowLevel.checkWritable(period);
        return repository.persist(period);
    }

    /** Chỉ xoá được kỳ chưa thiết lập; kỳ đã gán đơn vị bị khoá ngoại chặn. */
    @Transactional
    public ReportPeriod delete(Long id) {
        ReportPeriod period = repository.findOne(rowLevel.byId(ReportPeriod.class, Action.DELETE, id))
                .orElseThrow(() -> new ResourceNotFoundException(RESOURCE, id));
        if (isUsed(period)) {
            throw new ConflictException("Chỉ xoá được kỳ \"Chưa thiết lập\". Kỳ " + period.getName()
                    + " đang ở trạng thái \"" + period.getStatus().label() + "\".");
        }
        repository.remove(period);
        flushOrConflict("Không thể xoá kỳ " + period.getName() + " vì đã được gán cho đơn vị hoặc đã có phiếu.");
        return period;
    }

    // ------------------------------------------------------------------
    // Sinh / cập nhật kỳ theo lịch (gọi từ ReportCalendarService)
    // ------------------------------------------------------------------

    /**
     * Sinh đủ kỳ của các loại đã chọn cho lịch (UC-20). Kỳ đã có (cùng loại, cùng số thứ
     * tự) được bỏ qua — không sửa ngày, trạng thái, cấu hình — nên chạy lại là idempotent.
     */
    @Transactional
    public GenerationResult generate(ReportCalendar calendar, Collection<PeriodKind> kinds, int deadlineDays) {
        List<PeriodPlanner.PeriodPlan> plans = PeriodPlanner.plan(calendar.getYear(), kinds, deadlineDays);
        Set<String> existing = new HashSet<>();
        for (ReportPeriod period : repository.findByCalendarId(calendar.getId())) {
            existing.add(slot(period.getKind(), period.getSeq()));
        }
        int created = 0;
        int skipped = 0;
        for (PeriodPlanner.PeriodPlan plan : plans) {
            if (!existing.add(slot(plan.kind(), plan.seq()))) {
                skipped++;
                continue;
            }
            repository.persist(new ReportPeriod(calendar, plan.kind(), plan.seq(), plan.code(), plan.name(),
                    plan.fromDate(), plan.toDate(), plan.openFrom(), plan.deadline()));
            created++;
        }
        repository.flush();
        return new GenerationResult(created, skipped);
    }

    /** Có kỳ nào của lịch trùng (loại, số thứ tự) không — cho khung xem trước. */
    public Set<String> existingSlots(Long calendarId) {
        return repository.findByCalendarId(calendarId).stream()
                .map(period -> slot(period.getKind(), period.getSeq()))
                .collect(Collectors.toSet());
    }

    /** Khoá (loại, số thứ tự) dùng để so kỳ dự kiến với kỳ đã có. */
    public static String slot(PeriodKind kind, int seq) {
        return kind.name() + "#" + seq;
    }

    /**
     * Xoá toàn bộ kỳ thuộc các loại bị bỏ khỏi lịch (UC-21). Người gọi đã kiểm không kỳ
     * nào trong số đó đã dùng; khoá ngoại là lưới chặn thứ hai.
     *
     * @return số kỳ đã xoá
     */
    @Transactional
    public int removeKinds(Long calendarId, Set<PeriodKind> kinds) {
        if (kinds.isEmpty()) {
            return 0;
        }
        List<ReportPeriod> toRemove = repository.findByCalendarId(calendarId).stream()
                .filter(period -> kinds.contains(period.getKind()))
                .toList();
        toRemove.forEach(repository::remove);
        flushOrConflict("Không bỏ được loại kỳ vì có kỳ đã được gán cho đơn vị hoặc đã có phiếu.");
        return toRemove.size();
    }

    /**
     * Tính lại hạn nộp {@code = ngày cuối kỳ + số ngày} cho kỳ CHƯA dùng của lịch; kỳ đã
     * dùng giữ hạn cũ — hạn đó đã báo cho đơn vị (BR-21.2).
     *
     * @return số kỳ được tính lại
     */
    @Transactional
    public int reschedule(Long calendarId, int deadlineDays, Set<PeriodKind> skipKinds) {
        PeriodPlanner.requireValidDeadline(deadlineDays);
        int count = 0;
        for (ReportPeriod period : repository.findByCalendarId(calendarId)) {
            if (isUsed(period) || skipKinds.contains(period.getKind())) {
                continue;
            }
            period.setDeadline(PeriodPlanner.deadlineFor(period.getToDate(), deadlineDays));
            repository.persist(period);
            count++;
        }
        return count;
    }

    /** Xoá mọi kỳ của lịch (UC-08); người gọi đã kiểm không kỳ nào đã dùng. */
    @Transactional
    public void deleteAllOfCalendar(Long calendarId) {
        repository.findByCalendarId(calendarId).forEach(repository::remove);
        flushOrConflict("Không thể xoá lịch năm vì đã có kỳ được gán cho đơn vị.");
    }

    // ------------------------------------------------------------------
    // Trạng thái (gọi từ slice thiết lập và job ngày)
    // ------------------------------------------------------------------

    /**
     * Chuyển trạng thái theo bảng {@link PeriodStatus#canMoveTo}. Không kiểm điều kiện
     * nghiệp vụ của từng thao tác (đã gán biểu chưa, năm đã nộp UBND chưa…) — đó là việc
     * của slice gọi.
     */
    @Transactional
    public ReportPeriod transition(Long id, PeriodStatus target) {
        ReportPeriod period = repository.findOne(rowLevel.byId(ReportPeriod.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException(RESOURCE, id));
        if (period.getStatus() == target) {
            return period;
        }
        if (!period.getStatus().canMoveTo(target)) {
            throw new ConflictException("Không thể chuyển kỳ " + period.getName() + " từ \""
                    + period.getStatus().label() + "\" sang \"" + target.label() + "\".");
        }
        period.setStatus(target);
        rowLevel.checkWritable(period);
        return repository.persist(period);
    }

    /**
     * Đặt hạn nộp mới, không xét trạng thái — dùng cho Gia hạn (UC-28) ở slice thiết lập,
     * thường đi cùng {@link #transition} sang {@code OPEN} trong cùng transaction (dời
     * hạn trước, nếu không job đêm sau lại đưa kỳ về Quá hạn).
     */
    @Transactional
    public ReportPeriod changeDeadline(Long id, LocalDate deadline) {
        ReportPeriod period = repository.findOne(rowLevel.byId(ReportPeriod.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException(RESOURCE, id));
        if (deadline == null) {
            throw new IllegalArgumentException("Vui lòng chọn hạn nộp mới.");
        }
        requireOrdered("Cửa sổ nhận nhập liệu", period.getOpenFrom(), deadline);
        period.setDeadline(deadline);
        rowLevel.checkWritable(period);
        return repository.persist(period);
    }

    /**
     * Tự chuyển trạng thái theo ngày cho kỳ Chưa mở / Đang mở / Quá hạn
     * (port {@code ReportingPeriodStatusJob.computeStatus}):
     * <ul>
     *   <li>{@code openFrom ≤ hôm nay ≤ deadline} → Đang mở;</li>
     *   <li>{@code hôm nay > deadline} → Quá hạn;</li>
     *   <li>còn lại giữ nguyên.</li>
     * </ul>
     * Mỗi kỳ độc lập: lỗi một kỳ không chặn kỳ khác; lần chạy sau tự chữa.
     *
     * @return số kỳ đã đổi trạng thái
     */
    @Transactional
    public int applyDateStatuses(LocalDate today) {
        int updated = 0;
        for (ReportPeriod period : repository.findByStatusIn(DATE_DRIVEN)) {
            PeriodStatus next = dateStatus(period, today);
            if (next == null || next == period.getStatus() || !period.getStatus().canMoveTo(next)) {
                continue;
            }
            period.setStatus(next);
            repository.persist(period);
            updated++;
        }
        log.info("Cập nhật trạng thái kỳ theo ngày {}: đổi {} kỳ.", today, updated);
        return updated;
    }

    static PeriodStatus dateStatus(ReportPeriod period, LocalDate today) {
        LocalDate openFrom = period.getOpenFrom();
        LocalDate deadline = period.getDeadline();
        if (openFrom != null && !today.isBefore(openFrom) && (deadline == null || !today.isAfter(deadline))) {
            return PeriodStatus.OPEN;
        }
        if (deadline != null && today.isAfter(deadline)) {
            return PeriodStatus.OVERDUE;
        }
        return null;
    }

    // ------------------------------------------------------------------

    /** BR-20.2: ngày kết thúc không được trước ngày bắt đầu. */
    private static void requireOrdered(String label, LocalDate from, LocalDate to) {
        if (from != null && to != null && to.isBefore(from)) {
            throw new IllegalArgumentException(label + " không hợp lệ: ngày kết thúc (" + to
                    + ") trước ngày bắt đầu (" + from + ").");
        }
    }

    /**
     * Flush ngay để khoá ngoại {@code RESTRICT} từ bảng khác báo lỗi tại đây, đổi thành
     * thông báo tiếng Việt thay cho câu chung của base.
     */
    private void flushOrConflict(String message) {
        try {
            repository.flush();
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException(message);
        }
    }
}
