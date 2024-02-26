import LogoComponent from "../components/Logo";
import OfficeHoursComponent from "../components/OfficeHours";
import CourseDetailsComponent from "../components/CourseDetails";
import NewsandCommentsComponents from "../components/NewsandComments"
import AttendanceCounterComponent from "../components/Attendance"

export default function Home() {
  return (
    <main className="bg-white">
      <div className="h-[25vh] w-full">
        <div className="grid grid-cols-2 h-full place-items-center gap-8">
          {/*Leftmost Header*/}
          <div className="w-full p-4">
            <div className="justify-start flex flex-row place-items-center">
              <LogoComponent logoPath="/UPRM-logo.png" universityName=""/>
              <OfficeHoursComponent days="LMV" timePeriod="10am-12pm"/>
            </div>
          </div>
          {/*Rightmost Header*/}
          <div className="w-full place-content-center p-4">
            <CourseDetailsComponent courseName="INEL4025" sectionNumbers={['100', '096', '060', '042']}
                                    professorName="goomba steinhold"/>
          </div>
        </div>
      </div>
      {/*Body*/}
      <div className="h-[65vh] w-full grid grid-cols-3">
        <div className="col-span-2 col-start-1 flex flex-col">
          <AttendanceCounterComponent liveAttendance={0} maxAttendance={64}/>
          <NewsandCommentsComponents textContent=""/>
        </div>
        <div className="col-span-1 col-start-3">
          {/*<QRCodeComponent/>*/}
          {/*<ConfirmationCodeComponent/>*/}
        </div>
      </div>

      {/*Footer*/}
      <div className="h-[10vh] w-full border-red-500 border-2"></div>
    </main>
  );
}
