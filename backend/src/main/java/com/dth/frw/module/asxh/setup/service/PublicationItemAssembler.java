package com.dth.frw.module.asxh.setup.service;

import com.dth.frw.domain.asxh.ledger.LedgerWriteAudit;
import com.dth.frw.module.asxh.setup.api.dto.PublicationItemsResponse.Delivery;
import com.dth.frw.module.asxh.setup.repo.PublicationItemQueries.AuditRow;
import com.dth.frw.module.asxh.setup.repo.PublicationItemQueries.PublicationRow;
import com.dth.frw.module.asxh.setup.repo.PublicationItemQueries.ReportRow;
import com.dth.frw.module.asxh.setup.repo.PublicationItemQueries.SheetRow;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Gán từng biểu của kỳ về ĐỢT đã phát nó — phần thuần (không CSDL) của chi tiết đợt (UC-30).
 *
 * <h2>Vì sao phải suy ra</h2>
 * Tờ biểu ({@code InputReportSheet}) không lưu đợt; phiếu ({@code InputReport.publication}) thì
 * có, nhưng một phiếu có thể chứa biểu của nhiều đợt: đợt bổ sung thêm biểu vào phiếu đang nhập
 * (DRAFT / RETURNED) của đơn vị thay vì lập phiếu mới ({@code InputReportService.issue}).
 *
 * <h2>Quy tắc</h2>
 * Tờ biểu chỉ sinh ra ở hai chỗ (đọc từ code, 10/2026):
 * <ol>
 *   <li>{@code InputReportService.issue} — trong CÙNG giao dịch với việc ghi bản ghi đợt, và
 *       SAU khi đợt đã được ghi + flush, nên {@code sheet.createdAt >= publication.createdAt}
 *       (cả hai đóng dấu {@code Instant.now()} lúc {@code @PrePersist}).</li>
 *   <li>{@code InputReportService.returnReport} — sao chép mọi tờ biểu sang phiên bản phiếu kế
 *       tiếp, với {@code createdAt} MỚI (thời điểm trả lại).</li>
 * </ol>
 * Vì vậy, với mỗi cặp (chuỗi phiên bản phiếu, biểu): lấy tờ biểu GỐC — {@code createdAt} sớm
 * nhất trong chuỗi, tức tờ do {@code issue} sinh ra, không phải bản sao khi trả lại — rồi gán nó
 * cho đợt MỚI NHẤT của kỳ có {@code createdAt <= sheet.createdAt}. Bản sao khi trả lại không bao
 * giờ bị gán sang đợt mở sau lần trả lại.
 *
 * <p>Xét mọi đợt của kỳ, kể cả đợt đã thu hồi: thu hồi kỳ xoá hết phiếu của kỳ
 * ({@code deleteAllForPeriod}), nên tờ biểu còn lại luôn sinh sau đợt đã thu hồi cuối cùng; nếu
 * dữ liệu cũ có sót thì gán vào đúng đợt đã thu hồi vẫn trung thực hơn là dồn sang đợt khác.
 *
 * <p>Phiếu bị HUỶ (UC-47) vẫn là một chuỗi riêng: cặp (đơn vị, biểu) đó được phát lại ở đợt sau
 * thành chuỗi mới, và mỗi chuỗi có dòng riêng ở đúng đợt của nó.
 *
 * <h2>Khi nào đánh dấu "suy ra"</h2>
 * Dòng gán về đợt đã lập phiếu chứa biểu, kèm {@code derived = true}, khi thời điểm không nhất
 * quán với quy tắc trên: tờ biểu tạo trước mọi đợt của kỳ, hoặc trước cả đợt đã lập phiếu chứa
 * nó (dữ liệu chuyển từ hệ thống cũ, đồng hồ lệch).
 */
final class PublicationItemAssembler {

    private PublicationItemAssembler() {
    }

    /** Một dòng đã gán: biểu {@code templateId} của chuỗi phiếu bắt đầu ở {@code first}. */
    record Assigned(
            Long publicationId,
            Delivery delivery,
            boolean derived,
            Long templateId,
            ReportRow first,
            ReportRow latest,
            SheetRow original,
            SheetRow current,
            List<Long> chainReportIds) {
    }

    /** Ghi số liệu gần nhất của một dòng. */
    record LedgerSummary(AuditRow lastSuccess, AuditRow lastFailure) {
    }

    /**
     * Gán mọi tờ biểu của kỳ về đợt, trả các dòng thuộc {@code publicationId}.
     *
     * @param publications mọi đợt của kỳ
     * @param reports      mọi phiếu (mọi phiên bản) của kỳ
     * @param sheets       mọi tờ biểu của các phiếu đó
     */
    static List<Assigned> assign(Long publicationId,
                                 List<PublicationRow> publications,
                                 List<ReportRow> reports,
                                 List<SheetRow> sheets) {
        List<PublicationRow> ordered = new ArrayList<>(publications);
        ordered.sort(Comparator.comparing(PublicationRow::createdAt).thenComparing(PublicationRow::id));
        Map<Long, Integer> orderOf = new HashMap<>();
        for (int i = 0; i < ordered.size(); i++) {
            orderOf.put(ordered.get(i).id(), i);
        }

        Map<Long, ReportRow> reportsById = new HashMap<>();
        for (ReportRow report : reports) {
            reportsById.put(report.id(), report);
        }

        // Chuỗi phiên bản: gốc của mỗi phiếu theo previousRevisionId, rồi các phiếu theo gốc.
        Map<Long, Long> rootOf = new HashMap<>();
        Map<Long, List<ReportRow>> chains = new LinkedHashMap<>();
        for (ReportRow report : reports) {
            Long root = root(report, reportsById);
            rootOf.put(report.id(), root);
            chains.computeIfAbsent(root, k -> new ArrayList<>()).add(report);
        }

        // Tờ biểu theo (gốc chuỗi, biểu).
        Map<String, List<SheetRow>> byChainTemplate = new LinkedHashMap<>();
        for (SheetRow sheet : sheets) {
            Long root = rootOf.get(sheet.reportId());
            if (root == null) {
                continue;
            }
            byChainTemplate.computeIfAbsent(root + ":" + sheet.templateId(), k -> new ArrayList<>()).add(sheet);
        }

        List<Assigned> result = new ArrayList<>();
        for (List<SheetRow> group : byChainTemplate.values()) {
            SheetRow original = group.stream()
                    .min(Comparator.comparing(SheetRow::createdAt).thenComparing(SheetRow::id))
                    .orElseThrow();
            Long root = rootOf.get(original.reportId());
            ReportRow first = reportsById.get(root);
            List<ReportRow> chain = chains.get(root);
            ReportRow latest = chain.stream()
                    .max(Comparator.comparingInt(ReportRow::revisionNo).thenComparing(ReportRow::id))
                    .orElseThrow();
            // Tờ biểu ở phiên bản mới nhất có biểu này (trả lại chép mọi tờ nên thường là `latest`).
            SheetRow current = group.stream()
                    .max(Comparator.comparingInt((SheetRow s) -> reportsById.get(s.reportId()).revisionNo())
                            .thenComparing(SheetRow::id))
                    .orElseThrow();

            Long reportPublication = first.publicationId();
            PublicationRow found = latestAtOrBefore(ordered, original.createdAt());
            Long assigned;
            boolean derived;
            Integer reportOrder = orderOf.get(reportPublication);
            if (found == null || (reportOrder != null && orderOf.get(found.id()) < reportOrder)) {
                // Tờ biểu "có trước" đợt đã lập phiếu chứa nó: không tin được thời điểm.
                assigned = reportPublication;
                derived = true;
            } else {
                assigned = found.id();
                derived = false;
            }
            if (!Objects.equals(assigned, publicationId)) {
                continue;
            }
            List<Long> chainIds = chain.stream()
                    .sorted(Comparator.comparingInt(ReportRow::revisionNo))
                    .map(ReportRow::id)
                    .toList();
            Delivery delivery = Objects.equals(assigned, reportPublication)
                    ? Delivery.NEW_REPORT
                    : Delivery.ADDED_TO_OPEN_REPORT;
            result.add(new Assigned(assigned, delivery, derived, original.templateId(), first, latest,
                    original, current, chainIds));
        }
        return result;
    }

    /** Lần ghi thành công / thất bại gần nhất của biểu trong các phiên bản của chuỗi. */
    static LedgerSummary ledger(Assigned item, List<AuditRow> auditsOldestFirst) {
        Set<Long> chain = new HashSet<>(item.chainReportIds());
        AuditRow success = null;
        AuditRow failure = null;
        for (AuditRow audit : auditsOldestFirst) {
            if (!chain.contains(audit.reportId()) || !Objects.equals(audit.templateId(), item.templateId())) {
                continue;
            }
            if (audit.result() == LedgerWriteAudit.Result.SUCCESS) {
                success = audit;
            } else {
                failure = audit;
            }
        }
        return new LedgerSummary(success, failure);
    }

    private static Long root(ReportRow report, Map<Long, ReportRow> reportsById) {
        ReportRow current = report;
        Set<Long> seen = new HashSet<>();
        while (current.previousRevisionId() != null && seen.add(current.id())) {
            ReportRow previous = reportsById.get(current.previousRevisionId());
            if (previous == null) {
                break;
            }
            current = previous;
        }
        return current.id();
    }

    private static PublicationRow latestAtOrBefore(List<PublicationRow> ordered, Instant at) {
        PublicationRow found = null;
        for (PublicationRow publication : ordered) {
            if (publication.createdAt().isAfter(at)) {
                break;
            }
            found = publication;
        }
        return found;
    }
}
