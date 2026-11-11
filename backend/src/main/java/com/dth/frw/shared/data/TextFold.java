package com.dth.frw.shared.data;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import java.text.Normalizer;
import java.util.regex.Pattern;

/**
 * Tìm kiếm bỏ qua dấu tiếng Việt: gõ "quy iii" vẫn ra "Quý III", "mo coi" ra "mồ côi", "an loc" ra "An Lộc".
 *
 * <p>Hai phía phải cùng một phép đổi, nên có đủ hai nửa: {@link #foldText} cho từ khoá (Java) và
 * {@link #fold} cho cột (SQL). Phía SQL dùng {@code translate} của PostgreSQL với bảng đổi dựng từ cùng
 * bộ chữ cái, nên không cần cài thêm gói mở rộng nào của cơ sở dữ liệu. Bảng gồm cả chữ hoa có dấu vì
 * {@code lower()} của cơ sở dữ liệu có thể không hạ chữ hoa có dấu (tuỳ cấu hình ngôn ngữ).
 */
public final class TextFold {

    /** Các chữ cái có dấu của tiếng Việt, cả hoa lẫn thường, và đ / Đ. */
    private static final String LETTERS =
            "àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ"
                    + "ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ";

    private static final Pattern MARKS = Pattern.compile("\\p{M}+");

    /** Phía "từ": mọi chữ có dấu ở trên. Dùng làm tham số thứ hai của {@code translate}. */
    public static final String FROM = LETTERS;
    /** Phía "thành": chữ không dấu, viết thường, cùng vị trí với {@link #FROM}. */
    public static final String TO;

    static {
        StringBuilder to = new StringBuilder(LETTERS.length());
        for (int i = 0; i < LETTERS.length(); i++) {
            to.append(foldText(String.valueOf(LETTERS.charAt(i))));
        }
        TO = to.toString();
    }

    private TextFold() {
    }

    /** Chữ để SO SÁNH: bỏ dấu, đ → d, hạ chữ thường, cắt khoảng trắng hai đầu. */
    public static String foldText(String text) {
        if (text == null) {
            return "";
        }
        String decomposed = Normalizer.normalize(text, Normalizer.Form.NFD);
        return MARKS.matcher(decomposed).replaceAll("")
                .replace('đ', 'd')
                .replace('Đ', 'D')
                .toLowerCase(java.util.Locale.ROOT)
                .trim();
    }

    /** Mẫu {@code LIKE} cho từ khoá đã bỏ dấu, đi cùng {@link #fold}. */
    public static String likePattern(String term) {
        return "%" + foldText(term) + "%";
    }

    /** Cột đã bỏ dấu và hạ chữ thường, để so với {@link #likePattern}. */
    public static Expression<String> fold(CriteriaBuilder cb, Expression<String> column) {
        return cb.lower(cb.function("translate", String.class, column, cb.literal(FROM), cb.literal(TO)));
    }
}
