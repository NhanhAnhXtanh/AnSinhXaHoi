package com.dth.frw.module.example.category.service;

import com.dth.frw.module.example.category.api.dto.CategoryPatchRequest;
import com.dth.frw.module.example.category.api.dto.CategoryRequest;
import com.dth.frw.module.example.category.repo.CategoryRepository;
import com.dth.frw.module.example.category.repo.CategorySpecifications;
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
public class CategoryService {

    /** Sort properties the list endpoint accepts; anything else is ignored. */
    private static final Set<String> SORTABLE = Set.of("id", "title");

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.desc("id"));

    private final CategoryRepository repository;

    // Which rows this caller may reach. Every method it offers hands back a
    // Specification rather than running anything, so the scope becomes part of
    // the query that was going to run anyway.
    private final RowLevelSecurity rowLevel;

    public CategoryService(CategoryRepository repository, RowLevelSecurity rowLevel) {
        this.repository = repository;
        this.rowLevel = rowLevel;
    }

    public Page<Category> list(ListParams params) {
        return repository.findAll(
                // The scope first, the caller's filters second: Specification.and
                // has no subtraction, so no query string can widen it.
                rowLevel.scope(Category.class, Action.READ)
                        .and(CategorySpecifications.from(params)),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public Category get(Long id) {
        return repository.findOne(rowLevel.byId(Category.class, Action.READ, id))
                .orElseThrow(() -> new ResourceNotFoundException("Category", id));
    }

    /** Resolves the ids a {@code getMany} request asked for, in one query. */
    public List<Category> getMany(List<Long> ids) {
        return repository.findAll(rowLevel.byIds(Category.class, Action.READ, ids));
    }

    @Transactional
    public Category create(CategoryRequest request) {
        Category saved = repository.persist(new Category(request.title().trim()));
        // Flushed first: the identity key only exists afterwards, and checking a
        // policy against a half-built row is wrong in every case.
        repository.flush();
        rowLevel.checkWritable(saved);
        return saved;
    }

    @Transactional
    public Category update(Long id, CategoryPatchRequest request) {
        // USING, on the state as it stands. Out of scope is a 404, which is
        // deliberately indistinguishable from "no such category".
        Category category = repository.findOne(rowLevel.byId(Category.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException("Category", id));

        if (request.title() != null) {
            category.setTitle(request.title().trim());
        }

        // WITH CHECK, on the state this save would leave behind.
        rowLevel.checkWritable(category);
        return repository.persist(category);
    }

    @Transactional
    public Category delete(Long id) {
        // Its own action, not a read followed by a delete: somebody may see a
        // row without being allowed to remove it.
        Category category = repository.findOne(rowLevel.byId(Category.class, Action.DELETE, id))
                .orElseThrow(() -> new ResourceNotFoundException("Category", id));
        repository.remove(category);
        // Returned so the controller can echo the deleted row: the data
        // provider parses the DELETE response body.
        return category;
    }
}
