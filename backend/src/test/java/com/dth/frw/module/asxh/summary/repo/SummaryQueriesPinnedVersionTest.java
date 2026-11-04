package com.dth.frw.module.asxh.summary.repo;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Truy vấn phiên bản ghim của tổng hợp kỳ chạy được trên cơ sở dữ liệu thật (JPQL đúng tên thuộc tính,
 * đúng kiểu tham số) ở cả hai chế độ; kỳ / biểu không tồn tại thì không có kết quả.
 */
@SpringBootTest
@Transactional
class SummaryQueriesPinnedVersionTest {

    @Autowired
    private SummaryQueries queries;

    @Test
    @DisplayName("Kỳ và biểu không tồn tại: không có phiên bản ghim, cả khi chỉ xét phiếu đã duyệt")
    void unknownPeriodHasNoPinnedVersion() {
        assertTrue(queries.pinnedVersionId(List.of(-1L), -1L, true).isEmpty());
        assertTrue(queries.pinnedVersionId(List.of(-1L), -1L, false).isEmpty());
        assertTrue(queries.pinnedVersionId(List.of(), -1L, true).isEmpty());
    }
}
