package com.dth.frw.module.asxh.template.repo;

import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateStatus;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import jakarta.persistence.TypedQuery;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;

/**
 * Danh sách phiên bản mẫu không kéo workbook / script.
 *
 * <p>Dùng lại đúng {@link Specification} của {@link TemplateVersionSpecifications}
 * (một {@code Specification} chỉ là hàm dựng điều kiện trên {@code Root}), nhưng
 * chọn từng cột thay vì cả entity — {@code workbook_json} có thể vài MB mỗi dòng
 * nên kéo về rồi bỏ là phí cả mạng lẫn bộ nhớ. Thuộc tính sắp xếp đã được
 * {@code ListParams.pageable} lọc theo danh sách cho phép, đều là trường cấp một.
 */
@Component
public class TemplateVersionSummaryQuery {

    private final EntityManager entityManager;

    public TemplateVersionSummaryQuery(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public Page<TemplateVersionRow> page(Specification<TemplateVersion> spec, Pageable pageable) {
        List<TemplateVersionRow> rows = fetch(spec, pageable.getSort(),
                (int) pageable.getOffset(), pageable.getPageSize());
        return new PageImpl<>(rows, pageable, count(spec));
    }

    /** Không phân trang — cho {@code getMany} theo danh sách id. */
    public List<TemplateVersionRow> all(Specification<TemplateVersion> spec, Sort sort) {
        return fetch(spec, sort, -1, -1);
    }

    private List<TemplateVersionRow> fetch(Specification<TemplateVersion> spec, Sort sort, int offset, int limit) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Tuple> query = cb.createTupleQuery();
        Root<TemplateVersion> root = query.from(TemplateVersion.class);
        Join<TemplateVersion, TemplateVersion> previous = root.join("previousVersion", JoinType.LEFT);

        query.multiselect(
                root.get("id"),
                root.get("template"),
                root.get("versionNo"),
                previous.get("id"),
                root.get("status"),
                root.get("effectiveFrom"),
                root.get("effectiveTo"),
                root.get("publishedAt"),
                root.get("publishedBy"),
                root.get("revokedAt"),
                root.get("revokedBy"),
                root.get("createdAt"),
                root.get("updatedAt"));

        Predicate where = spec == null ? null : spec.toPredicate(root, query, cb);
        if (where != null) {
            query.where(where);
        }

        List<Order> orders = new ArrayList<>();
        for (Sort.Order order : sort) {
            orders.add(order.isAscending()
                    ? cb.asc(root.get(order.getProperty()))
                    : cb.desc(root.get(order.getProperty())));
        }
        // Thứ tự ổn định giữa các trang khi khoá sắp xếp trùng nhau.
        orders.add(cb.desc(root.get("id")));
        query.orderBy(orders);

        TypedQuery<Tuple> typed = entityManager.createQuery(query);
        if (offset >= 0) {
            typed.setFirstResult(offset);
        }
        if (limit > 0) {
            typed.setMaxResults(limit);
        }

        List<TemplateVersionRow> rows = new ArrayList<>();
        for (Tuple tuple : typed.getResultList()) {
            rows.add(new TemplateVersionRow(
                    tuple.get(0, Long.class),
                    tuple.get(1, Template.class),
                    tuple.get(2, Integer.class),
                    tuple.get(3, Long.class),
                    tuple.get(4, TemplateStatus.class),
                    tuple.get(5, LocalDate.class),
                    tuple.get(6, LocalDate.class),
                    tuple.get(7, Instant.class),
                    tuple.get(8, String.class),
                    tuple.get(9, Instant.class),
                    tuple.get(10, String.class),
                    tuple.get(11, Instant.class),
                    tuple.get(12, Instant.class)));
        }
        return rows;
    }

    private long count(Specification<TemplateVersion> spec) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Long> query = cb.createQuery(Long.class);
        Root<TemplateVersion> root = query.from(TemplateVersion.class);
        query.select(cb.count(root));
        Predicate where = spec == null ? null : spec.toPredicate(root, query, cb);
        if (where != null) {
            query.where(where);
        }
        Long total = entityManager.createQuery(query).getSingleResult();
        return total == null ? 0 : total;
    }
}
