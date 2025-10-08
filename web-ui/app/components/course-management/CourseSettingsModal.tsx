"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../ui/tabs';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import LogoUploader from '../ui/LogoUploader';
import SectionManager from './SectionManager';
import { useCourse } from '../../context/CourseContext';
import { toast } from 'sonner';

const courseFormSchema = z.object({
  courseName: z.string().min(1, 'Course name is required'),
  professorName: z.string().min(1, 'Professor name is required'),
  officeHours: z.string().optional(),
  news: z.string().optional(),
  totalStudents: z.number().int().min(0, 'Must be 0 or greater').optional(),
  logoPath: z.string().optional(),
  sections: z.array(z.string()).min(1, 'At least one section is required'),
  sectionNumber: z.string().min(1, 'Active section is required'),
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
  const { state, saveOrUpdateCourse, dispatch } = useCourse();
  const [activeTab, setActiveTab] = useState('basic');
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      courseName: state.courseName,
      professorName: state.professorName,
      officeHours: state.officeHours,
      news: state.news,
      totalStudents: state.totalStudents,
      logoPath: state.logoPath,
      sections: state.sections.length > 0 ? state.sections : ['000'],
      sectionNumber: state.sectionNumber || '000',
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
        sections: state.sections.length > 0 ? state.sections : ['000'],
        sectionNumber: state.sectionNumber || '000',
      });
    }
  }, [open, state, form]);

  // Helper function to immediately update context and persist
  const updateContextAndSave = async (updates: Partial<CourseFormValues>) => {
    // Update form state
    Object.entries(updates).forEach(([key, value]) => {
      form.setValue(key as keyof CourseFormValues, value, { shouldDirty: true });
    });

    // Update context state immediately
    if (updates.courseName !== undefined) {
      dispatch({ type: 'SET_COURSE_NAME', payload: updates.courseName });
    }
    if (updates.professorName !== undefined) {
      dispatch({ type: 'SET_PROFESSOR_NAME', payload: updates.professorName });
    }
    if (updates.officeHours !== undefined) {
      dispatch({ type: 'SET_OFFICE_HOURS', payload: updates.officeHours });
    }
    if (updates.news !== undefined) {
      dispatch({ type: 'SET_NEWS', payload: updates.news });
    }
    if (updates.totalStudents !== undefined) {
      dispatch({ type: 'SET_TOTAL_STUDENTS', payload: updates.totalStudents });
    }
    if (updates.logoPath !== undefined) {
      dispatch({ type: 'SET_LOGO_PATH', payload: updates.logoPath });
    }
    if (updates.sections !== undefined) {
      dispatch({ type: 'SET_SECTIONS', payload: updates.sections });
    }
    if (updates.sectionNumber !== undefined) {
      dispatch({ type: 'SET_SECTION_NUMBER', payload: updates.sectionNumber });
    }

    // Persist to backend and localStorage
    try {
      await saveOrUpdateCourse();
    } catch (error) {
      console.error('Failed to save changes:', error);
      throw error;
    }
  };

  const onSubmit = async (data: CourseFormValues) => {
    setIsSaving(true);

    try {
      // Update context state with form data
      dispatch({ type: 'SET_COURSE_NAME', payload: data.courseName });
      dispatch({ type: 'SET_PROFESSOR_NAME', payload: data.professorName });
      dispatch({ type: 'SET_OFFICE_HOURS', payload: data.officeHours || '' });
      dispatch({ type: 'SET_NEWS', payload: data.news || '' });
      dispatch({ type: 'SET_TOTAL_STUDENTS', payload: data.totalStudents || 0 });
      dispatch({ type: 'SET_LOGO_PATH', payload: data.logoPath || '/university-logo.png' });
      dispatch({ type: 'SET_SECTIONS', payload: data.sections });
      dispatch({ type: 'SET_SECTION_NUMBER', payload: data.sectionNumber });

      // Save to backend
      await saveOrUpdateCourse();

      toast.success(`Course "${data.courseName}" saved successfully`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save course');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (form.formState.isDirty) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        form.reset();
        onOpenChange(false);
      }
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Course Settings</DialogTitle>
          <DialogDescription>
            Manage your course information, sections, schedule, and branding.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="sections">Sections</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
                <TabsTrigger value="branding">Branding</TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="courseName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Introduction to Computer Science" {...field} />
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
                        Instructor&apos;s name as it should appear on the dashboard
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
              <TabsContent value="sections" className="space-y-4 mt-4">
                <SectionManager
                  sections={form.watch('sections')}
                  currentSection={form.watch('sectionNumber')}
                  onSectionsChange={async (sections) => {
                    try {
                      await updateContextAndSave({ sections });
                      toast.success('Sections updated');
                    } catch {
                      toast.error('Failed to update sections');
                    }
                  }}
                  onCurrentSectionChange={async (section) => {
                    try {
                      await updateContextAndSave({ sectionNumber: section });
                      toast.success(`Active section changed to ${section}`);
                    } catch {
                      toast.error('Failed to change active section');
                    }
                  }}
                />
              </TabsContent>

              {/* Schedule Tab */}
              <TabsContent value="schedule" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="officeHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Office Hours</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., MWF 2:00-3:00 PM" {...field} />
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
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
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
              <TabsContent value="branding" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="logoPath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course Logo</FormLabel>
                      <FormControl>
                        <LogoUploader
                          isCustomizing={true}
                          defaultLogoPath={field.value || '/university-logo.png'}
                          onLogoChange={async (path) => {
                            try {
                              // Add cache buster to force browser to reload the image
                              const cacheBustedPath = `${path}?v=${Date.now()}`;
                              await updateContextAndSave({ logoPath: cacheBustedPath });
                              toast.success('Logo updated successfully');
                            } catch {
                              toast.error('Failed to save logo change');
                            }
                          }}
                          courseId={state.courseId}
                        />
                      </FormControl>
                      <FormDescription>
                        Upload a logo that represents your course or institution
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
