package com.dth.frw;

import com.dth.frw.shared.data.SecuredRepositoryImpl;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * Entities, repositories and controllers all live below this package, so
 * component scanning finds them without any {@code @EntityScan} of its own
 * despite the {@code domain} and {@code module} trees being separate.
 *
 * <p>The one explicit piece is {@link EnableJpaRepositories}, and it is here
 * only to name a base class. {@link SecuredRepositoryImpl} lends {@code save},
 * {@code delete} and {@code flush} back to
 * {@link com.dth.frw.shared.data.SecuredRepository}, which deliberately
 * inherits nothing. Registering it for every repository rather than for the
 * secured ones alone is both simpler and harmless: Spring Data exposes only what
 * a repository's own interface declares, so the extra methods are reachable
 * exactly where they were asked for. Declaring {@code basePackages} is required
 * once the annotation is present at all, because it replaces the default scan
 * Boot would otherwise configure.
 */
@SpringBootApplication
@EnableJpaRepositories(
        basePackages = "com.dth.frw",
        repositoryBaseClass = SecuredRepositoryImpl.class)
public class DthFrameworkApplication {

    public static void main(String[] args) {
        SpringApplication.run(DthFrameworkApplication.class, args);
    }

}
