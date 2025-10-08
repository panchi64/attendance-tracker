"use client";

import { useState } from 'react';
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
import { Badge } from '../ui/badge';
import LogoUploader from '../ui/LogoUploader';
import SectionManager from './SectionManager';
import { useCourse } from '../../context/CourseContext';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';

const courseCreationSchema = z.object({
  courseName: z.string().min(1, 'Course name is required'),
  professorName: z.string().min(1, 'Professor name is required'),
  officeHours: z.string().optional(),
  news: z.string().optional(),
  totalStudents: z.number().int().min(0, 'Must be 0 or greater').optional(),
  logoPath: z.string().optional(),
  sections: z.array(z.string()).min(1, 'At least one section is required'),
  sectionNumber: z.string().min(1, 'Active section is required'),
});

type CourseCreationValues = z.infer<typeof courseCreationSchema>;

interface CourseCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  { id: 1, name: 'Basic Info', description: 'Course name and professor' },
  { id: 2, name: 'Sections', description: 'Manage course sections' },
  { id: 3, name: 'Schedule', description: 'Office hours and capacity' },
  { id: 4, name: 'Branding', description: 'Logo and announcements' },
  { id: 5, name: 'Review', description: 'Review and create' },
];

export default function CourseCreationWizard({
  open,
  onOpenChange,
}: CourseCreationWizardProps) {
  const { createNewCourseAndSwitch } = useCourse();
  const [currentStep, setCurrentStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);

  const form = useForm<CourseCreationValues>({
    resolver: zodResolver(courseCreationSchema),
    defaultValues: {
      courseName: '',
      professorName: '',
      officeHours: '',
      news: '',
      totalStudents: 0,
      logoPath: '/university-logo.png',
      sections: ['000'],
      sectionNumber: '000',
    },
  });

  const onSubmit = async (data: CourseCreationValues) => {
    setIsCreating(true);

    try {
      // Create the course via context with all form data
      await createNewCourseAndSwitch(data.courseName, {
        professorName: data.professorName,
        officeHours: data.officeHours || '',
        news: data.news || '',
        totalStudents: data.totalStudents || 0,
        logoPath: data.logoPath || '/university-logo.png',
        sections: data.sections,
        sectionNumber: data.sectionNumber,
      });

      toast.success(`Course "${data.courseName}" created successfully!`);
      form.reset();
      setCurrentStep(1);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create course');
    } finally {
      setIsCreating(false);
    }
  };

  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 1:
        return await form.trigger(['courseName', 'professorName']);
      case 2:
        return await form.trigger(['sections', 'sectionNumber']);
      case 3:
        return await form.trigger(['officeHours', 'totalStudents']);
      case 4:
        return await form.trigger(['logoPath', 'news']);
      default:
        return true;
    }
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleClose = () => {
    if (form.formState.isDirty) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        form.reset();
        setCurrentStep(1);
        onOpenChange(false);
      }
    } else {
      form.reset();
      setCurrentStep(1);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Course</DialogTitle>
          <DialogDescription>
            Follow the steps to set up your new course
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6 px-2">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold mb-1 transition-colors
                    ${currentStep >= step.id ? 'bg-primary text-primary-foreground' : 'bg-gray-200 text-gray-500'}
                  `}
                >
                  {currentStep > step.id ? <Check className="h-5 w-5" /> : step.id}
                </div>
                <div className="text-xs text-center">
                  <div className="font-medium">{step.name}</div>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 ${currentStep > step.id ? 'bg-primary' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div className="space-y-4">
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
              </div>
            )}

            {/* Step 2: Sections */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <SectionManager
                  sections={form.watch('sections')}
                  currentSection={form.watch('sectionNumber')}
                  onSectionsChange={(sections) => form.setValue('sections', sections, { shouldDirty: true, shouldValidate: true })}
                  onCurrentSectionChange={(section) => form.setValue('sectionNumber', section, { shouldDirty: true, shouldValidate: true })}
                />
              </div>
            )}

            {/* Step 3: Schedule */}
            {currentStep === 3 && (
              <div className="space-y-4">
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
              </div>
            )}

            {/* Step 4: Branding */}
            {currentStep === 4 && (
              <div className="space-y-4">
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
                          onLogoChange={(path) => field.onChange(path)}
                          courseId={null}
                        />
                      </FormControl>
                      <FormDescription>
                        Upload a logo that represents your course or institution
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
                      <FormLabel>Initial Announcements</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter any initial announcements for students..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        You can always update this later
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 5: Review */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Review Your Course</h3>

                <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium">Course Name:</span> {form.watch('courseName')}
                  </div>
                  <div>
                    <span className="font-medium">Professor:</span> {form.watch('professorName')}
                  </div>
                  <div>
                    <span className="font-medium">Sections:</span>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {form.watch('sections').map((section) => (
                        <Badge key={section} variant={section === form.watch('sectionNumber') ? 'default' : 'secondary'}>
                          {section}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Office Hours:</span> {form.watch('officeHours') || 'Not set'}
                  </div>
                  <div>
                    <span className="font-medium">Total Students:</span> {form.watch('totalStudents') || 0}
                  </div>
                  {form.watch('news') && (
                    <div>
                      <span className="font-medium">Initial Announcements:</span>
                      <div className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">
                        {form.watch('news')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </form>
        </Form>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t mt-4">
          <div>
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={isCreating}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            {currentStep < STEPS.length ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={isCreating}
                className="gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={form.handleSubmit(onSubmit)}
                disabled={isCreating}
                className="gap-2"
              >
                {isCreating ? 'Creating...' : 'Create Course'}
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
