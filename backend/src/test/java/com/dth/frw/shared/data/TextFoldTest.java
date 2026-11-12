package com.dth.frw.shared.data;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@DisplayName("Tìm kiếm bỏ qua dấu tiếng Việt")
@SpringBootTest
class TextFoldTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("Từ khoá: bỏ dấu, đ thành d, hạ chữ thường")
    void foldsKeywords() {
        assertEquals("quy iii", TextFold.foldText("Quý III"));
        assertEquals("mo coi", TextFold.foldText("mồ côi"));
        assertEquals("dong nai", TextFold.foldText("  ĐỒNG NAI "));
        assertEquals("", TextFold.foldText(null));
        assertEquals("%an loc%", TextFold.likePattern("An Lộc"));
    }

    @Test
    @DisplayName("Bảng đổi của cột: cùng độ dài, mỗi chữ có dấu thành đúng một chữ không dấu")
    void tableIsConsistent() {
        assertEquals(TextFold.FROM.length(), TextFold.TO.length());
        for (int i = 0; i < TextFold.FROM.length(); i++) {
            assertEquals(TextFold.foldText(String.valueOf(TextFold.FROM.charAt(i))), String.valueOf(TextFold.TO.charAt(i)));
        }
    }

    @Test
    @DisplayName("Phía cơ sở dữ liệu cho cùng kết quả như phía Java, kể cả chữ hoa có dấu")
    void databaseFoldMatchesJava() {
        for (String text : new String[] {"Quý III/2026", "Chỉ tiêu mồ côi", "ĐỒNG NAI — Ủy ban nhân dân phường Dầu Giây", "Bản chất"}) {
            String viaDatabase = jdbc.queryForObject(
                    "select lower(translate(?, ?, ?))", String.class, text, TextFold.FROM, TextFold.TO);
            assertEquals(TextFold.foldText(text), viaDatabase, text);
        }
    }
}
