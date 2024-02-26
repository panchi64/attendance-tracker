function OfficeHours(props: {days: string, timePeriod: string}) {
  return (
    <div className="grid grid-rows-2 h-fit font-bold">
      <p className="capitalize text-gray-500 text-4xl h-fit">office hours</p>
      <p className="uppercase text-gray-500 text-4xl h-fit">{props.days} -- {props.timePeriod}</p>
    </div>
  );
}

export default OfficeHours;