package com.dth.frw.module.asxh.summary.service;

import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.summary.repo.SummaryQueries;
import com.dth.frw.module.asxh.template.service.TemplateVersionService;
import java.util.Collection;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Chọn phiên bản mẫu của một biểu cho TỔNG HỢP THEO KỲ (màn Tổng hợp và số liệu Sở lưu khi chốt kỳ).
 *
 * <p>Số trong sổ cái mang bố cục và mã chỉ tiêu của phiên bản GHIM trong phiếu — mở đợt ghim theo
 * ngày mở đợt (BR-24.1), không theo ngày đầu kỳ. Khung tổng hợp phải cùng bản đó, không thì số không
 * khớp ô (bảng trống). Thứ tự ưu tiên:
 * <ol>
 *   <li>bản ghim trong phiếu ĐÃ CÓ SỐ của kỳ (đã duyệt, hoặc khoá sau khi duyệt), đợt mở mới nhất;</li>
 *   <li>chưa phiếu nào được duyệt: bản ghim trong phiếu còn hiện hành bất kỳ (khớp bảng đơn vị đang
 *       nhập), đợt mở mới nhất;</li>
 *   <li>kỳ chưa có phiếu (chưa mở đợt / đã thu hồi): theo ngày đầu kỳ, trước mọi bản thì mượn bản đã
 *       ban hành sớm nhất (như trước đây).</li>
 * </ol>
 * Phiếu đã huỷ, phiếu bị thay thế khi trả lại và phiếu thuộc đợt đã thu hồi không tính.
 */
@Service
@Transactional(readOnly = true)
public class PeriodVersionResolver {

    /**
     * @param version phiên bản chọn được
     * @param pinned  {@code true} = lấy từ phiếu của kỳ (không phải mượn theo ngày)
     */
    public record Resolved(TemplateVersion version, boolean pinned) {

        /** Bản chọn theo ngày nhưng có hiệu lực SAU ngày đầu kỳ (mượn bản sớm nhất). */
        public boolean borrowedEarliest(ReportPeriod period) {
            return !pinned && version.getEffectiveFrom() != null
                    && version.getEffectiveFrom().isAfter(period.getFromDate());
        }
    }

    private final SummaryQueries queries;
    private final TemplateVersionService versionService;

    public PeriodVersionResolver(SummaryQueries queries, TemplateVersionService versionService) {
        this.queries = queries;
        this.versionService = versionService;
    }

    /**
     * @param periodIds các kỳ lá có số của kỳ đang xem (kỳ tháng: chính nó; quý / năm: nó và các kỳ
     *                  nằm gọn bên trong — xem {@code SummaryAggregationService.resolveLeafPeriodIds})
     */
    public Optional<Resolved> resolve(ReportPeriod period, Collection<Long> periodIds, Long templateId) {
        Optional<Long> pinned = queries.pinnedVersionId(periodIds, templateId, true)
                .or(() -> queries.pinnedVersionId(periodIds, templateId, false));
        if (pinned.isPresent()) {
            return Optional.of(new Resolved(versionService.get(pinned.get()), true));
        }
        return versionService.resolveOrEarliest(templateId, period.getFromDate())
                .map(version -> new Resolved(version, false));
    }
}
