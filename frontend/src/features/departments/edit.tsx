import { useEffect, useMemo } from "react";
import { useCan, useSelect } from "@refinedev/core";
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
import type { Department } from "@/domains/department/types";
import { STATUS_OPTIONS } from "@/domains/department/types";
import {
  FormActions,
  FormPanel,
} from "@/shared/components/form/form-panel";

export const DepartmentEdit = () => {
  const navigate = useNavigate();

  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    refineCoreProps: {},
  });

  const department = query?.data?.data as Department | undefined;
  const recordOrganization = department?.organization;

  /**
   * Fill the form from the record, in one go.
   *
   * `@refinedev/react-hook-form` does not `reset` — it walks the fields it
   * believes are registered and `setValue`s them one at a time, from a
   * `queueMicrotask` scheduled in an effect, marking each path as done so it is
   * never revisited. A field that is not registered at that instant is simply
   * missed, and nothing comes back for it. How often that instant is the wrong
   * one depends on when the record arrives: cold, it is long after the fields
   * mount; from a react-query cache hit, it is on the very first render, while
   * the form is still assembling itself.
   *
   * `reset` sidesteps the question entirely — the record becomes the form's
   * values, so a field picks its value up whenever it mounts. `keepDirtyValues`
   * is what stops the background refetch that follows a cache hit from throwing
   * away whatever has been typed since. Same reasoning as the blog post edit
   * dialog, which hit this for real.
   */
  const { reset } = form;
  useEffect(() => {
    if (!department) return;
    reset(department, { keepDirtyValues: true });
  }, [department, reset]);

  // Reading organizations is a separate grant from reading departments, so a
  // role can hold one without the other. Asking anyway spends a request on a
  // guaranteed 403 and raises an error toast over the form — and the current
  // value still renders, because it comes from the record below rather than
  // from this list.
  const { data: canReadOrganizations } = useCan({
    resource: "organizations",
    action: "list",
  });
  const mayReadOrganizations = canReadOrganizations?.can ?? false;

  const { options: organizationOptions, query: organizationQuery } = useSelect({
    resource: "organizations",
    optionLabel: "name",
    optionValue: "id",
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { enabled: mayReadOrganizations },
  });

  /**
   * The record's own organization, merged in rather than waited for.
   *
   * `Select` matches its `value` against the items mounted at that moment and
   * does not re-run the match when items arrive later, so the organization has
   * to be an option no later than the render that fills the form from the
   * record. The list query races that, and losing the race leaves the trigger
   * showing its placeholder over a value that is really set — and with the list
   * refused outright, it would never render at all.
   */
  const options = useMemo(() => {
    const list = organizationOptions ?? [];
    if (!recordOrganization?.id) return list;

    return list.some((o) => String(o.value) === String(recordOrganization.id))
      ? list
      : [
          { label: recordOrganization.name, value: recordOrganization.id },
          ...list,
        ];
  }, [organizationOptions, recordOrganization?.id, recordOrganization?.name]);

  function onSubmit(values: Record<string, unknown>) {
    onFinish(values);
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
              name="organization.id"
              rules={{ required: "Organization is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ? String(field.value) : ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            organizationQuery.isLoading
                              ? "Loading..."
                              : "Select an organization"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {options.map((option) => (
                        <SelectItem
                          key={String(option.value)}
                          value={String(option.value)}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Moving a department re-checks its code against the destination:
                    a code only has to be unique within one organization.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              rules={{
                required: "Code is required",
                maxLength: { value: 64, message: "At most 64 characters" },
                pattern: {
                  value: /^[A-Za-z0-9._-]+$/,
                  message: "Letters, digits, dots, underscores and hyphens only",
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              rules={{
                required: "Name is required",
                maxLength: { value: 255, message: "At most 255 characters" },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
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
              rules={{
                maxLength: { value: 500, message: "At most 500 characters" },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-8 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                rules={{
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Enter a valid email address",
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                rules={{
                  maxLength: { value: 64, message: "At most 64 characters" },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? "active"}
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
