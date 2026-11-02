package com.dth.frw.module.asxh.script;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Lưu số liệu biểu chỉ nhận thân đọc được như một workbook SpreadJS — thân hỏng (không phải JSON,
 * mảng, chuỗi, {@code sheets} sai kiểu) bị từ chối thay vì lưu vào làm biểu không mở được nữa.
 */
class WorkbookJsonReadableTest {

    @ParameterizedTest
    @DisplayName("Workbook đúng dạng: nhận")
    @ValueSource(strings = {
            "{\"version\":\"16.0\",\"sheets\":{}}",
            "{\"version\":\"16.0\",\"sheets\":{\"1a\":{\"name\":\"1a\",\"data\":{\"dataTable\":{\"9\":{\"2\":{\"value\":3}}}}}}}",
            "{\"version\":\"16.0\"}",
    })
    void readableWorkbooks(String json) {
        assertTrue(WorkbookJsonCellReader.isReadableWorkbook(json));
    }

    @ParameterizedTest
    @DisplayName("Thân hỏng: từ chối")
    @ValueSource(strings = {
            "not-json{",
            "{\"sheets\":{}",
            "{\"sheets\":{}} rác",
            "[]",
            "\"chuỗi\"",
            "42",
            "{\"sheets\":[]}",
            "{\"sheets\":\"x\"}",
            " ",
    })
    void unreadableBodies(String json) {
        assertFalse(WorkbookJsonCellReader.isReadableWorkbook(json));
    }
}
