"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { useCourse } from '../../context/CourseContext';
import { Check, Settings, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import CourseCreationWizard from './CourseCreationWizard';
import CourseSettingsModal from './CourseSettingsModal';

interface CourseLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CourseLibraryModal({
  open,
  onOpenChange,
}: CourseLibraryModalProps) {
  const { state, switchToAnotherCourse, deleteCurrentCourse } = useCourse();
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<{ id: string; name: string } | null>(null);

  const handleSwitchCourse = async (courseId: string) => {
    try {
      await switchToAnotherCourse(courseId);
      toast.success('Switched course successfully');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to switch course');
    }
  };

  const handleEditCourse = (courseId: string) => {
    // Only allow editing if it's the current course
    if (courseId === state.courseId) {
      setIsEditingCourse(true);
    } else {
      toast.info('Please switch to this course first to edit it');
    }
  };

  const confirmDelete = (courseId: string, courseName: string) => {
    // Only allow deleting if it's the current course
    if (courseId === state.courseId) {
      setCourseToDelete({ id: courseId, name: courseName });
    } else {
      toast.info('Please switch to this course first to delete it');
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;

    try {
      await deleteCurrentCourse();
      toast.success(`Course "${courseToDelete.name}" deleted successfully`);
      setCourseToDelete(null);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete course');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Course Library</DialogTitle>
            <DialogDescription>
              View all your courses. Switch between courses or create a new one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Create New Course Button */}
            <Button
              onClick={() => setIsCreatingCourse(true)}
              className="w-full gap-2"
              size="lg"
            >
              <Plus className="h-5 w-5" />
              Create New Course
            </Button>

            {/* Course List */}
            <ScrollArea className="h-[400px] rounded-md border p-4">
              <div className="space-y-3">
                {state.availableCourses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No courses found. Create your first course to get started!
                  </div>
                ) : (
                  state.availableCourses.map((course) => {
                    const isActive = course.id === state.courseId;
                    return (
                      <div
                        key={course.id}
                        className={`
                          flex items-center justify-between p-4 rounded-lg border
                          ${isActive ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white'}
                          hover:shadow-md transition-shadow
                        `}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {isActive && (
                            <Check className="h-5 w-5 text-primary flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg truncate">
                              {course.name}
                            </h3>
                            {isActive && (
                              <Badge variant="default" className="mt-1">
                                Active Course
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {!isActive && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSwitchCourse(course.id)}
                            >
                              Switch
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEditCourse(course.id)}
                            title="Edit Course"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => confirmDelete(course.id, course.name)}
                            title="Delete Course"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!courseToDelete} onOpenChange={() => setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{courseToDelete?.name}&quot;?
              <br />
              <br />
              <strong className="text-destructive">
                This action cannot be undone. All attendance records for this course will be permanently deleted.
              </strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCourse}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Course Creation Wizard */}
      <CourseCreationWizard
        open={isCreatingCourse}
        onOpenChange={setIsCreatingCourse}
      />

      {/* Course Settings Modal */}
      {isEditingCourse && (
        <CourseSettingsModal
          open={isEditingCourse}
          onOpenChange={setIsEditingCourse}
        />
      )}
    </>
  );
}
