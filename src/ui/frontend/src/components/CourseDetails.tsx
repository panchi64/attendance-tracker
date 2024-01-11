import DropdownChevronComponent from "~/components/DropdownChevron";

function CourseDetails(props: {courseName: string, sectionNumbers: string[], professorName: string}) {
  return (
    <div class="grid grid-rows-2 h-fit justify-end text-black">
      {/*Course Name and Section*/}
      <div class="flex flex-row justify-end place-items-center">
        {/*Course*/}
        <h1 class="text-6xl font-bold mr-2">{props.courseName} - </h1>
        {/*Dropdown*/}
        <div class="dropdown-container justify-center">
          <div class="dropdown">
            <div class="flex flex-row place-items-center">
              <label class="text-6xl cursor-pointer font-bold" tabIndex="0">
                {props.sectionNumbers[0]}
              </label>
              <DropdownChevronComponent/>
            </div>
            <div class="dropdown-menu dropdown-menu-bottom-left bg-white rounded-md border-2 border-gray-200 w-fit">
              {props.sectionNumbers.map((sectionNumber, index) => {
                if (index === 0) return;
                return <a class="dropdown-item text-4xl font-bold hover:bg-green-100">{sectionNumber}</a>
              })}
            </div>
          </div>
        </div>
      </div>
      {/*Professor Name*/}
      <h1 class="text-5xl capitalize font-extralight">prof. {props.professorName}</h1>
    </div>
  );
}

export default CourseDetails;