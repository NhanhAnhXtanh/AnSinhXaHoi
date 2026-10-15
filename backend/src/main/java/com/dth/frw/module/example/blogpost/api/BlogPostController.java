package com.dth.frw.module.example.blogpost.api;

import com.dth.frw.module.example.blogpost.api.dto.BlogPostPatchRequest;
import com.dth.frw.module.example.blogpost.api.dto.BlogPostRequest;
import com.dth.frw.module.example.blogpost.api.dto.BlogPostResponse;
import com.dth.frw.module.example.blogpost.service.BlogPostService;
import com.dth.frw.domain.example.blogpost.BlogPost;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.security.Permissions;
import com.dth.frw.shared.web.ListParams;
import com.dth.frw.shared.web.ListResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/blog_posts} — the {@code blog_posts} resource of the admin UI.
 *
 * <p>The underscore is not a typo: the data provider builds every endpoint as
 * {@code {apiURL}/{resource}}, so the path segment has to be the resource name
 * declared in the frontend's {@code routes.tsx} verbatim.
 */
@RestController
@RequestMapping("/api/blog_posts")
public class BlogPostController {

    private final BlogPostService service;

    // Only to stamp each row with what this caller may do to it. The filtering
    // itself already happened, inside the service, as part of the query.
    private final RowLevelSecurity rowLevel;

    public BlogPostController(BlogPostService service, RowLevelSecurity rowLevel) {
        this.service = service;
        this.rowLevel = rowLevel;
    }

    /**
     * Serves both {@code getList} and {@code getMany}.
     *
     * <p>They differ only in the query string — {@code getMany} sends
     * {@code ids[n]} and no window — so they share one endpoint, with the id
     * lookup answered unpaged.
     */
    @GetMapping
    @PreAuthorize("hasAuthority('" + Permissions.BLOG_POSTS_READ + "')")
    public ResponseEntity<List<BlogPostResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<BlogPostResponse> rows = service.getMany(ids).stream()
                    .map(row -> BlogPostResponse.from(row, rowLevel))
                    .toList();
            return ListResponse.of(rows, rows.size());
        }

        Page<BlogPost> page = service.list(params);
        return ListResponse.of(
                page.map(row -> BlogPostResponse.from(row, rowLevel)).getContent(),
                page.getTotalElements());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + Permissions.BLOG_POSTS_READ + "')")
    public BlogPostResponse get(@PathVariable Long id) {
        return BlogPostResponse.from(service.get(id), rowLevel);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('" + Permissions.BLOG_POSTS_WRITE + "')")
    public ResponseEntity<BlogPostResponse> create(@Valid @RequestBody BlogPostRequest request) {
        BlogPost created = service.create(request);
        return ResponseEntity
                .created(URI.create("/api/blog_posts/" + created.getId()))
                .body(BlogPostResponse.from(created, rowLevel));
    }

    /**
     * {@code PATCH} is what the data provider sends by default; {@code PUT} is
     * mapped to the same handler so the resource is also usable from clients
     * that only speak full replacement.
     */
    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAuthority('" + Permissions.BLOG_POSTS_WRITE + "')")
    public BlogPostResponse update(@PathVariable Long id, @Valid @RequestBody BlogPostPatchRequest request) {
        return BlogPostResponse.from(service.update(id, request), rowLevel);
    }

    /** Echoes the deleted row — the data provider parses the response body. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('" + Permissions.BLOG_POSTS_DELETE + "')")
    public BlogPostResponse delete(@PathVariable Long id) {
        return BlogPostResponse.from(service.delete(id));
    }
}
