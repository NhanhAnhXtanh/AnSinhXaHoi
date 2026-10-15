import { useEffect, useMemo } from "react";
import { useCan, useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
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
const FORM_ID = "blog-post-edit-form";

export const BlogPostEdit = () => {
  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    refineCoreProps: {},
  });

  const blogPostsData = query?.data?.data;
  const recordCategory = blogPostsData?.category as
    | { id: number | string; title: string }
    | undefined;

  /**
   * Fill the form from the record, in one go.
   *
   * `@refinedev/react-hook-form` does not `reset` — it walks the fields it
   * believes are registered and `setValue`s them one at a time, from a
   * `queueMicrotask` scheduled in an effect, marking each path as done so it is
   * never revisited. A field that is not registered at that instant is simply
   * missed, and nothing comes back for it.
   *
   * How often that instant is the wrong one depends on when the record arrives.
   * Opening `/blog-posts/edit/:id` cold, it arrives long after the fields have
   * mounted. Arriving from the show dialog it is already in the react-query
   * cache, so it is there on the very first render and the pass runs against a
   * form that is still assembling itself — which is why the same screen filled
   * in correctly one way round and left a field empty the other.
   *
   * `reset` sidesteps the whole question: it writes the record into the form's
   * values wholesale, so a field picks its value up whenever it mounts rather
   * than having to be present at one particular moment. `keepDirtyValues` is
   * what stops the background refetch that follows a cache hit from throwing
   * away whatever the user has typed since.
   */
  const { reset } = form;
  useEffect(() => {
    if (!blogPostsData) return;
    reset(blogPostsData, { keepDirtyValues: true });
  }, [blogPostsData, reset]);

  // Reading categories is a separate grant from reading blog posts, so a role
  // can hold one without the other. Asking anyway spends a request on a
  // guaranteed 403 and raises an error toast over the form — and the current
  // value still renders, because it comes from the record below rather than
  // from this list.
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
   * The record's own category, merged in rather than fetched.
   *
   * `Select` matches its `value` against the items mounted at that moment; it
   * does not re-run the match when items arrive later. So the category had to
   * be an option no later than the render that set the value — and it was not:
   * the list query used to be gated behind the loaded record, which serialised
   * the two and guaranteed the value landed first. The trigger came up empty,
   * and only a second open looked right, off a warm react-query cache.
   *
   * `defaultValue` was the old answer, and it fetched by id the one category
   * already sitting in the record that had just been loaded. Taking it from the
   * record instead removes the request, removes the ordering entirely — value
   * and option now derive from the same object — and keeps a category outside
   * the first page selectable, which is what `defaultValue` was there for.
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
      title="Edit blog post"
      description={
        blogPostsData?.title
          ? `Update "${blogPostsData.title}".`
          : "Update the fields below and save your changes."
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
            disabled={form.formState.isSubmitting || query?.isLoading}
          >
            {form.formState.isSubmitting ? "Updating..." : "Update"}
          </Button>
        </>
      }
    >
      <LoadingOverlay loading={!!query?.isLoading}>
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
                    values as strings, so both sides are stringified here — the
                    loaded record's id included, or the record's own category
                    would not show up as the selected one.
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
              rules={{ required: "Status is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
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
      </LoadingOverlay>
    </RouteDialog>
  );
};
