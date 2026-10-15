package com.dth.frw.module.example.category.api;

import com.dth.frw.module.example.category.api.dto.CategoryPatchRequest;
import com.dth.frw.module.example.category.api.dto.CategoryRequest;
import com.dth.frw.module.example.category.api.dto.CategoryResponse;
import com.dth.frw.module.example.category.service.CategoryService;
import com.dth.frw.domain.example.category.Category;
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
 * {@code /api/categories} — the {@code categories} resource of the admin UI.
 *
 * <p>The path segment has to match the resource name declared in the frontend's
 * {@code routes.tsx}, because the data provider builds every endpoint as
 * {@code {apiURL}/{resource}}.
 */
@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryService service;

    // Only to stamp each row with what this caller may do to it. The filtering
    // itself already happened, inside the service, as part of the query.
    private final RowLevelSecurity rowLevel;

    public CategoryController(CategoryService service, RowLevelSecurity rowLevel) {
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
    @PreAuthorize("hasAuthority('" + Permissions.CATEGORIES_READ + "')")
    public ResponseEntity<List<CategoryResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<CategoryResponse> rows = service.getMany(ids).stream()
                    .map(row -> CategoryResponse.from(row, rowLevel))
                    .toList();
            return ListResponse.of(rows, rows.size());
        }

        Page<Category> page = service.list(params);
        return ListResponse.of(
                page.map(row -> CategoryResponse.from(row, rowLevel)).getContent(),
                page.getTotalElements());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + Permissions.CATEGORIES_READ + "')")
    public CategoryResponse get(@PathVariable Long id) {
        return CategoryResponse.from(service.get(id), rowLevel);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('" + Permissions.CATEGORIES_WRITE + "')")
    public ResponseEntity<CategoryResponse> create(@Valid @RequestBody CategoryRequest request) {
        Category created = service.create(request);
        return ResponseEntity
                .created(URI.create("/api/categories/" + created.getId()))
                .body(CategoryResponse.from(created, rowLevel));
    }

    /**
     * {@code PATCH} is what the data provider sends by default; {@code PUT} is
     * mapped to the same handler so the resource is also usable from clients
     * that only speak full replacement.
     */
    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAuthority('" + Permissions.CATEGORIES_WRITE + "')")
    public CategoryResponse update(@PathVariable Long id, @Valid @RequestBody CategoryPatchRequest request) {
        return CategoryResponse.from(service.update(id, request), rowLevel);
    }

    /** Echoes the deleted row — the data provider parses the response body. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('" + Permissions.CATEGORIES_DELETE + "')")
    public CategoryResponse delete(@PathVariable Long id) {
        return CategoryResponse.from(service.delete(id));
    }
}
