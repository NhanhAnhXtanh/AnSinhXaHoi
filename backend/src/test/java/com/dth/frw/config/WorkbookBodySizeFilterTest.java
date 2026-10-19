package com.dth.frw.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * Trần 20MB cho thân yêu cầu lưu số liệu bảng tính: đơn vị lưu biểu
 * ({@code PUT /api/input_report_sheets/{id}}) và Sở lưu bảng đang sửa
 * ({@code PUT /api/dept_reports/{id}/sheets/{sheet}/draft}). Trước đây hai đường này nhận thân
 * bao nhiêu cũng được và lưu nguyên vào CSDL.
 */
class WorkbookBodySizeFilterTest {

    private static final byte[] OVERSIZED = new byte[(int) WorkbookBodySizeFilter.MAX_BODY_BYTES + 1];

    private final WorkbookBodySizeFilter filter = new WorkbookBodySizeFilter();

    private MockHttpServletResponse run(String method, String uri, byte[] body, MockFilterChain chain)
            throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        request.setContent(body);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        return response;
    }

    @Test
    @DisplayName("Lưu biểu quá 20MB: 413, câu tiếng Việt, không tới controller")
    void oversizedSheetSaveRefused() throws Exception {
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse response = run("PUT", "/api/input_report_sheets/15", OVERSIZED, chain);

        assertEquals(413, response.getStatus());
        assertTrue(response.getContentAsString(java.nio.charset.StandardCharsets.UTF_8)
                .contains(WorkbookBodySizeFilter.MESSAGE));
        assertNull(chain.getRequest(), "yêu cầu không được chuyển tiếp");
    }

    @Test
    @DisplayName("Sở lưu bảng đang sửa quá 20MB: 413")
    void oversizedDeptDraftRefused() throws Exception {
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse response = run("PUT", "/api/dept_reports/3/sheets/1a/draft", OVERSIZED, chain);

        assertEquals(413, response.getStatus());
        assertNull(chain.getRequest());
    }

    @Test
    @DisplayName("Thân dưới trần, hoặc đường khác (đánh dấu biểu, đọc biểu): đi tiếp bình thường")
    void otherRequestsPassThrough() throws Exception {
        MockFilterChain small = new MockFilterChain();
        assertEquals(200, run("PUT", "/api/input_report_sheets/15", "{\"dataJson\":\"{}\"}".getBytes(), small)
                .getStatus());
        assertNotNull(small.getRequest());

        MockFilterChain complete = new MockFilterChain();
        run("POST", "/api/input_report_sheets/15/complete", OVERSIZED, complete);
        assertNotNull(complete.getRequest(), "đường khác không thuộc bộ lọc này");

        MockFilterChain read = new MockFilterChain();
        run("GET", "/api/input_report_sheets/15", OVERSIZED, read);
        assertNotNull(read.getRequest());
    }
}
