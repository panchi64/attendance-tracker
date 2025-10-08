"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import LogoUploader from "../ui/LogoUploader";
import SectionManager from "./SectionManager";
import { useCourse } from "../../context/CourseContext";
import { saveCoursePreferences } from "../../services/preferencesService";
import { toast } from "sonner";

const courseFormSchema = z.object({
  courseName: z.string().min(1, "Course name is required"),
  professorName: z.string().min(1, "Professor name is required"),
  officeHours: z.string().optional(),
  news: z.string().optional(),
  totalStudents: z.number().int().min(0, "Must be 0 or greater").optional(),
  logoPath: z.string().optional(),
  sections: z.array(z.string()).min(1, "At least one section is required"),
  sectionNumber: z.string().min(1, "Active section is required"),
});

type CourseFormValues = z.infer<typeof courseFormSchema>;

interface CourseSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CourseSettingsModal({
  open,
  onOpenChange,
}: CourseSettingsModalProps) {
  const { state, dispatch } = useCourse();
  const [activeTab, setActiveTab] = useState("basic");
  const [savingField, setSavingField] = useState<string | null>(null);
  const [lastSavedField, setLastSavedField] = useState<string | null>(null);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      courseName: state.courseName,
      professorName: state.professorName,
      officeHours: state.officeHours,
      news: state.news,
      totalStudents: state.totalStudents,
      logoPath: state.logoPath,
      sections: state.sections.length > 0 ? state.sections : ["000"],
      sectionNumber: state.sectionNumber || "000",
    },
  });

  // Reset form when modal opens or state changes
  useEffect(() => {
    if (open) {
      form.reset({
        courseName: state.courseName,
        professorName: state.professorName,
        officeHours: state.officeHours,
        news: state.news,
        totalStudents: state.totalStudents,
        logoPath: state.logoPath,
        sections: state.sections.length > 0 ? state.sections : ["000"],
        sectionNumber: state.sectionNumber || "000",
      });
    }
  }, [open, state, form]);

  // Helper function to immediately update context and persist
  const updateContextAndSave = useCallback(
    async (updates: Partial<CourseFormValues>, fieldName?: string) => {
      // Update form state
      Object.entries(updates).forEach(([key, value]) => {
        form.setValue(key as keyof CourseFormValues, value, {
          shouldDirty: true,
        });
      });

      // Build the updated course preferences by merging current state with updates
      const updatedCoursePrefs = {
        id: state.courseId,
        courseName:
          updates.courseName !== undefined
            ? updates.courseName
            : state.courseName,
        sectionNumber:
          updates.sectionNumber !== undefined
            ? updates.sectionNumber
            : state.sectionNumber,
        sections:
          updates.sections !== undefined ? updates.sections : state.sections,
        professorName:
          updates.professorName !== undefined
            ? updates.professorName
            : state.professorName,
        officeHours:
          updates.officeHours !== undefined
            ? updates.officeHours
            : state.officeHours,
        news: updates.news !== undefined ? updates.news : state.news,
        totalStudents:
          updates.totalStudents !== undefined
            ? updates.totalStudents
            : state.totalStudents,
        logoPath:
          updates.logoPath !== undefined ? updates.logoPath : state.logoPath,
      };

      // Update context state immediately with the same values
      if (updates.courseName !== undefined) {
        dispatch({ type: "SET_COURSE_NAME", payload: updates.courseName });
      }
      if (updates.professorName !== undefined) {
        dispatch({
          type: "SET_PROFESSOR_NAME",
          payload: updates.professorName,
        });
      }
      if (updates.officeHours !== undefined) {
        dispatch({ type: "SET_OFFICE_HOURS", payload: updates.officeHours });
      }
      if (updates.news !== undefined) {
        dispatch({ type: "SET_NEWS", payload: updates.news });
      }
      if (updates.totalStudents !== undefined) {
        dispatch({
          type: "SET_TOTAL_STUDENTS",
          payload: updates.totalStudents,
        });
      }
      if (updates.logoPath !== undefined) {
        dispatch({ type: "SET_LOGO_PATH", payload: updates.logoPath });
      }
      if (updates.sections !== undefined) {
        dispatch({ type: "SET_SECTIONS", payload: updates.sections });
      }
      if (updates.sectionNumber !== undefined) {
        dispatch({
          type: "SET_SECTION_NUMBER",
          payload: updates.sectionNumber,
        });
      }

      // Set saving state
      if (fieldName) {
        setSavingField(fieldName);
      }

      // Persist to backend and localStorage using the updated prefs we just calculated
      try {
        const savedCourse = await saveCoursePreferences(updatedCoursePrefs);

        // Update context with the saved course from backend
        dispatch({ type: "INITIALIZE_PREFERENCES", payload: savedCourse });

        // Show success briefly
        if (fieldName) {
          setLastSavedField(fieldName);
          setTimeout(() => setLastSavedField(null), 2000);
        }
      } catch (error) {
        console.error("Failed to save changes:", error);
        throw error;
      } finally {
        if (fieldName) {
          setSavingField(null);
        }
      }
    },
    [form, dispatch, state],
  );

  // Watch form values
  const courseName = form.watch("courseName");
  const professorName = form.watch("professorName");
  const news = form.watch("news");
  const officeHours = form.watch("officeHours");
  const totalStudents = form.watch("totalStudents");

  // Debounced autosave for courseName
  useEffect(() => {
    if (!open || !courseName || courseName === state.courseName) return;

    const timeoutId = setTimeout(async () => {
      try {
        await updateContextAndSave({ courseName }, "courseName");
      } catch {
        toast.error("Failed to save course name");
      }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [courseName, open, state.courseName, updateContextAndSave]);

  // Debounced autosave for professorName
  useEffect(() => {
    if (!open || !professorName || professorName === state.professorName)
      return;

    const timeoutId = setTimeout(async () => {
      try {
        await updateContextAndSave({ professorName }, "professorName");
      } catch {
        toast.error("Failed to save professor name");
      }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [professorName, open, state.professorName, updateContextAndSave]);

  // Debounced autosave for news
  useEffect(() => {
    if (!open || news === state.news) return;

    const timeoutId = setTimeout(async () => {
      try {
        await updateContextAndSave({ news }, "news");
      } catch {
        toast.error("Failed to save news");
      }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [news, open, state.news, updateContextAndSave]);

  // Debounced autosave for officeHours
  useEffect(() => {
    if (!open || officeHours === state.officeHours) return;

    const timeoutId = setTimeout(async () => {
      try {
        await updateContextAndSave({ officeHours }, "officeHours");
      } catch {
        toast.error("Failed to save office hours");
      }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [officeHours, open, state.officeHours, updateContextAndSave]);

  // Debounced autosave for totalStudents
  useEffect(() => {
    if (!open || totalStudents === state.totalStudents) return;

    const timeoutId = setTimeout(async () => {
      try {
        await updateContextAndSave({ totalStudents }, "totalStudents");
      } catch {
        toast.error("Failed to save total students");
      }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [totalStudents, open, state.totalStudents, updateContextAndSave]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Course Settings</DialogTitle>
          <DialogDescription className="flex items-center justify-between">
            <span>
              Manage your course information, sections, schedule, and branding.
            </span>
            {savingField && (
              <span className="text-xs text-muted-foreground ml-2">
                Saving...
              </span>
            )}
            {!savingField && lastSavedField && (
              <span className="text-xs text-green-600 ml-2">Saved ✓</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <div className="flex-1 overflow-y-auto space-y-6">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full h-full flex flex-col"
            >
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="sections">Sections</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
                <TabsTrigger value="branding">Branding</TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent
                value="basic"
                className="space-y-4 mt-4 flex-1 overflow-y-auto"
              >
                <FormField
                  control={form.control}
                  name="courseName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Introduction to Computer Science"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The full name of the course
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="professorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Professor Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Dr. Jane Smith" {...field} />
                      </FormControl>
                      <FormDescription>
                        Instructor&apos;s name as it should appear on the
                        dashboard
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="news"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>News / Announcements</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter any news or announcements for students..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Displayed on the main dashboard for students to see
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Sections Tab */}
              <TabsContent
                value="sections"
                className="space-y-4 mt-4 flex-1 overflow-y-auto"
              >
                <SectionManager
                  sections={form.watch("sections")}
                  currentSection={form.watch("sectionNumber")}
                  onSectionsChange={async (sections) => {
                    try {
                      await updateContextAndSave({ sections });
                      toast.success("Sections updated");
                    } catch {
                      toast.error("Failed to update sections");
                    }
                  }}
                  onCurrentSectionChange={async (section) => {
                    try {
                      await updateContextAndSave({ sectionNumber: section });
                      toast.success(`Active section changed to ${section}`);
                    } catch {
                      toast.error("Failed to change active section");
                    }
                  }}
                />
              </TabsContent>

              {/* Schedule Tab */}
              <TabsContent
                value="schedule"
                className="space-y-4 mt-4 flex-1 overflow-y-auto"
              >
                <FormField
                  control={form.control}
                  name="officeHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Office Hours</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., MWF 2:00-3:00 PM"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        When students can reach you for help
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="totalStudents"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Students</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="e.g., 30"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Expected number of students in the course
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Branding Tab */}
              <TabsContent
                value="branding"
                className="space-y-4 mt-4 flex-1 overflow-y-auto px-1"
              >
                <FormField
                  control={form.control}
                  name="logoPath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>University Logo</FormLabel>
                      <FormControl>
                        <LogoUploader
                          isCustomizing={true}
                          defaultLogoPath={
                            field.value || "/university-logo.png"
                          }
                          onLogoChange={async (path) => {
                            try {
                              // Add cache buster to force browser to reload the image
                              const cacheBustedPath = `${path}?v=${Date.now()}`;
                              await updateContextAndSave({
                                logoPath: cacheBustedPath,
                              });
                              toast.success(
                                "University logo updated successfully",
                              );
                            } catch {
                              toast.error(
                                "Failed to save university logo change",
                              );
                            }
                          }}
                          courseId={state.courseId}
                        />
                      </FormControl>
                      <FormDescription>
                        Upload your university or institution logo (replaces the
                        previous logo)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
