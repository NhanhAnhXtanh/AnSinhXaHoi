package com.dth.frw.module.example.blogpost.service;

import com.dth.frw.module.example.blogpost.api.dto.BlogPostPatchRequest;
import com.dth.frw.module.example.blogpost.api.dto.BlogPostRequest;
import com.dth.frw.module.example.blogpost.repo.BlogPostRepository;
import com.dth.frw.module.example.blogpost.repo.BlogPostSpecifications;
import com.dth.frw.module.example.category.service.CategoryService;
import com.dth.frw.domain.example.blogpost.BlogPost;
import com.dth.frw.domain.example.blogpost.BlogPostStatus;
import com.dth.frw.domain.example.category.Category;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.security.rowlevel.Action;
import com.dth.frw.shared.web.ListParams;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class BlogPostService {

    /** Sort properties the list endpoint accepts; anything else is ignored. */
    private static final Set<String> SORTABLE = Set.of("id", "title", "status", "createdAt");

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

    private final BlogPostRepository repository;

    // Resolving a category goes through the category feature's own service
    // rather than its repository: a feature reaching into another feature's
    // repo layer is the coupling this package layout exists to prevent.
    private final CategoryService categoryService;

    // Which rows this caller may reach, folded into the query rather than
    // filtered afterwards.
    private final RowLevelSecurity rowLevel;

    public BlogPostService(BlogPostRepository repository,
                           CategoryService categoryService,
                           RowLevelSecurity rowLevel) {
        this.repository = repository;
        this.categoryService = categoryService;
        this.rowLevel = rowLevel;
    }

    public Page<BlogPost> list(ListParams params) {
        return repository.findAll(
                // The scope first, the caller's filters second: Specification.and
                // has no subtraction, so no query string can widen it.
                rowLevel.scope(BlogPost.class, Action.READ)
                        .and(BlogPostSpecifications.from(params)),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public BlogPost get(Long id) {
        return repository.findOne(rowLevel.byId(BlogPost.class, Action.READ, id))
                .orElseThrow(() -> new ResourceNotFoundException("Blog post", id));
    }

    public List<BlogPost> getMany(List<Long> ids) {
        return repository.findAll(rowLevel.byIds(BlogPost.class, Action.READ, ids));
    }

    @Transactional
    public BlogPost create(BlogPostRequest request) {
        BlogPost post = new BlogPost(
                request.title().trim(),
                request.content(),
                request.status() == null ? BlogPostStatus.DRAFT : request.status(),
                category(request.category().id()));

        BlogPost saved = repository.persist(post);
        // Flushed first: the identity key and the @PrePersist stamp only exist
        // afterwards, and checking a policy against a half-built row is wrong
        // in every case.
        repository.flush();
        rowLevel.checkWritable(saved);
        return saved;
    }

    @Transactional
    public BlogPost update(Long id, BlogPostPatchRequest request) {
        // USING, on the state as it stands. Out of scope is a 404, which is
        // deliberately indistinguishable from "no such post".
        BlogPost post = repository.findOne(rowLevel.byId(BlogPost.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException("Blog post", id));

        if (request.title() != null) {
            post.setTitle(request.title().trim());
        }
        if (request.content() != null) {
            post.setContent(request.content());
        }
        if (request.status() != null) {
            post.setStatus(request.status());
        }
        if (request.category() != null && request.category().id() != null) {
            post.setCategory(category(request.category().id()));
        }

        // WITH CHECK, on the state this save would leave behind. This is what
        // stops a post being moved into a category the writer cannot reach in
        // order to hide it from their own section.
        rowLevel.checkWritable(post);
        return repository.persist(post);
    }

    @Transactional
    public BlogPost delete(Long id) {
        // Its own action, not a read followed by a delete: somebody may see a
        // row without being allowed to remove it.
        BlogPost post = repository.findOne(rowLevel.byId(BlogPost.class, Action.DELETE, id))
                .orElseThrow(() -> new ResourceNotFoundException("Blog post", id));
        repository.remove(post);
        // Returned so the controller can echo the deleted row: the data
        // provider parses the DELETE response body.
        return post;
    }

    /** Raises the same 404 as the category endpoints would for an unknown id. */
    private Category category(Long categoryId) {
        return categoryService.get(categoryId);
    }
}
