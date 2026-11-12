package com.dth.frw.module.asxh.notification.service;

import com.dth.frw.domain.asxh.annual.AnnualReport;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.Publication;
import com.dth.frw.domain.asxh.report.PublicationKind;
import com.dth.frw.domain.system.notification.NotificationLevel;
import com.dth.frw.module.asxh.setup.service.PublicationItemService;
import com.dth.frw.module.security.user.repo.UserRepository;
import com.dth.frw.module.system.notification.service.NotificationService;
import com.dth.frw.shared.security.CurrentUser;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Báo cho đúng người khi luồng báo cáo ASXH chuyển bước: nộp, trả lại, duyệt, mở đợt, sắp đến hạn,
 * và các bước của báo cáo năm giữa Sở và UBND.
 *
 * <p>Gọi SAU khi bước chính đã lưu xong (từ lớp API, sau khi service đã chốt giao dịch), nên thông
 * báo không bao giờ nói về một việc đã bị huỷ. Ngược lại, thông báo hỏng không được làm hỏng bước
 * chính đã xong: mỗi người nhận được gửi riêng, lỗi chỉ ghi log.
 *
 * <p>Người nhận chọn theo đơn vị của tài khoản (phía đơn vị) hoặc theo vai trò (phía Sở, UBND); người
 * vừa làm việc đó không tự nhận thông báo của chính mình. Chữ trong thông báo là chữ cho cán bộ đọc:
 * tên đơn vị, tên kỳ, ngày — không có mã máy.
 */
@Service
public class AsxhNotifier {

    private static final Logger log = LoggerFactory.getLogger(AsxhNotifier.class);

    /** Cán bộ Sở duyệt phiếu. */
    static final String ROLE_REVIEWER = "REPORT_APPROVER";
    /** Cán bộ Sở nộp báo cáo năm lên UBND. */
    static final String ROLE_ANNUAL_SUBMITTER = "DEPT_REPORT_SUBMITTER";
    /** Lãnh đạo UBND duyệt báo cáo năm. */
    static final String ROLE_UBND = "UBND_APPROVER";

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final int REASON_MAX = 500;

    private final NotificationService notifications;
    private final UserRepository users;
    private final PublicationItemService publicationItems;

    public AsxhNotifier(NotificationService notifications,
                        UserRepository users,
                        PublicationItemService publicationItems) {
        this.notifications = notifications;
        this.users = users;
        this.publicationItems = publicationItems;
    }

    // ------------------------------------------------------------- phiếu nhập

    /** Đơn vị nộp phiếu → cán bộ Sở duyệt phiếu. */
    public void reportSubmitted(InputReport report) {
        toRole(ROLE_REVIEWER, NotificationLevel.INFO,
                "Có phiếu mới chờ duyệt",
                "%s đã nộp phiếu %s.".formatted(report.getUnit().getName(), report.getPeriod().getName()),
                "/report-review/" + report.getId());
    }

    /** Sở duyệt → tài khoản của đơn vị. */
    public void reportApproved(InputReport report) {
        toUnit(report.getUnit().getId(), NotificationLevel.SUCCESS,
                "Phiếu đã được duyệt",
                "Phiếu %s của %s đã được Sở duyệt.".formatted(report.getPeriod().getName(), report.getUnit().getName()),
                "/input-reports/" + report.getId());
    }

    /** Sở trả lại → tài khoản của đơn vị; {@code returned} là PHIÊN BẢN MỚI do trả lại sinh ra. */
    public void reportReturned(InputReport returned) {
        toUnit(returned.getUnit().getId(), NotificationLevel.WARNING,
                "Phiếu bị trả lại",
                "Sở trả lại phiếu %s của %s.%s Bạn sửa rồi nộp lại."
                        .formatted(returned.getPeriod().getName(), returned.getUnit().getName(),
                                reasonSentence(returned.getReturnReason())),
                "/input-reports/" + returned.getId());
    }

    /** Phiếu của đơn vị sắp đến hạn nộp (nhắc hằng ngày). */
    public void deadlineSoon(InputReport report, long daysLeft) {
        ReportPeriod period = report.getPeriod();
        String when = daysLeft <= 0 ? "Hôm nay là hạn nộp"
                : daysLeft == 1 ? "Ngày mai là hạn nộp"
                : "Còn %d ngày đến hạn nộp (%s)".formatted(daysLeft, period.getDeadline().format(DATE));
        toUnit(report.getUnit().getId(), NotificationLevel.WARNING,
                "Phiếu sắp đến hạn nộp",
                "Phiếu %s của %s chưa nộp. %s.".formatted(period.getName(), report.getUnit().getName(), when),
                "/input-reports/" + report.getId());
    }

    // --------------------------------------------------------------- mở đợt

    /** Sở mở đợt (lần đầu hoặc bổ sung) → tài khoản của các đơn vị có biểu trong đợt. */
    public void publicationOpened(Publication publication) {
        ReportPeriod period = publication.getPeriod();
        boolean supplement = publication.getKind() == PublicationKind.BO_SUNG;
        String title = supplement ? "Có biểu bổ sung cần nhập" : "Đã mở kỳ báo cáo";
        LocalDate deadline = period.getDeadline();
        String deadlineText = deadline == null ? "" : " Hạn nộp: %s.".formatted(deadline.format(DATE));
        String body = supplement
                ? "Sở vừa bổ sung biểu cho %s.%s".formatted(period.getName(), deadlineText)
                : "%s đã mở, bạn có phiếu cần nhập.%s".formatted(period.getName(), deadlineText);
        Set<Long> unitIds;
        try {
            unitIds = publicationItems.unitIds(publication.getId());
        } catch (RuntimeException e) {
            log.warn("Không xác định được đơn vị của đợt {} để báo mở đợt: {}", publication.getId(), e.getMessage(), e);
            return;
        }
        for (Long unitId : unitIds) {
            toUnit(unitId, NotificationLevel.INFO, title, body, "/input-reports");
        }
    }

    // ------------------------------------------------------------ báo cáo năm

    /** Sở nộp báo cáo năm → lãnh đạo UBND. */
    public void annualSubmitted(AnnualReport report) {
        toRole(ROLE_UBND, NotificationLevel.INFO,
                "Có báo cáo năm chờ duyệt",
                "Sở đã nộp báo cáo năm %d, đang chờ UBND duyệt.".formatted(report.getReportYear()),
                "/annual-review/" + report.getId());
    }

    /** UBND duyệt → cán bộ Sở nộp báo cáo năm. */
    public void annualApproved(AnnualReport report) {
        toRole(ROLE_ANNUAL_SUBMITTER, NotificationLevel.SUCCESS,
                "UBND đã duyệt báo cáo năm",
                "Báo cáo năm %d đã được UBND duyệt.".formatted(report.getReportYear()),
                "/annual-review/" + report.getId());
    }

    /** UBND trả lại → cán bộ Sở nộp báo cáo năm. */
    public void annualReturned(AnnualReport report, String reason) {
        toRole(ROLE_ANNUAL_SUBMITTER, NotificationLevel.WARNING,
                "UBND trả lại báo cáo năm",
                "Báo cáo năm %d bị UBND trả lại.%s Bạn chỉnh rồi nộp lại."
                        .formatted(report.getReportYear(), reasonSentence(reason)),
                "/annual-review/" + report.getId());
    }

    /** UBND mở lại báo cáo năm đã duyệt → cán bộ Sở nộp báo cáo năm. */
    public void annualReopened(AnnualReport report, String reason) {
        toRole(ROLE_ANNUAL_SUBMITTER, NotificationLevel.INFO,
                "UBND đã mở lại báo cáo năm",
                "Báo cáo năm %d được UBND mở lại.%s".formatted(report.getReportYear(), reasonSentence(reason)),
                "/annual-review/" + report.getId());
    }

    // ----------------------------------------------------------------- nội bộ

    private void toUnit(Long unitId, NotificationLevel level, String title, String body, String link) {
        if (unitId == null) {
            return;
        }
        try {
            send(users.findActiveIdsByReportUnitId(unitId), level, title, body, link);
        } catch (RuntimeException e) {
            log.warn("Không tìm được tài khoản của đơn vị {} để gửi thông báo \"{}\": {}", unitId, title, e.getMessage(), e);
        }
    }

    private void toRole(String roleCode, NotificationLevel level, String title, String body, String link) {
        try {
            send(users.findActiveIdsByRoleCode(roleCode), level, title, body, link);
        } catch (RuntimeException e) {
            log.warn("Không tìm được tài khoản vai trò {} để gửi thông báo \"{}\": {}", roleCode, title, e.getMessage(), e);
        }
    }

    /** Gửi cho từng người, mỗi người một giao dịch riêng; bỏ qua chính người đang thao tác. */
    private void send(Collection<Long> recipientIds, NotificationLevel level, String title, String body, String link) {
        Long actor = CurrentUser.id().orElse(null);
        Set<Long> targets = new LinkedHashSet<>(recipientIds);
        targets.remove(actor);
        for (Long recipientId : targets) {
            try {
                notifications.notify(recipientId, level, title, body, link);
            } catch (RuntimeException e) {
                log.warn("Không gửi được thông báo \"{}\" cho tài khoản {}: {}", title, recipientId, e.getMessage(), e);
            }
        }
    }

    /** " Lý do: …" hoặc rỗng khi không có lý do; cắt bớt lý do quá dài. */
    private static String reasonSentence(String reason) {
        if (reason == null || reason.isBlank()) {
            return "";
        }
        String text = reason.trim();
        if (text.length() > REASON_MAX) {
            text = text.substring(0, REASON_MAX - 1) + "…";
        }
        return " Lý do: " + text + (text.endsWith(".") || text.endsWith("…") ? "" : ".");
    }
}
