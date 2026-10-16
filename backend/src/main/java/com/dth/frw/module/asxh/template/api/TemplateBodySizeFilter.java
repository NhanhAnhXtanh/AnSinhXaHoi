package com.dth.frw.module.asxh.template.api;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Chặn thân yêu cầu ghi phiên bản mẫu quá 20MB (UC-11 4b), trả 413 kèm câu
 * báo tiếng Việt trong thân JSON như mọi lỗi khác của API.
 *
 * <p>Giữ đúng giới hạn của bản Jmix ({@code qt.rest.max-body-bytes=20971520})
 * chứ không nới: workbook quá cỡ gần như luôn là vùng trống bị kéo dài (định
 * dạng cả triệu dòng) — cắt vùng thừa trong thiết kế mới là cách sửa đúng.
 *
 * <p>Thân thừa vẫn được đọc bỏ trước khi trả lời: trả lời ngay khi trình duyệt
 * còn đang gửi thì Tomcat đóng kết nối, trình duyệt chỉ thấy "Failed to fetch"
 * thay vì câu báo. Lọc chạy sau chuỗi bảo mật (thứ tự mặc định), nên yêu cầu
 * chưa đăng nhập vẫn bị từ chối 401 trước, và đầu CORS đã có trên phản hồi.
 * {@code @Size} trên DTO là lớp chặn thứ hai khi không có Content-Length.
 */
@Component
public class TemplateBodySizeFilter extends OncePerRequestFilter {

    /** 20MB — cùng số với {@code @Size} của {@code TemplateVersionPatchRequest}. */
    public static final long MAX_BODY_BYTES = 20L * 1024 * 1024;

    /** Đọc bỏ tối đa chừng này rồi thôi, để một yêu cầu khổng lồ không giữ luồng mãi. */
    private static final long MAX_DRAIN_BYTES = 256L * 1024 * 1024;

    private static final String MESSAGE =
            "Bảng tính gửi lên vượt quá giới hạn 20MB. Hãy xoá bớt vùng trống, dòng hoặc cột thừa "
                    + "trong thiết kế rồi lưu lại.";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String method = request.getMethod();
        boolean writes = "POST".equals(method) || "PUT".equals(method) || "PATCH".equals(method);
        return !writes || !request.getRequestURI().contains("/api/template_versions");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long length = request.getContentLengthLong();
        if (length <= MAX_BODY_BYTES) {
            chain.doFilter(request, response);
            return;
        }
        drain(request.getInputStream());
        response.setStatus(413);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"status\":413,\"error\":\"Content Too Large\",\"message\":\""
                + MESSAGE + "\"}");
    }

    private static void drain(ServletInputStream in) throws IOException {
        byte[] buffer = new byte[64 * 1024];
        long total = 0;
        int read;
        while (total < MAX_DRAIN_BYTES && (read = in.read(buffer)) != -1) {
            total += read;
        }
    }
}
