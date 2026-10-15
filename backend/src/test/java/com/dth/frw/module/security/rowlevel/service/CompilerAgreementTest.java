package com.dth.frw.module.security.rowlevel.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.domain.bpm.task.Task;
import com.dth.frw.domain.bpm.task.TaskPriority;
import com.dth.frw.domain.bpm.task.TaskStatus;
import com.dth.frw.domain.catalog.department.Department;
import com.dth.frw.domain.security.user.User;
import com.dth.frw.shared.security.rowlevel.Action;
import com.dth.frw.shared.security.rowlevel.RowLevelPrincipal;
import com.dth.frw.shared.security.rowlevel.Tri;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Root;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * T4 — the test the whole design exists to make possible, and the one that must
 * never be deleted.
 *
 * <p>One declaration, two compilers. {@code PredicateCompiler} turns a plan into
 * SQL and {@code EntityEvaluator} answers the same plan in memory, and they are
 * used for different things — the first decides which rows a list contains, the
 * second decides whether a save is allowed and which buttons a row gets. If they
 * ever disagree, a row is visible in a list and refused on save, or worse,
 * refused in a list and accepted on save.
 *
 * <p>So: for each tree, the set of task ids the database returns must be exactly
 * the set the in-memory evaluator accepts. The fixture is built specifically to
 * cover the cases where the two are most likely to part company — a
 * {@code not} over a nullable field, a null foreign key inside an
 * {@code EXISTS}, a context key that resolves to null, and an empty set.
 */
@SpringBootTest
@Transactional
class CompilerAgreementTest {

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private RowLevelRegistry registry;

    @Autowired
    private PolicyCompiler compiler;

    @Autowired
    private ScopeTreeCodec codec;

    @Autowired
    private PredicateCompiler predicates;

    @Autowired
    private EntityEvaluator evaluator;

    private RowLevelRegistry.Managed tasks;
    private List<Task> fixture;
    private User someone;
    private Department somewhere;

    /**
     * Every combination of "the field is null" against "the field is the value
     * the policy is about", for both associations plus a nullable date.
     *
     * <p>Written out rather than reused from the seed data, because the seed is
     * demo content that somebody will reasonably change, and the cases that
     * matter here are precisely the awkward ones nobody puts in demo content.
     */
    @BeforeEach
    void setUp() {
        tasks = registry.byResource("tasks").orElseThrow();

        someone = entityManager
                .createQuery("select u from User u order by u.id", User.class)
                .setMaxResults(1).getSingleResult();
        somewhere = entityManager
                .createQuery("select d from Department d order by d.id", Department.class)
                .setMaxResults(1).getSingleResult();

        fixture = new ArrayList<>();
        fixture.add(task("both set", someone, somewhere, LocalDate.of(2026, 6, 1)));
        fixture.add(task("no assignee", null, somewhere, LocalDate.of(2026, 6, 1)));
        fixture.add(task("no department", someone, null, LocalDate.of(2026, 6, 1)));
        fixture.add(task("neither", null, null, null));
        fixture.add(task("no due date", someone, somewhere, null));

        entityManager.flush();
    }

    static Stream<String> trees() {
        return Stream.of(
                // The plain cases, to prove the harness itself works.
                """
                { "field": "department.id", "op": "eq", "value": { "ctx": "user.departmentId" } }""",
                """
                { "field": "assignee.id", "op": "eq", "value": { "ctx": "user.id" } }""",
                """
                { "field": "status", "op": "in", "value": { "lit": ["TODO", "IN_PROGRESS"] } }""",

                // A not over an association. Without normalisation this is the
                // NOT EXISTS that accepts a row whose foreign key is null while
                // three-valued logic refuses it.
                """
                { "not": { "field": "department.id", "op": "eq", "value": { "ctx": "user.departmentId" } } }""",
                """
                { "not": { "field": "assignee.id", "op": "eq", "value": { "ctx": "user.id" } } }""",

                // A not over a nullable column.
                """
                { "not": { "field": "dueDate", "op": "gte", "value": { "lit": "2026-01-01" } } }""",

                // De Morgan across a whole subtree.
                """
                { "not": { "all": [
                    { "field": "assignee.id",   "op": "eq", "value": { "ctx": "user.id" } },
                    { "field": "department.id", "op": "eq", "value": { "ctx": "user.departmentId" } }
                ]}}""",
                """
                { "not": { "any": [
                    { "field": "assignee.id",   "op": "eq", "value": { "ctx": "user.id" } },
                    { "field": "department.id", "op": "eq", "value": { "ctx": "user.departmentId" } }
                ]}}""",

                // The isNull branch somebody has to write out by hand once they
                // understand why the not above does not match a null.
                """
                { "any": [
                    { "not": { "field": "assignee.id", "op": "eq", "value": { "ctx": "user.id" } } },
                    { "field": "assignee.id", "op": "isNull" }
                ]}""",
                """
                { "field": "dueDate", "op": "isNull" }""",
                """
                { "field": "department.id", "op": "isNotNull" }""",

                // Empty sets, where the answer is a definition this design made
                // rather than something SQL could express: `x IN ()` cannot be
                // written at all.
                """
                { "field": "status", "op": "in", "value": { "lit": [] } }""",
                """
                { "field": "department.id", "op": "notIn", "value": { "lit": [] } }""",

                // Ranges, and the negation that becomes any[lt, gt].
                """
                { "field": "dueDate", "op": "between", "value": { "lit": ["2026-01-01", "2026-12-31"] } }""",
                """
                { "not": { "field": "dueDate", "op": "between",
                           "value": { "lit": ["2026-01-01", "2026-12-31"] } } }""",

                // The full scope and the empty one.
                "{ \"all\": [] }",
                "{ \"any\": [] }");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("trees")
    @DisplayName("T4: SQL and the in-memory evaluator select exactly the same rows")
    void bothCompilersAgree(String json) {
        ScopePlan plan = compiler.compile(tasks, Action.READ, codec.parse(json));

        // A principal whose department matches the fixture, so the conditions
        // actually split the rows rather than matching all or none.
        RowLevelPrincipal principal = principal(someone.getId(), somewhere.getId());

        assertEquals(
                inMemory(plan, principal),
                fromDatabase(plan, principal),
                "the two compilers disagree about " + json);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("trees")
    @DisplayName("T4: they still agree when a context key resolves to null")
    void bothCompilersAgreeWithNullContext(String json) {
        ScopePlan plan = compiler.compile(tasks, Action.READ, codec.parse(json));

        // Somebody in no department. A comparison against nothing is UNKNOWN,
        // and UNKNOWN refuses the row -- on both sides.
        RowLevelPrincipal principal = principal(someone.getId(), null);

        assertEquals(
                inMemory(plan, principal),
                fromDatabase(plan, principal),
                "the two compilers disagree about " + json + " when the context is null");
    }

    @org.junit.jupiter.api.Test
    @DisplayName("Three-valued logic in practice: not(assignee = me) does not match an unassigned task")
    void notDoesNotMatchNull() {
        ScopePlan plan = compiler.compile(tasks, Action.READ, codec.parse("""
                { "not": { "field": "assignee.id", "op": "eq", "value": { "ctx": "user.id" } } }"""));
        RowLevelPrincipal principal = principal(someone.getId(), somewhere.getId());

        Task unassigned = fixture.get(1);
        assertEquals(Tri.UNKNOWN, evaluator.evaluate(plan, unassigned, principal));
        assertFalse(fromDatabase(plan, principal).contains(unassigned.getId()),
                "an unassigned task must not be selected by a negated condition on the assignee");

        // And the branch somebody writes to get the other behaviour does match.
        ScopePlan spelledOut = compiler.compile(tasks, Action.READ, codec.parse("""
                { "any": [
                    { "not": { "field": "assignee.id", "op": "eq", "value": { "ctx": "user.id" } } },
                    { "field": "assignee.id", "op": "isNull" }
                ]}"""));
        assertTrue(fromDatabase(spelledOut, principal).contains(unassigned.getId()));
    }

    /** The ids the database returns for this plan, restricted to the fixture. */
    private Set<Long> fromDatabase(ScopePlan plan, RowLevelPrincipal principal) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Long> query = cb.createQuery(Long.class);
        Root<Task> root = query.from(Task.class);

        query.select(root.get("id")).where(cb.and(
                root.get("id").in(fixture.stream().map(Task::getId).toList()),
                predicates.toPredicate(plan, root, query, cb, principal)));

        return new LinkedHashSet<>(entityManager.createQuery(query).getResultList());
    }

    /** The ids the in-memory evaluator accepts, over the same rows. */
    private Set<Long> inMemory(ScopePlan plan, RowLevelPrincipal principal) {
        Set<Long> accepted = new LinkedHashSet<>();
        for (Task task : fixture) {
            if (evaluator.evaluate(plan, task, principal).isTrue()) {
                accepted.add(task.getId());
            }
        }
        return accepted;
    }

    private Task task(String title, User assignee, Department department, LocalDate dueDate) {
        Task task = new Task(title, null, TaskStatus.TODO, TaskPriority.MEDIUM);
        task.setAssignee(assignee);
        task.setDepartment(department);
        task.setDueDate(dueDate);
        entityManager.persist(task);
        return task;
    }

    private static RowLevelPrincipal principal(Long userId, Long departmentId) {
        return new RowLevelPrincipal(userId, null, departmentId, Set.of("USER"), Set.of(1L));
    }
}
