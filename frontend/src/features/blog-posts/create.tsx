import { useMemo } from "react";
import { useCan, useResourceParams, useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";

import { RouteDialog } from "@/shared/components/views/route-dialog";
import { Button } from "@/shared/ui/button";
import { DialogClose } from "@/shared/ui/dialog";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";

// The submit button sits in the dialog footer, outside the `<form>` element,
// so it is wired back to the form with the HTML `form` attribute.
const FORM_ID = "blog-post-create-form";

export const BlogPostCreate = () => {
  // Same component serves `/blog-posts/create` and `/blog-posts/clone/:id`;
  // `useForm` picks the action up from the route, only the wording differs.
  const { action } = useResourceParams();
  const isClone = action === "clone";

  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    refineCoreProps: {},
  });

  // Only ever set on the clone route: a plain create has no record behind it.
  const recordCategory = query?.data?.data?.category as
    | { id: number | string; title: string }
    | undefined;

  // Reading categories is a separate grant from writing blog posts, so the
  // lookup is gated rather than left to fail with a toast over the form.
  const { data: canReadCategories } = useCan({
    resource: "categories",
    action: "list",
  });

  const { options: categoryOptions } = useSelect({
    resource: "categories",
    queryOptions: {
      enabled: canReadCategories?.can ?? false,
    },
  });

  /**
   * The cloned record's own category, merged in rather than waited for.
   *
   * `Select` matches its `value` against the items mounted at that moment and
   * does not re-run the match when items arrive later, so on the clone route
   * the category has to be an option no later than the render that fills the
   * form from the record. The list query races that, and losing the race leaves
   * the trigger showing its placeholder over a value that is really set.
   *
   * A no-op on `/blog-posts/create`, which has no record. Same reasoning as the
   * edit form, which hit this for real.
   */
  const options = useMemo(() => {
    const list = categoryOptions ?? [];
    if (!recordCategory?.id) return list;

    return list.some((o) => String(o.value) === String(recordCategory.id))
      ? list
      : [{ label: recordCategory.title, value: recordCategory.id }, ...list];
  }, [categoryOptions, recordCategory?.id, recordCategory?.title]);

  function onSubmit(values: Record<string, string>) {
    onFinish(values);
  }

  return (
    <RouteDialog
      title={isClone ? "Clone blog post" : "Create blog post"}
      description={
        isClone
          ? "Start from a copy of an existing post. The original is left untouched."
          : "Fill in the fields below to add a new blog post."
      }
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="submit"
            form={FORM_ID}
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Creating..." : "Create"}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id={FORM_ID}
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
        >
          <FormField
            control={form.control}
            name="title"
            rules={{ required: "Title is required" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || ""}
                    placeholder="Enter title"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="content"
            rules={{ required: "Content is required" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Content</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value || ""}
                    placeholder="Enter content"
                    rows={8}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={"category.id"}
            rules={{ required: "Category is required" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                {/*
                  Category ids are numbers on the wire but `Select` compares
                  values as strings, so both sides are stringified here. The API
                  reads the id back out of the string it receives.
                */}
                <Select
                  onValueChange={field.onChange}
                  value={field.value ? String(field.value) : ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
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
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            defaultValue="draft"
            rules={{ required: "Status is required" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </RouteDialog>
  );
};
