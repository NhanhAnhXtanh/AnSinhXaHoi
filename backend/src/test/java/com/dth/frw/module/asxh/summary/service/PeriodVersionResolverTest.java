package com.dth.frw.module.asxh.summary.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.summary.repo.SummaryQueries;
import com.dth.frw.module.asxh.template.service.TemplateVersionService;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Tổng hợp theo kỳ chọn phiên bản theo thứ tự: bản ghim trong phiếu đã có số → bản ghim trong phiếu
 * còn hiện hành → theo ngày đầu kỳ (mượn bản sớm nhất).
 */
class PeriodVersionResolverTest {

    private static final Long TEMPLATE = 23L;
    private static final List<Long> LEAVES = List.of(63L);

    private SummaryQueries queries;
    private TemplateVersionService versions;
    private PeriodVersionResolver resolver;
    private ReportPeriod thang4;

    @BeforeEach
    void setUp() {
        queries = mock(SummaryQueries.class);
        versions = mock(TemplateVersionService.class);
        resolver = new PeriodVersionResolver(queries, versions);
        thang4 = mock(ReportPeriod.class);
        when(thang4.getFromDate()).thenReturn(LocalDate.of(2024, 4, 1));
        when(queries.pinnedVersionId(any(), anyLong(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenReturn(Optional.empty());
    }

    private static TemplateVersion version(long id, LocalDate effectiveFrom) {
        TemplateVersion version = mock(TemplateVersion.class);
        when(version.getId()).thenReturn(id);
        when(version.getEffectiveFrom()).thenReturn(effectiveFrom);
        return version;
    }

    @Test
    @DisplayName("Có phiếu đã duyệt: lấy bản ghim trong phiếu đó, không mượn bản sớm nhất theo ngày")
    void prefersVersionOfApprovedReports() {
        TemplateVersion v3 = version(31, LocalDate.of(2026, 11, 3));
        when(queries.pinnedVersionId(LEAVES, TEMPLATE, true)).thenReturn(Optional.of(31L));
        when(versions.get(31L)).thenReturn(v3);

        PeriodVersionResolver.Resolved resolved = resolver.resolve(thang4, LEAVES, TEMPLATE).orElseThrow();

        assertEquals(31L, resolved.version().getId());
        assertTrue(resolved.pinned());
        assertFalse(resolved.borrowedEarliest(thang4), "bản ghim không coi là mượn, dù áp dụng sau đầu kỳ");
        verify(versions, never()).resolveOrEarliest(anyLong(), any());
    }

    @Test
    @DisplayName("Chưa phiếu nào được duyệt: lấy bản ghim trong phiếu đang nhập")
    void fallsBackToOpenReports() {
        TemplateVersion v2 = version(30, LocalDate.of(2026, 11, 2));
        when(queries.pinnedVersionId(LEAVES, TEMPLATE, false)).thenReturn(Optional.of(30L));
        when(versions.get(30L)).thenReturn(v2);

        assertEquals(30L, resolver.resolve(thang4, LEAVES, TEMPLATE).orElseThrow().version().getId());
    }

    @Test
    @DisplayName("Kỳ chưa có phiếu: chọn theo ngày đầu kỳ, mượn bản sớm nhất như trước")
    void fallsBackToDate() {
        TemplateVersion v1 = version(29, LocalDate.of(2026, 11, 1));
        when(versions.resolveOrEarliest(TEMPLATE, LocalDate.of(2024, 4, 1))).thenReturn(Optional.of(v1));

        PeriodVersionResolver.Resolved resolved = resolver.resolve(thang4, LEAVES, TEMPLATE).orElseThrow();

        assertEquals(29L, resolved.version().getId());
        assertFalse(resolved.pinned());
        assertTrue(resolved.borrowedEarliest(thang4));
    }
}
