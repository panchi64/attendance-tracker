import {A} from "@solidjs/router";
import LogoComponent from "../components/Logo";
import OfficeHoursComponent from "../components/OfficeHours";
import CourseDetailsComponent from "../components/CourseDetails";
import NewsandCommentsComponents from "../components/NewsandComments"
import AttendanceCounterComponent from "../components/Attendance"

export default function Home() {
    return (
        <main class="bg-white">
            <div class="h-[25vh] w-full">
                <div class="grid grid-cols-2 h-full place-items-center gap-8">
                    {/*Leftmost Header*/}
                    <div class="w-full p-4">
                        <div class="justify-start flex flex-row place-items-center">
                            <LogoComponent logoPath="/UPRM-logo.png" universityName=""/>
                            <OfficeHoursComponent days="LMV" timePeriod="10am-12pm"/>
                        </div>
                    </div>
                    {/*Rightmost Header*/}
                    <div class="w-full place-content-center p-4">
                        <CourseDetailsComponent courseName="INEL4025" sectionNumbers={['100', '096', '060', '042']}
                                                professorName="goomba steinhold"/>
                    </div>
                </div>
            </div>
            {/*Body*/}
            <div class="h-[65vh] w-full grid grid-cols-3">
                <div class="col-span-2 col-start-1 flex flex-col">
                    <AttendanceCounterComponent liveAttendance={0} maxAttendance={64}/>
                    <NewsandCommentsComponents textContent=""/>
                </div>
                <div class="col-span-1 col-start-3">
                    {/*<QRCodeComponent/>*/}
                    {/*<ConfirmationCodeComponent/>*/}
                </div>
            </div>

            {/*Footer*/}
            <div class="h-[10vh] w-full border-red-500 border-2"></div>
        </main>
    );
}
