package com.dth.frw.module.asxh.template.service;

import com.dth.frw.shared.exception.ResourceNotFoundException;

/**
 * 404 với câu báo tiếng Việt cho cán bộ.
 *
 * <p>Kế thừa {@link ResourceNotFoundException} để {@code ApiExceptionHandler}
 * của base vẫn trả 404 như mọi resource khác; chỉ thay câu chữ, vì câu mặc định
 * của base là tiếng Anh và có lộ mã số kỹ thuật.
 */
public class TemplateNotFoundException extends ResourceNotFoundException {

    private final String vietnameseMessage;

    public TemplateNotFoundException(String what, Object id) {
        super(what, id);
        this.vietnameseMessage = "Không tìm thấy %s này — có thể đã bị xoá.".formatted(what);
    }

    @Override
    public String getMessage() {
        return vietnameseMessage;
    }
}
