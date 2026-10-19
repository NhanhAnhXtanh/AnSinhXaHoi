package com.dth.frw.module.asxh.period.service;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.ReportCalendar;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.module.asxh.period.api.dto.ReportCalendarPatchRequest;
import com.dth.frw.module.asxh.period.api.dto.ReportCalendarRequest;
import com.dth.frw.module.asxh.period.repo.ReportCalendarRepository;
import com.dth.frw.module.asxh.period.repo.ReportCalendarSpecifications;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.rowlevel.Action;
import com.dth.frw.shared.web.ListParams;
import java.time.Year;
import java.time.ZoneId;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lịch báo cáo năm — tạo kèm sinh kỳ (UC-06/UC-20), cập nhật loại kỳ và hạn nộp
 * (UC-21), xem trước kỳ sẽ tạo, xoá lịch (UC-08).
 *
 * <p>Port từ {@code ReportCalendarService}, {@code ReportCalendarPeriodUpdateService},
 * {@code ReportCalendarEntityListener} và phần lưu của {@code ReportCalendarDetailView}
 * bản Jmix. Kỳ được sinh/xoá qua {@link ReportPeriodService} (cùng slice).
 */
@Service
@Transactional(readOnly = true)
public class ReportCalendarService {

    private static final String RESOURCE = "Lịch báo cáo";

    private static final Set<String> SORTABLE = Set.of("id", "year", "deadlineDays", "createdAt", "updatedAt");

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.desc("year"));

    /** BR-06.2: năm từ (năm nay − 10) đến (năm nay + 20). */
    private static final int YEARS_BACK = 10;
    private static final int YEARS_AHEAD = 20;

    private final ReportCalendarRepository repository;
    private final ReportPeriodService periodService;
    private final RowLevelSecurity rowLevel;

    public ReportCalendarService(ReportCalendarRepository repository,
                                 ReportPeriodService periodService,
                                 RowLevelSecurity rowLevel) {
        this.repository = repository;
        this.periodService = periodService;
        this.rowLevel = rowLevel;
    }

    /** Kết quả tạo/cập nhật lịch, kèm số kỳ để hiện thông báo. */
    public record CalendarResult(ReportCalendar calendar, int created, int skipped, int removed, int rescheduled) {
    }

    /**
     * Những gì một lần cập nhật sẽ làm (không ghi gì).
     *
     * @param addedKinds         loại kỳ thêm mới
     * @param createdPeriods     số kỳ sẽ sinh
     * @param removedKinds       loại kỳ bỏ đi
     * @param removedPeriods     số kỳ sẽ xoá
     * @param oldDeadlineDays    hạn nộp đang áp
     * @param newDeadlineDays    hạn nộp mới
     * @param rescheduledPeriods số kỳ chưa dùng được tính lại hạn nộp
     * @param keptDeadlineCodes  mã kỳ đã dùng giữ hạn cũ (chỉ khi đổi hạn nộp)
     * @param manualDeadlineCodes mã kỳ chưa dùng nhưng hạn nộp đã sửa tay, giữ nguyên
     *                           (chỉ khi đổi hạn nộp)
     */
    public record UpdatePlan(List<PeriodKind> addedKinds, int createdPeriods,
                             List<PeriodKind> removedKinds, int removedPeriods,
                             int oldDeadlineDays, int newDeadlineDays,
                             int rescheduledPeriods, List<String> keptDeadlineCodes,
                             List<String> manualDeadlineCodes) {

        public boolean deadlineChanged() {
            return oldDeadlineDays != newDeadlineDays;
        }

        public boolean isEmpty() {
            return addedKinds.isEmpty() && removedKinds.isEmpty() && !deadlineChanged();
        }
    }

    // ------------------------------------------------------------------
    // Đọc
    // ------------------------------------------------------------------

    public Page<ReportCalendar> list(ListParams params) {
        return repository.findAll(
                rowLevel.scope(ReportCalendar.class, Action.READ)
                        .and(ReportCalendarSpecifications.from(params)),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public ReportCalendar get(Long id) {
        return repository.findOne(rowLevel.byId(ReportCalendar.class, Action.READ, id))
                .orElseThrow(() -> new ResourceNotFoundException(RESOURCE, id));
    }

    public List<ReportCalendar> getMany(Collection<Long> ids) {
        return repository.findAll(rowLevel.byIds(ReportCalendar.class, Action.READ, ids));
    }

    /** Loại kỳ không bỏ được của một lịch, theo thứ tự hiển thị. */
    public List<PeriodKind> lockedKinds(Long calendarId) {
        return List.copyOf(periodService.usedKinds(calendarId));
    }

    public long periodCount(Long calendarId) {
        return periodService.countByCalendar(calendarId);
    }

    public java.util.Map<Long, Long> periodCounts(Collection<Long> calendarIds) {
        return periodService.countByCalendars(calendarIds);
    }

    /**
     * Khung "Xem trước kỳ sẽ tạo" (UC-06 bước 4): kỳ dự kiến của năm, đánh dấu kỳ đã có
     * nếu năm đó đã có lịch. Không ghi gì.
     */
    public List<PreviewRow> preview(int year, Collection<PeriodKind> kinds, int deadlineDays) {
        requireYearInRange(year);
        List<PeriodPlanner.PeriodPlan> plans = PeriodPlanner.plan(year, kinds, deadlineDays);
        Set<String> existing = repository.findByYear(year)
                .map(calendar -> periodService.existingSlots(calendar.getId()))
                .orElse(Set.of());
        return plans.stream()
                .map(plan -> new PreviewRow(plan, existing.contains(ReportPeriodService.slot(plan.kind(), plan.seq()))))
                .toList();
    }

    /** Một dòng xem trước. */
    public record PreviewRow(PeriodPlanner.PeriodPlan plan, boolean exists) {
    }

    // ------------------------------------------------------------------
    // Ghi
    // ------------------------------------------------------------------

    /**
     * Lưu lịch rồi sinh kỳ trong cùng transaction (UC-06 bước 5). Danh sách loại kỳ rỗng
     * thì lịch vẫn được lưu, chưa sinh kỳ (UC-06 3a).
     */
    @Transactional
    public CalendarResult create(ReportCalendarRequest request) {
        int year = request.year();
        requireYearInRange(year);
        repository.findByYear(year).ifPresent(existing -> {
            throw new ConflictException("Năm " + year + " đã có lịch báo cáo. Mỗi năm chỉ có một lịch.");
        });

        int deadlineDays = request.deadlineDays() == null
                ? PeriodPlanner.DEFAULT_DEADLINE_DAYS
                : request.deadlineDays();
        PeriodPlanner.requireValidDeadline(deadlineDays);

        Set<PeriodKind> kinds = request.kinds() == null
                ? EnumSet.copyOf(PeriodPlanner.DEFAULT_KINDS)
                : toSet(request.kinds());

        ReportCalendar calendar = repository.persist(new ReportCalendar(year, deadlineDays, kinds));
        repository.flush();
        rowLevel.checkWritable(calendar);

        if (kinds.isEmpty()) {
            return new CalendarResult(calendar, 0, 0, 0, 0);
        }
        ReportPeriodService.GenerationResult generated = periodService.generate(calendar, kinds, deadlineDays);
        return new CalendarResult(calendar, generated.created(), generated.skipped(), 0, 0);
    }

    /** Tóm tắt cập nhật cho hộp xác nhận (UC-21 bước 3). */
    public UpdatePlan planUpdate(Long id, Collection<PeriodKind> kinds, Integer deadlineDays) {
        ReportCalendar calendar = get(id);
        return plan(calendar, kinds, deadlineDays);
    }

    /**
     * Thêm/bỏ loại kỳ, đổi hạn nộp (UC-21): thêm loại kỳ luôn được; bỏ loại kỳ chỉ khi
     * không kỳ nào của loại đó đã dùng; đổi hạn nộp chỉ áp cho kỳ chưa dùng.
     */
    @Transactional
    public CalendarResult update(Long id, ReportCalendarPatchRequest request) {
        ReportCalendar calendar = repository.findOne(rowLevel.byId(ReportCalendar.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException(RESOURCE, id));

        // BR-06.3: năm bất biến. Form gửi lại nguyên bản ghi nên năm trùng là bình thường.
        if (request.year() != null && !request.year().equals(calendar.getYear())) {
            throw new ConflictException("Lịch năm đã tạo không thể đổi năm.");
        }

        UpdatePlan plan = plan(calendar, request.kinds(), request.deadlineDays());
        if (plan.isEmpty()) {
            return new CalendarResult(calendar, 0, 0, 0, 0);
        }

        Set<PeriodKind> removed = toSet(plan.removedKinds());
        int removedCount = periodService.removeKinds(calendar.getId(), removed);

        int rescheduled = plan.deadlineChanged()
                ? periodService.reschedule(calendar.getId(), plan.newDeadlineDays(), removed)
                : 0;

        int created = 0;
        int skipped = 0;
        if (!plan.addedKinds().isEmpty()) {
            ReportPeriodService.GenerationResult generated =
                    periodService.generate(calendar, plan.addedKinds(), plan.newDeadlineDays());
            created = generated.created();
            skipped = generated.skipped();
        }

        if (request.kinds() != null) {
            calendar.setKinds(request.kinds());
        }
        calendar.setDeadlineDays(plan.newDeadlineDays());
        rowLevel.checkWritable(calendar);
        ReportCalendar saved = repository.persist(calendar);
        return new CalendarResult(saved, created, skipped, removedCount, rescheduled);
    }

    /**
     * Xoá lịch cùng các kỳ (UC-08). Chặn khi có bất kỳ kỳ nào đã dùng (đã gán đơn vị
     * trở đi); khoá ngoại từ bảng thiết lập là lưới chặn thứ hai.
     */
    @Transactional
    public ReportCalendar delete(Long id) {
        ReportCalendar calendar = repository.findOne(rowLevel.byId(ReportCalendar.class, Action.DELETE, id))
                .orElseThrow(() -> new ResourceNotFoundException(RESOURCE, id));
        boolean anyUsed = periodService.listByCalendar(calendar.getId()).stream()
                .anyMatch(ReportPeriodService::isUsed);
        if (anyUsed) {
            throw new ConflictException("Không thể xoá lịch năm vì đã có kỳ được gán cho đơn vị.");
        }
        periodService.deleteAllOfCalendar(calendar.getId());
        repository.remove(calendar);
        repository.flush();
        return calendar;
    }

    // ------------------------------------------------------------------

    private UpdatePlan plan(ReportCalendar calendar, Collection<PeriodKind> requestedKinds, Integer requestedDeadline) {
        return planFor(calendar, periodService.listByCalendar(calendar.getId()), requestedKinds, requestedDeadline);
    }

    /**
     * Kế hoạch cập nhật tính thuần từ lịch và các kỳ hiện có — không chạm database, để
     * kiểm thử được mà không cần Spring.
     *
     * @param requestedKinds    loại kỳ muốn có; {@code null} = giữ như hiện tại
     * @param requestedDeadline số ngày hạn nộp mới; {@code null} = giữ như hiện tại
     * @throws IllegalArgumentException hạn nộp ngoài 1–365 ngày hoặc không chọn loại kỳ nào
     * @throws ConflictException         định bỏ loại kỳ đã có kỳ được dùng
     */
    static UpdatePlan planFor(ReportCalendar calendar, List<ReportPeriod> periods,
                              Collection<PeriodKind> requestedKinds, Integer requestedDeadline) {
        int newDeadline = requestedDeadline == null ? calendar.getDeadlineDays() : requestedDeadline;
        PeriodPlanner.requireValidDeadline(newDeadline);

        Set<PeriodKind> current = periods.stream()
                .map(ReportPeriod::getKind)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(PeriodKind.class)));

        Set<PeriodKind> requested;
        if (requestedKinds == null) {
            requested = current;
        } else {
            requested = toSet(requestedKinds);
            if (requested.isEmpty()) {
                throw new IllegalArgumentException("Cần chọn ít nhất một loại kỳ.");
            }
        }

        List<PeriodKind> added = requested.stream().filter(kind -> !current.contains(kind)).toList();
        List<PeriodKind> removed = current.stream().filter(kind -> !requested.contains(kind)).toList();

        Set<PeriodKind> locked = periods.stream()
                .filter(ReportPeriodService::isUsed)
                .map(ReportPeriod::getKind)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(PeriodKind.class)));
        List<PeriodKind> blocked = removed.stream().filter(locked::contains).toList();
        if (!blocked.isEmpty()) {
            throw new ConflictException("Không bỏ được loại kỳ đã gán đơn vị: "
                    + blocked.stream().map(PeriodPlanner::label).collect(Collectors.joining(", ")) + ".");
        }

        int created = added.isEmpty() ? 0 : PeriodPlanner.plan(calendar.getYear(), added, newDeadline).size();
        int removedCount = (int) periods.stream().filter(period -> removed.contains(period.getKind())).count();

        boolean deadlineChanged = calendar.getDeadlineDays() != newDeadline;
        List<ReportPeriod> remaining = periods.stream()
                .filter(period -> !removed.contains(period.getKind()))
                .sorted(Comparator.comparing(ReportPeriod::getKind).thenComparingInt(ReportPeriod::getSeq))
                .toList();
        int rescheduled = deadlineChanged
                ? (int) remaining.stream().filter(ReportPeriodService::followsCalendarDeadline).count()
                : 0;
        List<String> kept = deadlineChanged
                ? remaining.stream().filter(ReportPeriodService::isUsed).map(ReportPeriod::getCode).toList()
                : List.of();
        List<String> manual = deadlineChanged
                ? remaining.stream()
                        .filter(period -> !ReportPeriodService.isUsed(period) && period.isDeadlineManual())
                        .map(ReportPeriod::getCode)
                        .toList()
                : List.of();

        return new UpdatePlan(added, created, removed, removedCount,
                calendar.getDeadlineDays(), newDeadline, rescheduled, kept, manual);
    }

    private static void requireYearInRange(int year) {
        int now = Year.now(ZoneId.of("Asia/Ho_Chi_Minh")).getValue();
        if (year < now - YEARS_BACK || year > now + YEARS_AHEAD) {
            throw new IllegalArgumentException(
                    "Năm phải từ " + (now - YEARS_BACK) + " đến " + (now + YEARS_AHEAD) + ".");
        }
    }

    private static Set<PeriodKind> toSet(Collection<PeriodKind> kinds) {
        EnumSet<PeriodKind> set = EnumSet.noneOf(PeriodKind.class);
        if (kinds != null) {
            kinds.stream().filter(Objects::nonNull).forEach(set::add);
        }
        return set;
    }
}
