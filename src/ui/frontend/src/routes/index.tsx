import { A } from "@solidjs/router";
import LogoComponent from "../components/Logo";
import OfficeHoursComponent from "../components/OfficeHours";
import CourseDetailsComponent from "../components/CourseDetails";

export default function Home() {
  return (
    <main>
      <div class="h-[25vh] w-full border-amber-200 border-2">
        <div class="grid grid-cols-2 h-full place-items-center gap-8">
          {/*Leftmost Header*/}
          <div class="w-full border-purple-500 border-2 p-4">
            <div class="justify-start flex flex-row place-items-center">
              <LogoComponent logoPath="/UPRM-logo.png" universityName=""/>
              <OfficeHoursComponent days="LMV" timePeriod="10am-12pm"/>
            </div>
          </div>
          {/*Rightmost Header*/}
          <div class="w-full border-green-500 border-2 place-content-center p-4">
            <CourseDetailsComponent courseName="INEL4025" sectionNumbers={['100', '096', '060', '042']}
                                    professorName="goomba steinhold"/>
          </div>
        </div>
      </div>
      {/*Body*/}
      <div class="h-[65vh] w-full border-blue-500 border-2"></div>
      {/*Footer*/}
      <div class="h-[10vh] w-full border-red-500 border-2"></div>
    </main>
  );
}
