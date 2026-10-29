package com.dth.frw.shared.exception;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.dth.frw.domain.asxh.report.InputReportSheet;
import jakarta.persistence.OptimisticLockException;
import java.lang.reflect.Method;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.method.annotation.ExceptionHandlerMethodResolver;

/**
 * Hai phiên cùng ghi một bản ghi có {@code @Version} (vd hai tab cùng lưu một tờ biểu) làm
 * Hibernate ném {@link ObjectOptimisticLockingFailureException} lúc đẩy xuống CSDL. Trước đây ngoại
 * lệ này rơi xuống {@code handleUnexpected} → 500 "Hệ thống gặp sự cố"; phải là 409 với câu bảo
 * người dùng tải lại trang.
 */
class ApiExceptionHandlerConcurrencyTest {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();
    private final ExceptionHandlerMethodResolver resolver = new ExceptionHandlerMethodResolver(ApiExceptionHandler.class);

    @Test
    @DisplayName("Ghi đè đồng thời (số hiệu bản lưu đã đổi) → 409 tiếng Việt, không phải 500")
    void optimisticLockIsConflict() throws Exception {
        Exception stale = new ObjectOptimisticLockingFailureException(InputReportSheet.class, 42L);

        Method method = resolver.resolveMethod(stale);
        assertEquals("handleConcurrentChange", method.getName(),
                "ngoại lệ ghi đè đồng thời phải có bộ xử lý riêng, không rơi xuống handleUnexpected");

        ResponseEntity<Map<String, Object>> response = invoke(method, stale);
        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertEquals(ApiExceptionHandler.MSG_CONCURRENT_CHANGE, response.getBody().get("message"));
    }

    @Test
    @DisplayName("Không lấy được khoá dòng và OptimisticLockException của JPA cũng là 409")
    void lockFailuresAreConflict() throws Exception {
        for (Exception e : new Exception[]{
                new CannotAcquireLockException("could not obtain lock"),
                new OptimisticLockException("Row was updated or deleted by another transaction")}) {
            Method method = resolver.resolveMethod(e);
            assertEquals("handleConcurrentChange", method.getName(), e.getClass().getSimpleName());
            assertEquals(HttpStatus.CONFLICT, invoke(method, e).getStatusCode());
        }
    }

    @SuppressWarnings("unchecked")
    private ResponseEntity<Map<String, Object>> invoke(Method method, Exception e) throws Exception {
        return (ResponseEntity<Map<String, Object>>) method.invoke(handler, e);
    }
}
