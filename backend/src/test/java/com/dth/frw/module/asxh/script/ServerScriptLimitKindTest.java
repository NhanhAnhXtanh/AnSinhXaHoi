package com.dth.frw.module.asxh.script;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Phân loại script bị dừng vì giới hạn. GraalJS 25 (đã thử trên JDK 21) đặt cờ như sau:
 * đồng hồ canh huỷ → {@code cancelled}; vượt số câu lệnh → {@code cancelled} + {@code resourceExhausted};
 * hết heap ("Java heap space") → CHỈ {@code resourceExhausted}. Trước đây trường hợp cuối cũng thành
 * "quá thời gian" nên cán bộ được báo "đọc số liệu quá lâu" cho một script dừng ngay vì dựng mảng
 * khổng lồ. Không cố gây hết bộ nhớ thật trong test (làm nghẽn cả JVM chạy test) — kiểm phần phân
 * loại; vòng lặp vô hạn vẫn được {@code ServerScriptRunnerTest} chạy thật.
 */
class ServerScriptLimitKindTest {

    @Test
    @DisplayName("Hết bộ nhớ (chỉ resourceExhausted) là MEMORY, không phải TIMEOUT")
    void heapExhaustionIsMemory() {
        assertEquals(ServerScriptException.Kind.MEMORY, ServerScriptRunner.limitKind(false, false, true));
    }

    @Test
    @DisplayName("Đồng hồ canh huỷ / vượt số câu lệnh / bị ngắt vẫn là TIMEOUT")
    void cancellationIsTimeout() {
        assertEquals(ServerScriptException.Kind.TIMEOUT, ServerScriptRunner.limitKind(true, false, false));
        assertEquals(ServerScriptException.Kind.TIMEOUT, ServerScriptRunner.limitKind(true, false, true));
        assertEquals(ServerScriptException.Kind.TIMEOUT, ServerScriptRunner.limitKind(false, true, false));
    }

    @Test
    @DisplayName("Lỗi thường của script không phải dừng vì giới hạn")
    void ordinaryErrorIsNotALimit() {
        assertNull(ServerScriptRunner.limitKind(false, false, false));
    }
}
