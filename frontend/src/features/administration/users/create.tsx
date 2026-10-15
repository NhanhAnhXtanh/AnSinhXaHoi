import { useForm } from "@refinedev/react-hook-form";
import { useNavigate } from "react-router";

import {
  CreateView,
  CreateViewHeader,
} from "@/shared/components/views/create-view";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { InputPassword } from "@/shared/components/form/input-password";
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
import {
  FormSection,
  FormSectionActions,
  SectionedFormPanel,
} from "@/shared/components/form/form-section";
import { RolePicker, type RoleRef } from "./role-picker";
import { PlacementPicker, type PlacementRef } from "./placement-picker";
import { STATUS_OPTIONS, type UserStatus } from "@/domains/user/types";

/**
 * The create payload, which is `UserRequest` on the backend rather than the
 * `UserResponse` shape the rest of the resource speaks. Naming it keeps the
 * defaults below and the submit handler agreeing on one type.
 */
type UserFormValues = {
  username: string;
  email: string;
  fullName: string;
  password: string;
  status: UserStatus;
  roles: RoleRef[];
  organization: PlacementRef;
  department: PlacementRef;
};

/**
 * Annotated rather than inferred, so `status` widens to the union instead of
 * being pinned to the literal "active" the object happens to start with.
 */
const DEFAULT_VALUES: UserFormValues = {
  username: "",
  email: "",
  fullName: "",
  password: "",
  status: "active",
  roles: [],
  // `{ id: null }` rather than omitted: it is the shape the API reads as "no
  // placement", and it keeps the picker's value a stable object either way.
  organization: { id: null },
  department: { id: null },
};

/**
 * Creating an account.
 *
 * This is the only way a user comes into existence — there is no
 * self-registration — so the password is set here by whoever creates the
 * account and handed over out of band.
 *
 * The same three zones as the edit screen, in the same order and the same
 * column spans, with sign-in credentials as a fourth: making an account and
 * changing one should not be two different shapes, and the one real difference
 * between them — a password that is set once and never shown again — is the
 * thing that gets its own heading.
 */
export const UserCreate = () => {
  const navigate = useNavigate();

  const {
    refineCore: { onFinish },
    ...form
  } = useForm({
    refineCoreProps: {},
    defaultValues: DEFAULT_VALUES,
  });

  function onSubmit(values: UserFormValues) {
    onFinish(values);
  }

  return (
    <CreateView>
      <CreateViewHeader />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="min-w-0">
          <SectionedFormPanel>
            <FormSection
              title="Identity"
              description="Who this account belongs to, and what they sign in with."
            >
              <FormField
                control={form.control}
                name="username"
                rules={{
                  required: "Username is required",
                  minLength: { value: 3, message: "At least 3 characters" },
                  // Mirrors the pattern the API enforces, so the message
                  // arrives before the round trip rather than after it.
                  pattern: {
                    value: /^[a-zA-Z0-9._-]+$/,
                    message:
                      "Letters, digits, dots, underscores and hyphens only",
                  },
                }}
                render={({ field }) => (
                  <FormItem className="md:col-span-4">
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="jdoe"
                        className="font-mono"
                      />
                    </FormControl>
                    <FormDescription>
                      Used to sign in. Must be unique.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                rules={{
                  required: "Email is required",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Enter a valid email address",
                  },
                }}
                render={({ field }) => (
                  <FormItem className="md:col-span-4">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        value={field.value ?? ""}
                        placeholder="jdoe@example.com"
                      />
                    </FormControl>
                    <FormDescription>
                      Also accepted in place of the username when signing in.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fullName"
                rules={{ required: "Full name is required" }}
                render={({ field }) => (
                  <FormItem className="md:col-span-4">
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Jane Doe"
                      />
                    </FormControl>
                    <FormDescription>
                      What people see in the UI.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>

            <FormSection
              title="Sign-in"
              description="Set once, here. There is no self-registration and no password reset by email."
            >
              <FormField
                control={form.control}
                name="password"
                rules={{
                  required: "Password is required",
                  minLength: { value: 8, message: "At least 8 characters" },
                }}
                render={({ field }) => (
                  <FormItem className="md:col-span-4">
                    <FormLabel>Initial password</FormLabel>
                    <FormControl>
                      <InputPassword
                        {...field}
                        value={field.value ?? ""}
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                      />
                    </FormControl>
                    <FormDescription>
                      Hashed before it is stored and never shown again. Share it
                      with the account holder and ask them to change it.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>

            <FormSection
              title="Placement and status"
              description="Where the account sits in the company, and whether it may sign in at all."
            >
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem className="md:col-span-4">
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? "active"}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
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
                      Only an active account can sign in.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/*
                Two fields, one control: the department list is filtered by the
                organization chosen beside it, and changing the organization
                clears the department. See `placement-picker.tsx` for why the
                API leaves no room for them to disagree.

                `contents` puts both on this section's own grid rather than in a
                column of their own.
              */}
              <PlacementPicker
                className="contents"
                itemClassName="md:col-span-4"
                organization={form.watch("organization")}
                department={form.watch("department")}
                onOrganizationChange={(value) =>
                  form.setValue("organization", value)
                }
                onDepartmentChange={(value) =>
                  form.setValue("department", value)
                }
              />
            </FormSection>

            <FormSection
              title="Roles"
              description="What the account may do. An account with none can sign in and see nothing."
            >
              <FormField
                control={form.control}
                name="roles"
                rules={{
                  validate: (value) =>
                    (Array.isArray(value) && value.length > 0) ||
                    "Select at least one role",
                }}
                render={({ field }) => (
                  <FormItem className="md:col-span-12">
                    <FormControl>
                      <RolePicker
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>

            <FormSectionActions>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Creating..." : "Create"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
              >
                Cancel
              </Button>
            </FormSectionActions>
          </SectionedFormPanel>
        </form>
      </Form>
    </CreateView>
  );
};
