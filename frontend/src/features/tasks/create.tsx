import { useForm } from "@refinedev/react-hook-form";
import { useNavigate } from "react-router";

import {
  CreateView,
  CreateViewHeader,
} from "@/shared/components/views/create-view";
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
import {
  FormActions,
  FormPanel,
} from "@/shared/components/form/form-panel";
import {
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  type TaskPriority,
  type TaskStatus,
} from "@/domains/task/types";

/**
 * The create payload, which is `TaskRequest` on the backend rather than the
 * `TaskResponse` shape the rest of the resource speaks.
 *
 * No `completedAt` and no `createdBy`: the first is derived from the status by
 * the API and the second is stamped from the access token, so neither is
 * something this form gets to assert.
 */
type TaskFormValues = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: TaskRef;
  department: TaskRef;
  /**
   * Optional in the type as well as in the API, so that `onSubmit` can drop the
   * key entirely when the date input is empty rather than send `""` to a field
   * the backend parses as a real date.
   */
  dueDate?: string;
};

/**
 * Annotated rather than inferred, so `status` and `priority` widen to their
 * unions instead of being pinned to the literals the object starts with.
 */
const DEFAULT_VALUES: TaskFormValues = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  assignee: { id: null },
  department: { id: null },
  dueDate: "",
};

export const TaskCreate = () => {
  const navigate = useNavigate();

  const {
    refineCore: { onFinish },
    ...form
  } = useForm({
    refineCoreProps: {},
    defaultValues: DEFAULT_VALUES,
  });

  function onSubmit(values: TaskFormValues) {
    // `TaskRequest.dueDate` is a real `LocalDate` on the backend, unlike the
    // patch payload's string. An empty date input has to be dropped from the
    // request rather than sent as "", which is not a date and is not this
    // endpoint's way of saying "none" — there is nothing to clear on a task
    // that does not exist yet.
    const { dueDate, ...rest } = values;
    onFinish(dueDate ? { ...rest, dueDate } : rest);
  }

  return (
    <CreateView>
      <CreateViewHeader />
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
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="What needs doing"
                    />
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
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Any detail the person doing this will need"
                      rows={5}
                    />
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
              onAssigneeChange={(value) => form.setValue("assignee", value)}
              onDepartmentChange={(value) => form.setValue("department", value)}
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
                    Optional. A date rather than a time — a deadline is a day.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormActions>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Creating..." : "Create"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </FormActions>
          </FormPanel>
        </form>
      </Form>
    </CreateView>
  );
};
