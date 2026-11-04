--liquibase formatted sql

-- Kỳ chưa mở đợt mà chỉ còn ô thiết lập của biểu đang khoá (để sửa) thì coi như chưa chọn biểu
-- nào: Đã thiết lập (READY) → Chưa thiết lập (DRAFT). Từ nay PeriodAssignmentService.syncSetupStatus
-- giữ luật này khi lưu ma trận, sao chép thiết lập, thu hồi kỳ và khi khoá / mở khoá biểu; changeset
-- này sửa các kỳ đã lệch sẵn sau changeset 175.

--changeset dth:176-period-setup-ignore-locked-forms
--comment Kỳ Đã thiết lập chỉ còn ô của biểu đang khoá: về Chưa thiết lập
UPDATE asxh_report_periods p
   SET status = 'DRAFT'
 WHERE p.status = 'READY'
   AND NOT EXISTS (SELECT 1
                     FROM asxh_period_assignments a
                     JOIN asxh_templates t ON t.id = a.template_id
                    WHERE a.period_id = p.id AND t.locked = FALSE);
--rollback SELECT 1;
