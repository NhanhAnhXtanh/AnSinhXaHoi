package com.dth.frw.module.asxh.attachment.service;

import com.dth.frw.domain.asxh.attachment.AttachmentKind;
import com.dth.frw.domain.asxh.attachment.InputReportAttachment;
import com.dth.frw.domain.asxh.attachment.TreasuryConfirmation;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.module.asxh.attachment.repo.InputReportAttachmentRepository;
import com.dth.frw.module.asxh.attachment.repo.TreasuryConfirmationRepository;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.CurrentUser;
import java.io.InputStream;
import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Giấy tờ đính kèm phiếu — xác nhận của Kho bạc mà đơn vị gửi kèm khi nộp (UC-38). Port
 * {@code ReportAttachmentService} của bản Jmix.
 *
 * <p>Service này KHÔNG tự nạp phiếu: controller lấy phiếu qua {@code InputReportService.get}
 * (đã áp phạm vi dữ liệu của người gọi) rồi đưa vào. Nhờ vậy slice phiếu gọi được ngược lại slice
 * này lúc nộp mà không thành vòng phụ thuộc.
 *
 * <p>Giới hạn đặt ở máy chủ: tối đa {@value #MAX_FILES_PER_REPORT} file mỗi phiếu, mỗi file theo
 * {@link AttachmentFiles}; chỉ tải lên / gỡ / tích khi phiếu còn sửa được và đợt còn mở.
 */
@Service
@Transactional(readOnly = true)
public class InputReportAttachmentService {

    /** Đa số đơn vị chỉ có một tờ xác nhận; 10 file là trần cho trường hợp nhiều tờ. */
    public static final int MAX_FILES_PER_REPORT = 10;

    /** Trạng thái ô tích + số file của một phiếu. */
    public record TreasuryStatus(Long reportId, boolean confirmed, Instant confirmedAt, String confirmedBy,
                                 long fileCount) {
        public boolean ready() {
            return confirmed && fileCount > 0;
        }
    }

    private final InputReportAttachmentRepository repository;
    private final TreasuryConfirmationRepository confirmationRepository;
    private final AttachmentStorage storage;
    private final boolean treasuryRequired;

    public InputReportAttachmentService(InputReportAttachmentRepository repository,
                                        TreasuryConfirmationRepository confirmationRepository,
                                        AttachmentStorage storage,
                                        @Value("${asxh.attachments.treasury-required:true}") boolean treasuryRequired) {
        this.repository = repository;
        this.confirmationRepository = confirmationRepository;
        this.storage = storage;
        this.treasuryRequired = treasuryRequired;
    }

    /**
     * Có bắt buộc xác nhận Kho bạc khi nộp không (BR-38.1 — mặc định CÓ). Tắt bằng
     * {@code asxh.attachments.treasury-required=false} cho môi trường thử khi màn nộp chưa có ô tải
     * file.
     */
    public boolean isTreasuryRequired() {
        return treasuryRequired;
    }

    /** File còn hiệu lực của phiếu, cũ trước. */
    public List<InputReportAttachment> list(InputReport report) {
        return repository.findActiveByReportId(report.getId());
    }

    public InputReportAttachment get(InputReport report, Long attachmentId) {
        return repository.findActive(report.getId(), attachmentId)
                .orElseThrow(() -> new ResourceNotFoundException("InputReportAttachment", attachmentId));
    }

    /** Mở luồng đọc nội dung file; người gọi đóng luồng. */
    public InputStream openContent(InputReportAttachment attachment) {
        return storage.open(attachment.getStoragePath());
    }

    /**
     * Nhận một file xác nhận Kho bạc cho phiếu.
     *
     * @throws IllegalArgumentException tên / đuôi / dung lượng / nội dung không hợp lệ, quá số file (→ 400)
     * @throws ConflictException        phiếu không còn sửa được hoặc đợt đã đóng (→ 409)
     */
    @Transactional
    public InputReportAttachment upload(InputReport report, String originalFileName, byte[] content) {
        assertEditable(report);
        String fileName = AttachmentFiles.validate(originalFileName, content);
        if (repository.countActiveByReportId(report.getId()) >= MAX_FILES_PER_REPORT) {
            throw new IllegalArgumentException("Mỗi phiếu chỉ đính kèm tối đa " + MAX_FILES_PER_REPORT + " file.");
        }
        String path = storage.save(content, AttachmentFiles.extensionOf(fileName));
        try {
            InputReportAttachment attachment = new InputReportAttachment(report,
                    AttachmentKind.TREASURY_CONFIRMATION, fileName, AttachmentFiles.contentTypeOf(fileName),
                    content.length, path);
            attachment.setCreatedBy(CurrentUser.username().orElse(null));
            InputReportAttachment saved = repository.persist(attachment);
            repository.flush();
            return saved;
        } catch (RuntimeException e) {
            // Bản ghi không lưu được thì đừng để file mồ côi trên đĩa.
            storage.deleteQuietly(path);
            throw e;
        }
    }

    /**
     * Gỡ một file — xoá MỀM, không đụng file vật lý (BR-38.3). Chỉ khi phiếu còn sửa được: nộp rồi
     * thì đây là chứng từ của hồ sơ Sở đang xử lý.
     */
    @Transactional
    public InputReportAttachment delete(InputReport report, Long attachmentId) {
        assertEditable(report);
        InputReportAttachment attachment = get(report, attachmentId);
        attachment.setDeletedAt(Instant.now());
        attachment.setDeletedBy(CurrentUser.username().orElse(null));
        return repository.persist(attachment);
    }

    public TreasuryStatus treasuryStatus(InputReport report) {
        long files = repository.countActiveByReportId(report.getId());
        return confirmationRepository.findByReportId(report.getId())
                .map(c -> new TreasuryStatus(report.getId(), c.isConfirmed(), c.getUpdatedAt(), c.getUpdatedBy(), files))
                .orElseGet(() -> new TreasuryStatus(report.getId(), false, null, null, files));
    }

    /** Đơn vị tích / bỏ tích "Đã có phiếu xác nhận của Kho bạc". */
    @Transactional
    public TreasuryStatus setTreasuryConfirmed(InputReport report, boolean confirmed) {
        assertEditable(report);
        TreasuryConfirmation confirmation = confirmationRepository.findByReportId(report.getId())
                .orElseGet(() -> new TreasuryConfirmation(report));
        confirmation.setConfirmed(confirmed, CurrentUser.username().orElse(null));
        confirmationRepository.persist(confirmation);
        return treasuryStatus(report);
    }

    /**
     * Chặn nộp khi chưa đủ xác nhận Kho bạc (BR-38.1): đòi CẢ file đính kèm LẪN ô tích. File mà
     * không tích thì không rõ đơn vị đã đối chiếu chưa; tích mà không file thì Sở không có gì để kiểm.
     *
     * @throws ConflictException thiếu một trong hai vế (→ 409)
     */
    public void assertTreasuryConfirmationReady(InputReport report) {
        if (!treasuryRequired) {
            return;
        }
        TreasuryStatus status = treasuryStatus(report);
        if (status.ready()) {
            return;
        }
        boolean hasFile = status.fileCount() > 0;
        String message = !hasFile && !status.confirmed()
                ? "Chưa nộp được phiếu: cần tải lên xác nhận của Kho bạc và tích xác nhận."
                : (!hasFile
                        ? "Chưa nộp được phiếu: chưa tải lên xác nhận của Kho bạc."
                        : "Chưa nộp được phiếu: chưa tích xác nhận đã có phiếu xác nhận của Kho bạc.");
        throw new ConflictException(message);
    }

    private static void assertEditable(InputReport report) {
        if (report.getStatus() == null || !report.getStatus().isEditable()) {
            throw new ConflictException("Phiếu không còn cho phép sửa nên không đổi được giấy tờ đính kèm.");
        }
        if (report.getPeriod() == null || report.getPeriod().getStatus() != PeriodStatus.OPEN) {
            throw new ConflictException("Đợt báo cáo không còn mở nên không đổi được giấy tờ đính kèm.");
        }
    }
}
