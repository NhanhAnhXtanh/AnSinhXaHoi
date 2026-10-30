package com.dth.frw.module.asxh.template.migration;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import liquibase.change.custom.CustomTaskChange;
import liquibase.database.Database;
import liquibase.database.jvm.JdbcConnection;
import liquibase.exception.CustomChangeException;
import liquibase.exception.ValidationErrors;
import liquibase.resource.ResourceAccessor;

/**
 * Changeset 171: tách {@code asxh_template_versions.script_text} thành các dòng
 * {@code asxh_template_scripts} theo {@link ScriptTextSplitter}.
 *
 * <p>Chạy lại an toàn: chỉ xử lý phiên bản có script mà CHƯA có kịch bản nào trong bảng mới.
 * Không sửa / xoá {@code script_text} — cột giữ làm đường lùi.
 */
public class SplitTemplateScriptsChange implements CustomTaskChange {

    /** Đánh dấu dòng do changeset này tạo (rollback xoá theo dấu này). */
    public static final String CREATED_BY = "migration-171";

    private int versions;
    private int scripts;

    @Override
    public void execute(Database database) throws CustomChangeException {
        if (!(database.getConnection() instanceof JdbcConnection jdbc)) {
            throw new CustomChangeException("Changeset 171 cần kết nối JDBC.");
        }
        try {
            Result result = migrate(jdbc.getWrappedConnection());
            versions = result.versions();
            scripts = result.scripts();
        } catch (SQLException e) {
            throw new CustomChangeException("Không tách được script của phiên bản mẫu: " + e.getMessage(), e);
        }
    }

    /** Số phiên bản đã tách và số kịch bản đã ghi. */
    public record Result(int versions, int scripts) {
    }

    /**
     * Phần việc thật — tách ra để test gọi thẳng trên kết nối của giao dịch test.
     */
    public static Result migrate(Connection connection) throws SQLException {
        record Pending(long id, String text) {
        }
        List<Pending> pending = new ArrayList<>();
        try (PreparedStatement select = connection.prepareStatement(
                "SELECT v.id, v.script_text FROM asxh_template_versions v "
                        + "WHERE btrim(coalesce(v.script_text, '')) <> '' "
                        + "AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts s WHERE s.template_version_id = v.id) "
                        + "ORDER BY v.id");
             ResultSet rows = select.executeQuery()) {
            while (rows.next()) {
                pending.add(new Pending(rows.getLong(1), rows.getString(2)));
            }
        }
        int versionCount = 0;
        int scriptCount = 0;
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, "
                        + "declared_hooks, display_order, enabled, script_hash, created_at, created_by) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, now(), ?)")) {
            for (Pending version : pending) {
                List<ScriptTextSplitter.Part> parts = ScriptTextSplitter.split(version.text());
                if (parts.isEmpty()) {
                    continue;
                }
                for (ScriptTextSplitter.Part part : parts) {
                    insert.setLong(1, version.id());
                    setNullable(insert, 2, part.sheetCode());
                    insert.setString(3, part.name());
                    setNullable(insert, 4, part.description());
                    insert.setString(5, part.code());
                    setNullable(insert, 6, part.declaredHooks());
                    insert.setInt(7, part.displayOrder());
                    insert.setBoolean(8, part.enabled());
                    insert.setString(9, sha256(part.code()));
                    insert.setString(10, CREATED_BY);
                    insert.addBatch();
                    scriptCount++;
                }
                versionCount++;
            }
            insert.executeBatch();
        }
        return new Result(versionCount, scriptCount);
    }

    private static void setNullable(PreparedStatement statement, int index, String value) throws SQLException {
        if (value == null) {
            statement.setNull(index, Types.VARCHAR);
        } else {
            statement.setString(index, value);
        }
    }

    public static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 không khả dụng", e);
        }
    }

    @Override
    public String getConfirmationMessage() {
        return "Đã tách script của " + versions + " phiên bản mẫu thành " + scripts + " kịch bản.";
    }

    @Override
    public void setUp() {
        // Không có tham số.
    }

    @Override
    public void setFileOpener(ResourceAccessor resourceAccessor) {
        // Không đọc file.
    }

    @Override
    public ValidationErrors validate(Database database) {
        return new ValidationErrors();
    }
}
