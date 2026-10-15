package com.dth.frw.module.example.blogpost.repo;

import com.dth.frw.domain.example.blogpost.BlogPost;
import com.dth.frw.shared.data.SecuredRepository;

/**
 * A {@link SecuredRepository}, so {@code findById}, {@code findAll()} and
 * {@code findAllById} are not here to be called by mistake. Every surviving read
 * takes a {@code Specification}, and {@code BlogPostService} is the only thing
 * that builds one.
 */
public interface BlogPostRepository extends SecuredRepository<BlogPost, Long> {
}
