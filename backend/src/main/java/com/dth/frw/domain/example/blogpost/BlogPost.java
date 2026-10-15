package com.dth.frw.domain.example.blogpost;

import com.dth.frw.domain.example.category.Category;
import com.dth.frw.shared.security.rowlevel.RowLevelResource;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * A post, and the resource the dialog-route page pattern exists for.
 *
 * <p>Under row-level management. The name is the resource name verbatim --
 * underscore included, the same string {@code routes.tsx} declares and the same
 * first half as the permission codes -- and what a policy on it may say is
 * declared separately by
 * {@link com.dth.frw.module.example.blogpost.security.BlogPostRowLevelPolicies}.
 */
@RowLevelResource("blog_posts")
@Entity
@Table(name = "blog_posts")
public class BlogPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private BlogPostStatus status = BlogPostStatus.DRAFT;

    // Eager: every list row renders the category title, so a lazy proxy would
    // just turn one query into N.
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected BlogPost() {
        // for JPA
    }

    public BlogPost(String title, String content, BlogPostStatus status, Category category) {
        this.title = title;
        this.content = content;
        this.status = status;
        this.category = category;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
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

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public BlogPostStatus getStatus() {
        return status;
    }

    public void setStatus(BlogPostStatus status) {
        this.status = status;
    }

    public Category getCategory() {
        return category;
    }

    public void setCategory(Category category) {
        this.category = category;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
