package com.dth.frw.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.dth.frw.module.asxh.period.api.dto.ReportCalendarRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.DatabindException;
import tools.jackson.databind.json.JsonMapper;

/**
 * Số lẻ gửi vào trường số nguyên bị từ chối thay vì bị cắt ngầm (năm 2035.5 thành 2035).
 *
 * <p>Đọc bằng chính {@link JsonMapper} của ứng dụng — cái Spring MVC dùng để đọc thân request —
 * nên test này kiểm đúng cấu hình {@code spring.jackson.deserialization.accept-float-as-int}.
 */
@SpringBootTest
class JsonFloatAsIntTest {

    @Autowired
    private JsonMapper mapper;

    @Test
    @DisplayName("Năm có phần lẻ bị từ chối")
    void fractionalYearIsRefused() {
        assertThrows(DatabindException.class,
                () -> mapper.readValue("{\"year\":2035.5}", ReportCalendarRequest.class));
    }

    @Test
    @DisplayName("Năm nguyên vẫn đọc bình thường")
    void wholeYearIsRead() {
        assertEquals(2035, mapper.readValue("{\"year\":2035}", ReportCalendarRequest.class).year());
    }
}
