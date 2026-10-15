package com.dth.frw.module.example.category.repo;

import com.dth.frw.domain.example.category.Category;
import com.dth.frw.shared.data.SecuredRepository;

/**
 * A {@link SecuredRepository}, so {@code findById}, {@code findAll()} and
 * {@code findAllById} are not here to be called by mistake. Every surviving read
 * takes a {@code Specification}, and {@code CategoryService} is the only thing
 * that builds one.
 */
public interface CategoryRepository extends SecuredRepository<Category, Long> {
}
