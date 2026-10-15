package com.dth.frw.domain.example.category;

import com.dth.frw.shared.security.rowlevel.RowLevelResource;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A blog post category.
 *
 * <p>Field names are deliberately the ones the Refine admin already expects
 * ({@code id}, {@code title}), so the JSON payload needs no renaming.
 *
 * <p>Under row-level management. The name is the resource name verbatim -- the
 * same string {@code routes.tsx} declares and the same first half as the
 * permission codes -- and what a policy on it may say is declared separately by
 * {@link com.dth.frw.module.example.category.security.CategoryRowLevelPolicies}.
 */
@RowLevelResource("categories")
@Entity
@Table(name = "categories")
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String title;

    protected Category() {
        // for JPA
    }

    public Category(String title) {
        this.title = title;
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }
}
