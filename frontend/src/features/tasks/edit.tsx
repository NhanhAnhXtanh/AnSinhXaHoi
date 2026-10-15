import { useEffect } from "react";
import { useForm } from "@refinedev/react-hook-form";
import { useNavigate } from "react-router";

import {
  EditView,
  EditViewHeader,
} from "@/shared/components/views/edit-view";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { AssignmentPicker, type TaskRef } from "./assignment-picker";
import { PRIORITY_OPTIONS, STATUS_OPTIONS, type Task } from "@/domains/task/types";
import {
  FormActions,
  FormPanel,
} from "@/shared/components/form/form-panel";

/**
 * Trims a reference down to the `{ id }` the API reads, preserving the three
 * states it distinguishes: `null` leaves the field alone, `{ id: null }` clears
 * it, and an id sets it.
 */
function toTaskRef(value: unknown): TaskRef | null {
  if (value == null) return null;
  const id = (value as { id?: number | string | null }).id;
  return { id: id == null ? null : Number(id) };
}

export const TaskEdit = () => {
  const navigate = useNavigate();

  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    refineCoreProps: {},
  });

  const task = query?.data?.data as Task | undefined;

  /**
   * Fill the form from the record, in one go.
   *
   * `@refinedev/react-hook-form` fills a form by walking the fields it believes
   * are registered. `assignee` and `department` are driven by
   * `AssignmentPicker` rather than by a `FormField`, so they are never
   * registered and that walk would skip them — every task would open showing
   * "Unassigned" regardless of who holds it. `reset` writes the record into the
   * form's values wholesale instead, and `keepDirtyValues` stops the refetch
   * that follows a cache hit from discarding anything changed since.
   */
  const { reset } = form;
  useEffect(() => {
    if (!task) return;
    reset(task, { keepDirtyValues: true });
  }, [task, reset]);

  function onSubmit(values: Record<string, unknown>) {
    onFinish({
      ...values,
      assignee: toTaskRef(values.assignee),
      department: toTaskRef(values.department),
      // `TaskPatchRequest.dueDate` is a string precisely so that "" can clear
      // it, so an emptied date input is sent as "" rather than omitted. Typed
      // as a date on the backend it would arrive as null and be read as "leave
      // it alone", quietly making a deadline unremovable.
      dueDate: typeof values.dueDate === "string" ? values.dueDate : "",
    });
  }

  return (
    <EditView>
      <EditViewHeader />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="max-w-2xl"
        >
          <FormPanel>
            <FormField
              control={form.control}
              name="title"
              rules={{
                required: "Title is required",
                maxLength: { value: 255, message: "At most 255 characters" },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} rows={5} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-8 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? "todo"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Moving to Done stamps the completion time; moving away from
                      it clears the stamp.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? "medium"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <AssignmentPicker
              assignee={form.watch("assignee")}
              department={form.watch("department")}
              onAssigneeChange={(value) =>
                form.setValue("assignee", value, { shouldDirty: true })
              }
              onDepartmentChange={(value) =>
                form.setValue("department", value, { shouldDirty: true })
              }
              currentAssignee={task?.assignee}
              currentDepartment={task?.department}
            />

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due date</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="date"
                      value={field.value ?? ""}
                      className="w-fit"
                    />
                  </FormControl>
                  <FormDescription>
                    Clear the field to remove the deadline.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormActions>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Updating..." : "Update"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </FormActions>
          </FormPanel>
        </form>
      </Form>
    </EditView>
  );
};
