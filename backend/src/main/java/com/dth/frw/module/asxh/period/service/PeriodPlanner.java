package com.dth.frw.module.asxh.period.service;

import com.dth.frw.domain.asxh.period.PeriodKind;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Suy ra các kỳ chuẩn của một năm — thuần hàm, không chạm database.
 *
 * <p>Port gộp từ {@code ReportingPeriodCalendar.resolve} (khoảng ngày theo
 * {@code (year, kind, seq)}) và {@code AnnualReportingPeriodService.buildPlan /
 * periodCode} của bản Jmix (luồng lịch năm dương lịch; luồng năm học bỏ vì không
 * màn nào gọi — UC-20 1a).
 *
 * <p>Kỳ luôn phủ TRỌN các tháng của nó: từ ngày 1 tháng đầu đến ngày cuối tháng
 * cuối, để kỳ con ghép khít khi tổng hợp (không chồng, không hở ngày). Cửa sổ nhận
 * nhập liệu mở từ ngày đầu kỳ, hạn nộp = ngày cuối kỳ + số ngày hạn nộp.
 */
public final class PeriodPlanner {

    public static final int MIN_DEADLINE_DAYS = 1;
    public static final int MAX_DEADLINE_DAYS = 365;
    public static final int DEFAULT_DEADLINE_DAYS = 5;

    /** Mặc định khi tạo lịch mà không chọn: Tháng + Quý + 6 tháng (UC-06 bước 3). */
    public static final Set<PeriodKind> DEFAULT_KINDS =
            EnumSet.of(PeriodKind.THANG, PeriodKind.QUY, PeriodKind.SAU_THANG);

    private static final String[] ROMAN = {"I", "II", "III", "IV"};

    private PeriodPlanner() {
    }

    /** Một kỳ dự kiến. */
    public record PeriodPlan(int year, PeriodKind kind, int seq, String code, String name,
                             LocalDate fromDate, LocalDate toDate,
                             LocalDate openFrom, LocalDate deadline) {
    }

    /** Kiểm hạn nộp 1–365 ngày (UC-06 3b, UC-21 2b). */
    public static void requireValidDeadline(int deadlineDays) {
        if (deadlineDays < MIN_DEADLINE_DAYS || deadlineDays > MAX_DEADLINE_DAYS) {
            throw new IllegalArgumentException("Hạn nộp phải từ 1 đến 365 ngày.");
        }
    }

    /** Toàn bộ kỳ của các loại đã chọn, theo thứ tự Tháng → Quý → 6 tháng → Năm, rồi theo số thứ tự. */
    public static List<PeriodPlan> plan(int year, Collection<PeriodKind> kinds, int deadlineDays) {
        requireValidDeadline(deadlineDays);
        EnumSet<PeriodKind> ordered = EnumSet.noneOf(PeriodKind.class);
        if (kinds != null) {
            kinds.stream().filter(Objects::nonNull).forEach(ordered::add);
        }
        List<PeriodPlan> plans = new ArrayList<>();
        for (PeriodKind kind : ordered) {
            for (int seq = 1; seq <= kind.periodsPerYear(); seq++) {
                plans.add(plan(year, kind, seq, deadlineDays));
            }
        }
        return List.copyOf(plans);
    }

    public static PeriodPlan plan(int year, PeriodKind kind, int seq, int deadlineDays) {
        LocalDate from = fromDate(year, kind, seq);
        LocalDate to = toDate(year, kind, seq);
        return new PeriodPlan(year, kind, seq, code(kind, seq), name(year, kind, seq),
                from, to, from, to.plusDays(deadlineDays));
    }

    /** Hạn nộp tính lại theo số ngày mới — dùng khi đổi hạn nộp của lịch (UC-21). */
    public static LocalDate deadlineFor(LocalDate toDate, int deadlineDays) {
        return toDate.plusDays(deadlineDays);
    }

    private static LocalDate fromDate(int year, PeriodKind kind, int seq) {
        return YearMonth.of(year, firstMonth(kind, seq)).atDay(1);
    }

    private static LocalDate toDate(int year, PeriodKind kind, int seq) {
        return YearMonth.of(year, lastMonth(kind, seq)).atEndOfMonth();
    }

    private static int firstMonth(PeriodKind kind, int seq) {
        requireSeq(kind, seq);
        return switch (kind) {
            case THANG -> seq;
            case QUY -> seq * 3 - 2;
            case SAU_THANG -> seq == 1 ? 1 : 7;
            case NAM -> 1;
        };
    }

    private static int lastMonth(PeriodKind kind, int seq) {
        requireSeq(kind, seq);
        return switch (kind) {
            case THANG -> seq;
            case QUY -> seq * 3;
            case SAU_THANG -> seq == 1 ? 6 : 12;
            case NAM -> 12;
        };
    }

    /** Mã kỳ (BR-20.3): T1..T12, Q1..Q4, 6TĐN/6TCN, NAM. */
    public static String code(PeriodKind kind, int seq) {
        requireSeq(kind, seq);
        return switch (kind) {
            case THANG -> "T" + seq;
            case QUY -> "Q" + seq;
            case SAU_THANG -> seq == 1 ? "6TĐN" : "6TCN";
            case NAM -> "NAM";
        };
    }

    /** Tên hiển thị: "Tháng 1/2026", "Quý IV/2026", "6 tháng đầu năm 2026", "Năm 2026". */
    public static String name(int year, PeriodKind kind, int seq) {
        requireSeq(kind, seq);
        return switch (kind) {
            case THANG -> "Tháng " + seq + "/" + year;
            case QUY -> "Quý " + ROMAN[seq - 1] + "/" + year;
            case SAU_THANG -> (seq == 1 ? "6 tháng đầu năm " : "6 tháng cuối năm ") + year;
            case NAM -> "Năm " + year;
        };
    }

    /** Nhãn loại kỳ cho thông báo. */
    public static String label(PeriodKind kind) {
        return switch (kind) {
            case THANG -> "Tháng";
            case QUY -> "Quý";
            case SAU_THANG -> "6 tháng";
            case NAM -> "Năm";
        };
    }

    private static void requireSeq(PeriodKind kind, int seq) {
        if (seq < 1 || seq > kind.periodsPerYear()) {
            throw new IllegalArgumentException(
                    "Số thứ tự kỳ " + seq + " không hợp lệ cho loại kỳ " + label(kind) + ".");
        }
    }
}
