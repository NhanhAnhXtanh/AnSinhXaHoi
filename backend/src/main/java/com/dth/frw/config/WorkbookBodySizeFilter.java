package com.dth.frw.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Chặn thân yêu cầu LƯU SỐ LIỆU BẢNG TÍNH quá 20MB, trả 413 kèm câu báo tiếng Việt trong thân JSON —
 * cùng khuôn với {@code TemplateBodySizeFilter} của slice mẫu biểu, cho hai đường còn lại nhận cả
 * workbook:
 * <ul>
 *   <li>{@code PUT|PATCH /api/input_report_sheets/{id}} — đơn vị lưu số liệu của biểu (UC-34);</li>
 *   <li>{@code PUT /api/dept_reports/{id}/sheets/{sheet}/draft} — Sở lưu bảng đang sửa (UC-55).</li>
 * </ul>
 *
 * <p>Trước đây hai đường này không có trần nào (Tomcat không giới hạn thân JSON), nên một bảng tính
 * bị kéo định dạng cả triệu dòng vẫn được lưu nguyên vào CSDL rồi làm nghẽn mọi lần mở / duyệt /
 * tổng hợp sau đó. Giữ đúng trần 20MB của bản Jmix ({@code qt.rest.max-body-bytes}).
 *
 * <p>Thân thừa vẫn được đọc bỏ trước khi trả lời — trả lời ngay khi trình duyệt còn đang gửi thì
 * Tomcat đóng kết nối, trình duyệt chỉ thấy "Failed to fetch" thay vì câu báo. Thân không khai
 * {@code Content-Length} (gửi từng khúc) do {@code @Size} trên DTO chặn (422).
 */
@Component
public class WorkbookBodySizeFilter extends OncePerRequestFilter {

    /** 20MB — cùng số với {@code @Size} của {@code SheetDataRequest} và {@code DeptRequests.DraftRequest}. */
    public static final long MAX_BODY_BYTES = 20L * 1024 * 1024;

    /** Đọc bỏ tối đa chừng này rồi thôi, để một yêu cầu khổng lồ không giữ luồng mãi. */
    private static final long MAX_DRAIN_BYTES = 256L * 1024 * 1024;

    private static final Pattern INPUT_SHEET = Pattern.compile(".*/api/input_report_sheets/[^/]+/?");
    private static final Pattern DEPT_DRAFT = Pattern.compile(".*/api/dept_reports/[^/]+/sheets/[^/]+/draft/?");

    static final String MESSAGE =
            "Bảng tính gửi lên vượt quá giới hạn 20MB nên chưa lưu được. Hãy xoá bớt dòng, cột hoặc vùng "
                    + "trống thừa rồi lưu lại.";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String method = request.getMethod();
        String uri = request.getRequestURI();
        if (uri == null) {
            return true;
        }
        boolean sheetSave = ("PUT".equals(method) || "PATCH".equals(method)) && INPUT_SHEET.matcher(uri).matches();
        boolean deptDraft = "PUT".equals(method) && DEPT_DRAFT.matcher(uri).matches();
        return !sheetSave && !deptDraft;
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
