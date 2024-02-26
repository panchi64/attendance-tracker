import DropdownChevronComponent from "./DropdownChevron";

function CourseDetails(props: {courseName: string, sectionNumbers: string[], professorName: string}) {
  return (
    <>
    <div className="grid grid-rows-2 h-fit justify-end text-black">
      {/*Course Name and Section*/}
      <div className="flex flex-row justify-end place-items-center">
        {/*Course*/}
        <h1 className="text-6xl font-bold mr-2">{props.courseName} - </h1>
        {/*Dropdown*/}
        <div className="dropdown-container justify-center">
          <div className="dropdown">
            <div className="flex flex-row place-items-center">
              <label className="text-6xl cursor-pointer font-bold">
                {props.sectionNumbers[0]}
              </label>
              <DropdownChevronComponent/>
            </div>
            <div className="dropdown-menu dropdown-menu-bottom-left bg-white rounded-md border-2 border-gray-200 w-fit">
              {props.sectionNumbers.map((sectionNumber, index) => {
                if (index === 0) return;
                return <a className="dropdown-item text-4xl font-bold hover:bg-green-100" key={index}>{sectionNumber}</a>
              })}
            </div>
          </div>
        </div>
      </div>
      {/*Professor Name*/}
      <h1 className="text-5xl capitalize font-extralight">prof. {props.professorName}</h1>
    </div>
    </>
  );
}

export default CourseDetails;