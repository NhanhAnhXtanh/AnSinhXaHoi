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
import { STATUS_OPTIONS, type OrganizationStatus } from "@/domains/organization/types";
import {
  FormActions,
  FormPanel,
} from "@/shared/components/form/form-panel";

/**
 * The create payload, which is `OrganizationRequest` on the backend rather than
 * the `OrganizationResponse` shape the rest of the resource speaks. Naming it
 * keeps the defaults below and the submit handler agreeing on one type.
 */
type OrganizationFormValues = {
  code: string;
  name: string;
  description: string;
  email: string;
  phone: string;
  address: string;
  status: OrganizationStatus;
};

/**
 * Annotated rather than inferred, so `status` widens to the union instead of
 * being pinned to the literal "active" the object happens to start with.
 */
const DEFAULT_VALUES: OrganizationFormValues = {
  code: "",
  name: "",
  description: "",
  email: "",
  phone: "",
  address: "",
  status: "active",
};

export const OrganizationCreate = () => {
  const navigate = useNavigate();

  const {
    refineCore: { onFinish },
    ...form
  } = useForm({
    refineCoreProps: {},
    defaultValues: DEFAULT_VALUES,
  });

  function onSubmit(values: OrganizationFormValues) {
    onFinish(values);
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
              name="code"
              rules={{
                required: "Code is required",
                maxLength: { value: 64, message: "At most 64 characters" },
                // Mirrors the pattern the API enforces, so the message arrives
                // before the round trip rather than after it.
                pattern: {
                  value: /^[A-Za-z0-9._-]+$/,
                  message: "Letters, digits, dots, underscores and hyphens only",
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="HQ" />
                  </FormControl>
                  <FormDescription>
                    The short handle people quote. Must be unique.
                  </FormDescription>
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
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Acme Holdings"
                    />
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
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      placeholder="What this organization is"
                      rows={3}
                    />
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
                      <Input
                        {...field}
                        type="email"
                        value={field.value ?? ""}
                        placeholder="contact@acme.com"
                      />
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
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="+84 24 3900 0000"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              rules={{
                maxLength: { value: 500, message: "At most 500 characters" },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Street, city, country"
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                  <FormDescription>
                    Inactive keeps the record and its departments, but marks the
                    organization as retired.
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
