"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Save, User } from "lucide-react";
import { changePassword, fetchMe, updateMe } from "@/lib/fetchers";
import { queryKeys } from "@/lib/queries";
import { useAuthStore } from "@/lib/store";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const profileSchema = z.object({
  displayName: z.string().min(1, "Name is required").max(80),
  timezone: z.string().min(1),
  weekStart: z.union([z.literal(1), z.literal(7)]),
});
type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "At least 8 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type PasswordValues = z.infer<typeof passwordSchema>;

const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { user: storeUser, setUser } = useAuthStore();

  const { data: user, isLoading } = useQuery({
    queryKey: queryKeys.me(),
    queryFn: fetchMe,
  });

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: "", timezone: "UTC", weekStart: 1 },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  React.useEffect(() => {
    if (user) {
      profileForm.reset({
        displayName: user.displayName,
        timezone: user.timezone,
        weekStart: user.weekStart,
      });
    }
  }, [user, profileForm]);

  const profileMutation = useMutation({
    mutationFn: (values: ProfileValues) => updateMe(values),
    onSuccess: (updated) => {
      setUser(updated);
      toast.success("Profile saved");
      queryClient.invalidateQueries({ queryKey: queryKeys.me() });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not save the profile."),
  });

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordValues) =>
      changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    onSuccess: () => {
      toast.success("Password changed");
      passwordForm.reset();
      queryClient.invalidateQueries({ queryKey: queryKeys.me() });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not change the password."),
  });

  const shown = user ?? storeUser;

  return (
    <div>
      <PageHeader title="Settings" description="Profile, preferences and security." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Form {...profileForm}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User size={15} /> Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={profileForm.handleSubmit((v) => profileMutation.mutate(v))}
                className="space-y-4"
              >
                <FormField
                  control={profileForm.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Your name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <FormControl>
                        <Select {...field}>
                          {TIMEZONES.map((tz) => (
                            <option key={tz} value={tz}>
                              {tz}
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="weekStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Week starts on</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value) as 1 | 7)
                          }
                        >
                          <option value={1}>Monday</option>
                          <option value={7}>Sunday</option>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={profileMutation.isPending}>
                    <Save size={14} />
                    {profileMutation.isPending ? "Saving…" : "Save profile"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </Form>

        <div className="space-y-4">
          <Form {...passwordForm}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound size={15} /> Change password
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={passwordForm.handleSubmit((v) => passwordMutation.mutate(v))}
                  className="space-y-4"
                >
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} autoComplete="current-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} autoComplete="new-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm new password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} autoComplete="new-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={passwordMutation.isPending}
                      onClick={() => passwordForm.handleSubmit((v) => passwordMutation.mutate(v))()}
                    >
                      {passwordMutation.isPending ? "Changing…" : "Change password"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </Form>

          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{shown?.email ?? "–"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Member since</span>
                <span className="font-medium">
                  {shown ? formatDate(shown.createdAt) : "–"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
