package com.dth.frw.module.asxh.template.service;

/**
 * Một biểu vừa được khoá hoặc mở khoá cả biểu — phát trong giao dịch của lần khoá / mở khoá.
 *
 * <p>Sự kiện chứ không gọi thẳng: slice thiết lập kỳ đã phụ thuộc slice biểu mẫu, gọi ngược lại
 * là vòng phụ thuộc. Bên nghe ({@code TemplateLockSetupSync} ở slice thiết lập) chạy đồng bộ
 * trong cùng giao dịch: kỳ chưa mở đợt mà không còn ô nào của biểu dùng được thì về Chưa thiết
 * lập, có lại thì về Đã thiết lập.
 *
 * @param templateId id biểu
 * @param locked     {@code true} = vừa khoá, {@code false} = vừa mở khoá
 */
public record TemplateFormLockChanged(Long templateId, boolean locked) {
}
