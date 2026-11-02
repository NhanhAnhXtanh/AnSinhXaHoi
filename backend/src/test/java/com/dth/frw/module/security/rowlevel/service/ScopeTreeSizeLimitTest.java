package com.dth.frw.module.security.rowlevel.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.dth.frw.shared.security.rowlevel.PolicyValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/**
 * Cây điều kiện của phạm vi dữ liệu bị giới hạn kích thước ngay khi đọc: e2e lưu được một phạm vi
 * 5 000 điều kiện và các lần đọc chính sách đó sau đó làm máy chủ hết bộ nhớ.
 */
class ScopeTreeSizeLimitTest {

    private ScopeTreeCodec codec;

    @BeforeEach
    void setUp() {
        codec = new ScopeTreeCodec(JsonMapper.builder().build());
    }

    private static String leaf(int i) {
        return "{\"field\":\"status\",\"op\":\"eq\",\"value\":{\"lit\":\"s" + i + "\"}}";
    }

    private static String anyOf(int count) {
        StringBuilder json = new StringBuilder("{\"any\":[");
        for (int i = 0; i < count; i++) {
            if (i > 0) json.append(',');
            json.append(leaf(i));
        }
        return json.append("]}").toString();
    }

    private static String nested(int levels) {
        String json = leaf(0);
        for (int i = 1; i < levels; i++) {
            json = "{\"not\":" + json + "}";
        }
        return json;
    }

    private static String inList(int count) {
        StringBuilder values = new StringBuilder();
        for (int i = 0; i < count; i++) {
            if (i > 0) values.append(',');
            values.append('"').append("v").append(i).append('"');
        }
        return "{\"field\":\"status\",\"op\":\"in\",\"value\":{\"lit\":[" + values + "]}}";
    }

    @Test
    @DisplayName("Cây vừa giới hạn: đọc bình thường")
    void treesWithinBoundsParse() {
        assertDoesNotThrow(() -> codec.parse(anyOf(ScopeTreeCodec.MAX_NODES - 1)));
        assertDoesNotThrow(() -> codec.parse(nested(ScopeTreeCodec.MAX_DEPTH)));
        assertDoesNotThrow(() -> codec.parse(inList(ScopeTreeCodec.MAX_LIST_VALUES)));
    }

    @Test
    @DisplayName("5 000 điều kiện: bị từ chối")
    void tooManyConditionsAreRefused() {
        assertThrows(PolicyValidationException.class, () -> codec.parse(anyOf(5_000)));
        assertThrows(PolicyValidationException.class, () -> codec.parse(anyOf(ScopeTreeCodec.MAX_NODES)));
    }

    @Test
    @DisplayName("Lồng sâu quá giới hạn: bị từ chối")
    void tooDeepIsRefused() {
        assertThrows(PolicyValidationException.class, () -> codec.parse(nested(ScopeTreeCodec.MAX_DEPTH + 1)));
    }

    @Test
    @DisplayName("Danh sách giá trị quá dài: bị từ chối")
    void tooLongListIsRefused() {
        assertThrows(PolicyValidationException.class,
                () -> codec.parse(inList(ScopeTreeCodec.MAX_LIST_VALUES + 1)));
    }
}
